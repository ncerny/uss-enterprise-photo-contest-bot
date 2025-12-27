import { ChannelType, Client, DiscordAPIError, TextChannel } from 'discord.js';
import { Contest, ContestStatus } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { ContestRepository, SubmissionRepository } from '../../repositories';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { transitionContest } from './stateMachine';
import { VotingGalleryService } from '../voting/votingGalleryService';
import { ResultsService } from '../results';

export type VotingMessageRegistrar = (
  messageId: string,
  submissionId: string,
  contestId: string
) => void;

const DEFAULT_INTERVAL_MS = 60_000;
const SYSTEM_ACTOR_ID = 'contest-scheduler';
const ORPHAN_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class ContestScheduler {
  private readonly contestRepository = new ContestRepository(getFirestoreClient());
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());
  private readonly votingGalleryService = new VotingGalleryService();
  private readonly resultsService = new ResultsService();
  private timer?: NodeJS.Timeout;
  private running = false;
  private tickInFlight = false;
  private votingMessageRegistrar?: VotingMessageRegistrar;

  constructor(
    private readonly client: Client,
    private readonly intervalMs = DEFAULT_INTERVAL_MS
  ) {}

  /**
   * Set the registrar for voting messages (called by VotingReactionHandler)
   */
  setVotingMessageRegistrar(registrar: VotingMessageRegistrar): void {
    this.votingMessageRegistrar = registrar;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    logger.info(`ContestScheduler started (interval ${this.intervalMs}ms).`);
    void this.runTick();
    this.timer = setInterval(() => void this.runTick(), this.intervalMs);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    logger.info('ContestScheduler stopped.');
  }

  private async runTick(): Promise<void> {
    if (!this.running || this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;
    const now = new Date();

    try {
      await this.processDueContests(now);
    } catch (error) {
      logger.error('ContestScheduler tick failed', error as Error);
    } finally {
      this.tickInFlight = false;
    }
  }

  private async processDueContests(now: Date): Promise<void> {
    const submissionDue = await this.contestRepository.findDueByStatus(
      ContestStatus.SUBMISSION,
      'submissionDeadline',
      now
    );
    const votingDue = await this.contestRepository.findDueByStatus(
      ContestStatus.VOTING,
      'votingDeadline',
      now
    );

    for (const contest of submissionDue) {
      // Check if there are any submissions before entering voting phase
      const submissions = await this.submissionRepository.getByContestId(contest.id);

      if (submissions.length === 0) {
        // No submissions received - skip voting and end contest immediately
        await this.handleNoSubmissionsTransition(contest);
      } else {
        await this.handleTransition(contest, ContestStatus.VOTING, 'Submission deadline reached.');
      }
    }

    for (const contest of votingDue) {
      await this.handleTransition(contest, ContestStatus.RESULTS, 'Voting deadline reached.');
    }
  }

  /**
   * Handle contest that received no submissions.
   * Skips voting phase and transitions directly to results.
   */
  private async handleNoSubmissionsTransition(contest: Contest): Promise<void> {
    try {
      const channel = await this.fetchContestChannel(contest.channelId);

      if (!channel) {
        await this.handleOrphanedContest(contest);
        return;
      }

      // Transition directly to RESULTS, skipping VOTING
      await transitionContest(contest, ContestStatus.RESULTS, {
        actorId: SYSTEM_ACTOR_ID,
        channel,
        reason: 'No submissions received. Voting phase skipped.',
        announcement:
          '📭 **Contest Ended - No Submissions**\n\n' +
          'The submission period has ended, but no photos were submitted.\n' +
          'The contest has been closed without a voting phase.',
      });

      logger.info(
        `ContestScheduler ended contest ${contest.id} (${contest.title}) with no submissions - voting phase skipped.`
      );
    } catch (error) {
      logger.error(
        `ContestScheduler failed to handle no-submissions transition for contest ${contest.id}.`,
        error as Error
      );
    }
  }

  private async handleTransition(
    contest: Contest,
    targetStatus: ContestStatus,
    reason: string
  ): Promise<void> {
    try {
      const channel = await this.fetchContestChannel(contest.channelId);

      if (!channel) {
        await this.handleOrphanedContest(contest);
        return;
      }

      // Channel is accessible; clear orphanedAt if it was previously set
      if (contest.orphanedAt) {
        await this.contestRepository.update(contest.id, { orphanedAt: undefined });
        logger.info(
          `ContestScheduler cleared orphan status for contest ${contest.id} (${contest.title}); channel is accessible again.`
        );
      }

      await transitionContest(contest, targetStatus, {
        actorId: SYSTEM_ACTOR_ID,
        channel,
        reason: `${reason} Transition triggered automatically by scheduler.`,
        announcement: this.buildAnnouncement(targetStatus),
      });

      // Post voting gallery when transitioning to VOTING status
      if (targetStatus === ContestStatus.VOTING) {
        await this.postVotingGallery(contest, channel);
      }

      // Announce results when transitioning to RESULTS status
      if (targetStatus === ContestStatus.RESULTS) {
        await this.announceResults(contest, channel);
      }

      logger.info(`ContestScheduler transitioned contest ${contest.id} to ${targetStatus}.`);
    } catch (error) {
      logger.error(
        `ContestScheduler failed to transition contest ${contest.id} to ${targetStatus}.`,
        error as Error
      );
    }
  }

  private async postVotingGallery(contest: Contest, channel: TextChannel): Promise<void> {
    try {
      const result = await this.votingGalleryService.postGallery(contest, channel);

      // Register voting messages with reaction handler
      if (this.votingMessageRegistrar) {
        for (const [submissionId, messageId] of result.submissionMessageMap) {
          this.votingMessageRegistrar(messageId, submissionId, contest.id);
        }
      }

      logger.info('Voting gallery posted and messages registered', {
        contestId: contest.id,
        submissionCount: result.totalSubmissions,
      });
    } catch (error) {
      logger.error('Failed to post voting gallery', error as Error, {
        contestId: contest.id,
      });
    }
  }

  private async announceResults(contest: Contest, channel: TextChannel): Promise<void> {
    try {
      const results = await this.resultsService.announceResults(contest, channel);

      logger.info('Results announced', {
        contestId: contest.id,
        winnersCount: results.rankings.filter((r) => r.placement <= contest.numberOfWinners).length,
        totalVotes: results.statistics.totalVotes,
      });
    } catch (error) {
      logger.error('Failed to announce results', error as Error, {
        contestId: contest.id,
      });
    }
  }

  private async handleOrphanedContest(contest: Contest): Promise<void> {
    const now = new Date();

    if (!contest.orphanedAt) {
      // First time detecting orphan; mark it
      await this.contestRepository.update(contest.id, { orphanedAt: now });
      logger.warn(
        `ContestScheduler marked contest ${contest.id} (${contest.title}) as orphaned; channel ${contest.channelId} is unavailable. Will auto-cancel after grace period.`
      );
      return;
    }

    const orphanedDuration = now.getTime() - contest.orphanedAt.getTime();

    if (orphanedDuration < ORPHAN_GRACE_PERIOD_MS) {
      // Still within grace period; log at debug level to reduce noise
      logger.debug(
        `ContestScheduler skipping orphaned contest ${contest.id} (${contest.title}); ${Math.round((ORPHAN_GRACE_PERIOD_MS - orphanedDuration) / (1000 * 60 * 60))}h remaining in grace period.`
      );
      return;
    }

    // Grace period expired; auto-cancel
    try {
      const historyEntry = {
        status: ContestStatus.CANCELLED,
        changedAt: now,
        changedBy: SYSTEM_ACTOR_ID,
      };
      const statusHistory = [...(contest.statusHistory ?? []), historyEntry];

      await this.contestRepository.update(contest.id, {
        status: ContestStatus.CANCELLED,
        statusHistory,
      });

      logger.info(
        `ContestScheduler auto-cancelled orphaned contest ${contest.id} (${contest.title}) after grace period expired.`
      );
    } catch (error) {
      logger.error(
        `ContestScheduler failed to auto-cancel orphaned contest ${contest.id}.`,
        error as Error
      );
    }
  }

  private async fetchContestChannel(channelId: string): Promise<TextChannel | null> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        return null;
      }

      if (channel.type !== ChannelType.GuildText) {
        return null;
      }

      return channel as TextChannel;
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === 10003) {
        // Unknown Channel - will be handled by orphan logic
        return null;
      }

      logger.error(`ContestScheduler failed to fetch channel ${channelId}`, error as Error);
      return null;
    }
  }

  private buildAnnouncement(targetStatus: ContestStatus): string {
    switch (targetStatus) {
      case ContestStatus.VOTING:
        return ':alarm_clock: Submissions closed automatically. Voting begins now!';
      case ContestStatus.RESULTS:
        return ':white_check_mark: Voting has ended!';
      default:
        return 'Contest status updated automatically.';
    }
  }
}
