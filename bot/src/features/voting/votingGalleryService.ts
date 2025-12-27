import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { Contest, Submission } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { SubmissionRepository } from '../../repositories';
import { getFirestoreClient, getStorageBucket } from '../../config/firebaseAdmin';

export const VOTE_EMOJI = '👍';
const POST_DELAY_MS = 500; // Delay between posts to avoid rate limits
const SIGNED_URL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface VotingGalleryResult {
  contest: Contest;
  submissionMessageMap: Map<string, string>; // submissionId -> messageId
  totalSubmissions: number;
}

/**
 * Posts all contest submissions as an anonymous voting gallery
 */
export class VotingGalleryService {
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());
  private readonly bucket = getStorageBucket();

  /**
   * Post the voting gallery for a contest
   */
  async postGallery(contest: Contest, channel: TextChannel): Promise<VotingGalleryResult> {
    const submissions = await this.submissionRepository.getByContestId(contest.id);

    if (submissions.length === 0) {
      logger.warn('No submissions to display for voting', { contestId: contest.id });
      await channel.send({
        content: '⚠️ No submissions were received during the submission period.',
      });
      return {
        contest,
        submissionMessageMap: new Map(),
        totalSubmissions: 0,
      };
    }

    // Shuffle submissions with seeded random based on contest ID
    const shuffled = this.shuffleWithSeed(submissions, contest.id);

    // Post header message
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗳️ Voting is Now Open!')
          .setDescription(
            `**${submissions.length}** submissions are ready for voting.\n\n` +
              `React with ${VOTE_EMOJI} to vote for your favorites!\n` +
              `You can vote for up to **${contest.maxVotesPerUser}** submissions.\n\n` +
              `Voting ends: <t:${Math.floor(contest.votingDeadline.getTime() / 1000)}:R>`
          )
          .setColor(0x5865f2),
      ],
    });

    // Small delay after header
    await this.delay(POST_DELAY_MS);

    const submissionMessageMap = new Map<string, string>();

    // Post each submission
    for (let i = 0; i < shuffled.length; i++) {
      const submission = shuffled[i];
      const displayOrder = i + 1;

      try {
        const imageUrl = await this.getSignedUrl(submission);
        const message = await this.postSubmission(channel, submission, displayOrder, imageUrl);

        // Add vote reaction
        await message.react(VOTE_EMOJI);

        // Store the mapping and update display order
        submissionMessageMap.set(submission.id, message.id);
        await this.submissionRepository.update(submission.id, {
          displayOrder,
          // Store voting message ID for reaction lookups
        });

        // Delay between posts
        if (i < shuffled.length - 1) {
          await this.delay(POST_DELAY_MS);
        }
      } catch (error) {
        logger.error('Failed to post submission for voting', error as Error, {
          contestId: contest.id,
          submissionId: submission.id,
          displayOrder,
        });
      }
    }

    logger.info('Voting gallery posted', {
      contestId: contest.id,
      totalSubmissions: submissions.length,
      messagesPosted: submissionMessageMap.size,
    });

    return {
      contest,
      submissionMessageMap,
      totalSubmissions: submissions.length,
    };
  }

  private async postSubmission(
    channel: TextChannel,
    submission: Submission,
    displayOrder: number,
    imageUrl: string
  ): Promise<Message> {
    const embed = new EmbedBuilder()
      .setTitle(`Submission #${displayOrder}`)
      .setImage(imageUrl)
      .setColor(0x2b2d31);

    if (submission.caption) {
      embed.setDescription(submission.caption);
    }

    return channel.send({ embeds: [embed] });
  }

  private async getSignedUrl(submission: Submission): Promise<string> {
    const displayPath = submission.assets.display.path;
    const file = this.bucket.file(displayPath);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + SIGNED_URL_EXPIRY_MS,
    });

    return url;
  }

  /**
   * Shuffle array with seeded random for reproducible order
   */
  private shuffleWithSeed<T>(array: T[], seed: string): T[] {
    const result = [...array];
    let seedNum = this.hashString(seed);

    for (let i = result.length - 1; i > 0; i--) {
      seedNum = this.nextRandom(seedNum);
      const j = Math.abs(seedNum) % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  private nextRandom(seed: number): number {
    // Simple LCG (Linear Congruential Generator)
    return (seed * 1103515245 + 12345) & 0x7fffffff;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
