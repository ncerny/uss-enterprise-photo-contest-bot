import {
  Client,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  TextChannel,
} from 'discord.js';
import { Contest, ContestStatus } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { ContestRepository, SubmissionRepository, VoteRepository } from '../../repositories';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { VOTE_EMOJI } from './votingGalleryService';

export type VoteLimitReachedListener = (
  userId: string,
  contest: Contest,
  currentVotes: number
) => Promise<void> | void;

/**
 * Handles reaction events for vote tracking
 */
export class VotingReactionHandler {
  private readonly contestRepository = new ContestRepository(getFirestoreClient());
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());
  private readonly voteRepository = new VoteRepository(getFirestoreClient());

  // In-memory cache of voting message -> submission mapping
  // This is rebuilt on startup by scanning active voting contests
  private readonly messageToSubmission = new Map<string, string>();
  private readonly messageToContest = new Map<string, string>();

  private readonly limitListeners = new Set<VoteLimitReachedListener>();
  private unsubscribeAdd?: () => void;
  private unsubscribeRemove?: () => void;

  constructor(private readonly client: Client) {}

  /**
   * Start listening for reaction events
   */
  start(): void {
    const handleAdd = (
      reaction: MessageReaction | PartialMessageReaction,
      user: User | PartialUser
    ) => {
      void this.handleReactionAdd(reaction, user);
    };

    const handleRemove = (
      reaction: MessageReaction | PartialMessageReaction,
      user: User | PartialUser
    ) => {
      void this.handleReactionRemove(reaction, user);
    };

    this.client.on('messageReactionAdd', handleAdd);
    this.client.on('messageReactionRemove', handleRemove);

    this.unsubscribeAdd = () => this.client.off('messageReactionAdd', handleAdd);
    this.unsubscribeRemove = () => this.client.off('messageReactionRemove', handleRemove);

    // Initialize cache from active voting contests
    void this.initializeCache();

    logger.info('VotingReactionHandler started');
  }

  /**
   * Stop listening for reaction events
   */
  stop(): void {
    this.unsubscribeAdd?.();
    this.unsubscribeRemove?.();
    this.unsubscribeAdd = undefined;
    this.unsubscribeRemove = undefined;
    logger.info('VotingReactionHandler stopped');
  }

  /**
   * Register a voting message for a submission
   */
  registerVotingMessage(messageId: string, submissionId: string, contestId: string): void {
    this.messageToSubmission.set(messageId, submissionId);
    this.messageToContest.set(messageId, contestId);
  }

  /**
   * Clear voting messages for a contest (when voting ends)
   */
  clearContestMessages(contestId: string): void {
    for (const [messageId, cId] of this.messageToContest.entries()) {
      if (cId === contestId) {
        this.messageToSubmission.delete(messageId);
        this.messageToContest.delete(messageId);
      }
    }
  }

  /**
   * Register listener for when a user reaches their vote limit
   */
  onVoteLimitReached(listener: VoteLimitReachedListener): () => void {
    this.limitListeners.add(listener);
    return () => this.limitListeners.delete(listener);
  }

  private async initializeCache(): Promise<void> {
    try {
      // Find all contests currently in voting phase
      const votingContests = await this.contestRepository.findByStatus(ContestStatus.VOTING);

      for (const contest of votingContests) {
        const submissions = await this.submissionRepository.getByContestId(contest.id);

        // We need to fetch the voting messages from the channel
        // For now, just log - the messages will be registered when gallery is posted
        logger.info('Found active voting contest', {
          contestId: contest.id,
          submissionCount: submissions.length,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize voting message cache', error as Error);
    }
  }

  private async handleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    // Ignore bot reactions
    if (user.bot) {
      return;
    }

    // Fetch partial reaction if needed
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        logger.warn('Failed to fetch partial reaction', { error });
        return;
      }
    }

    // Only process vote emoji
    if (reaction.emoji.name !== VOTE_EMOJI) {
      return;
    }

    const messageId = reaction.message.id;
    const submissionId = this.messageToSubmission.get(messageId);
    const contestId = this.messageToContest.get(messageId);

    if (!submissionId || !contestId) {
      // Not a voting message
      return;
    }

    try {
      // Verify contest is still in voting phase
      const contest = await this.contestRepository.getById(contestId);

      if (!contest || contest.status !== ContestStatus.VOTING) {
        logger.debug('Ignoring reaction - contest not in voting phase', { contestId });
        return;
      }

      // Check vote limit
      const currentVoteCount = await this.voteRepository.countByVoterAndContest(
        user.id,
        contestId
      );

      if (currentVoteCount >= contest.maxVotesPerUser) {
        // At limit - remove the reaction and notify user
        await reaction.users.remove(user.id);
        await this.notifyLimitReached(user.id, contest, currentVoteCount);
        return;
      }

      // Check if already voted for this submission
      const alreadyVoted = await this.voteRepository.hasVoted(user.id, submissionId);

      if (alreadyVoted) {
        logger.debug('User already voted for this submission', {
          userId: user.id,
          submissionId,
        });
        return;
      }

      // Record the vote
      await this.voteRepository.create({
        contestId,
        submissionId,
        voterId: user.id,
        createdAt: new Date(),
      });

      logger.info('Vote recorded', {
        contestId,
        submissionId,
        voterId: user.id,
        voteNumber: currentVoteCount + 1,
        maxVotes: contest.maxVotesPerUser,
      });
    } catch (error) {
      logger.error('Failed to process vote reaction', error as Error, {
        messageId,
        submissionId,
        userId: user.id,
      });
    }
  }

  private async handleReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
    // Ignore bot reactions
    if (user.bot) {
      return;
    }

    // Fetch partial reaction if needed
    if (reaction.partial) {
      try {
        reaction = await reaction.fetch();
      } catch (error) {
        logger.warn('Failed to fetch partial reaction for removal', { error });
        return;
      }
    }

    // Only process vote emoji
    if (reaction.emoji.name !== VOTE_EMOJI) {
      return;
    }

    const messageId = reaction.message.id;
    const submissionId = this.messageToSubmission.get(messageId);
    const contestId = this.messageToContest.get(messageId);

    if (!submissionId || !contestId) {
      return;
    }

    try {
      // Verify contest is still in voting phase
      const contest = await this.contestRepository.getById(contestId);

      if (!contest || contest.status !== ContestStatus.VOTING) {
        return;
      }

      // Remove the vote
      await this.voteRepository.deleteByVoterAndSubmission(user.id, submissionId);

      logger.info('Vote removed', {
        contestId,
        submissionId,
        voterId: user.id,
      });
    } catch (error) {
      logger.error('Failed to process vote removal', error as Error, {
        messageId,
        submissionId,
        userId: user.id,
      });
    }
  }

  private async notifyLimitReached(
    userId: string,
    contest: Contest,
    currentVotes: number
  ): Promise<void> {
    await Promise.allSettled(
      [...this.limitListeners].map((listener) => listener(userId, contest, currentVotes))
    );
  }
}
