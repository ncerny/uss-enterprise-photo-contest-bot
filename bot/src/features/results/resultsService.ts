import { EmbedBuilder, TextChannel } from 'discord.js';
import { Contest, Submission } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { ContestRepository, SubmissionRepository, VoteRepository } from '../../repositories';
import { getFirestoreClient, getStorageBucket } from '../../config/firebaseAdmin';

const SIGNED_URL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const POST_DELAY_MS = 500; // Delay between posts to avoid rate limits

const PLACEMENT_EMOJIS: Record<number, string> = {
  1: ':first_place:',
  2: ':second_place:',
  3: ':third_place:',
};

export interface RankedSubmission {
  submission: Submission;
  voteCount: number;
  placement: number;
  isTied: boolean;
}

export interface ContestStatistics {
  totalSubmissions: number;
  totalVotes: number;
  uniqueVoters: number;
  durationDays: number;
  durationHours: number;
}

export interface ContestResults {
  contest: Contest;
  rankings: RankedSubmission[];
  statistics: ContestStatistics;
}

export class ResultsService {
  private readonly contestRepository = new ContestRepository(getFirestoreClient());
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());
  private readonly voteRepository = new VoteRepository(getFirestoreClient());
  private readonly bucket = getStorageBucket();

  /**
   * Tally votes and update submission vote counts
   */
  async tallyVotes(contestId: string): Promise<Map<string, number>> {
    const voteCounts = await this.voteRepository.getVoteCountsByContest(contestId);

    // Update each submission with its vote count
    for (const [submissionId, count] of voteCounts) {
      await this.submissionRepository.updateVoteCount(submissionId, count);
    }

    // Also update submissions with 0 votes
    const submissions = await this.submissionRepository.getByContestId(contestId);
    for (const submission of submissions) {
      if (!voteCounts.has(submission.id)) {
        await this.submissionRepository.updateVoteCount(submission.id, 0);
      }
    }

    logger.info('Vote tallying complete', {
      contestId,
      submissionsWithVotes: voteCounts.size,
    });

    return voteCounts;
  }

  /**
   * Rank submissions by vote count with tie handling
   */
  async rankWinners(contestId: string): Promise<RankedSubmission[]> {
    const submissions = await this.submissionRepository.getByContestIdOrderedByVotes(contestId);

    if (submissions.length === 0) {
      return [];
    }

    const rankings: RankedSubmission[] = [];
    let currentPlacement = 1;
    let previousVoteCount: number | null = null;
    let sameRankCount = 0;

    for (let i = 0; i < submissions.length; i++) {
      const submission = submissions[i];
      const voteCount = submission.voteCount ?? 0;

      if (previousVoteCount !== null && voteCount < previousVoteCount) {
        // New placement - skip positions for ties
        currentPlacement += sameRankCount;
        sameRankCount = 1;
      } else if (previousVoteCount === voteCount) {
        // Tie - same placement
        sameRankCount++;
      } else {
        // First entry
        sameRankCount = 1;
      }

      // Check if this is a tie (same vote count as previous or next)
      const prevVotes = i > 0 ? (submissions[i - 1].voteCount ?? 0) : null;
      const nextVotes = i < submissions.length - 1 ? (submissions[i + 1].voteCount ?? 0) : null;
      const isTied = voteCount === prevVotes || voteCount === nextVotes;

      rankings.push({
        submission,
        voteCount,
        placement: currentPlacement,
        isTied,
      });

      previousVoteCount = voteCount;
    }

    return rankings;
  }

  /**
   * Calculate contest statistics
   */
  async calculateStatistics(contest: Contest): Promise<ContestStatistics> {
    const submissions = await this.submissionRepository.getByContestId(contest.id);
    const votes = await this.voteRepository.getByContestId(contest.id);

    const uniqueVoters = new Set(votes.map((v) => v.voterId)).size;

    // Calculate duration from submission start to voting end
    const startTime = contest.createdAt.getTime();
    const endTime = contest.votingDeadline.getTime();
    const durationMs = endTime - startTime;
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationDays = Math.floor(durationHours / 24);

    return {
      totalSubmissions: submissions.length,
      totalVotes: votes.length,
      uniqueVoters,
      durationDays,
      durationHours: durationHours % 24,
    };
  }

  /**
   * Announce results to the channel
   */
  async announceResults(contest: Contest, channel: TextChannel): Promise<ContestResults> {
    // Tally votes first
    await this.tallyVotes(contest.id);

    // Get rankings and statistics
    const rankings = await this.rankWinners(contest.id);
    const statistics = await this.calculateStatistics(contest);

    // Handle no submissions case
    if (rankings.length === 0) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Contest Results')
            .setDescription('No submissions were received for this contest.')
            .setColor(0x95a5a6),
        ],
      });

      return { contest, rankings, statistics };
    }

    // Handle no votes case
    if (statistics.totalVotes === 0) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Contest Results')
            .setDescription(
              'The voting period has ended, but no votes were cast.\n' +
                `${rankings.length} submission(s) were received.`
            )
            .setColor(0x95a5a6),
        ],
      });

      return { contest, rankings, statistics };
    }

    // Post results header
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(':trophy: Contest Results')
          .setDescription(
            `**${contest.title}**\n\n` +
              `The voting has ended! Here are the winners...`
          )
          .setColor(0xffd700),
      ],
    });

    await this.delay(POST_DELAY_MS);

    // Post winner cards (up to numberOfWinners, but include all ties at cutoff)
    const winnersToShow = this.getWinnersWithTies(rankings, contest.numberOfWinners);

    for (const ranked of winnersToShow) {
      await this.postWinnerCard(channel, ranked);
      await this.delay(POST_DELAY_MS);
    }

    // Post statistics
    await this.postStatistics(channel, contest, statistics);

    logger.info('Results announced', {
      contestId: contest.id,
      winnersShown: winnersToShow.length,
      totalSubmissions: statistics.totalSubmissions,
      totalVotes: statistics.totalVotes,
    });

    return { contest, rankings, statistics };
  }

  /**
   * Get winners including all ties at the cutoff position
   */
  private getWinnersWithTies(rankings: RankedSubmission[], numberOfWinners: number): RankedSubmission[] {
    if (rankings.length === 0) {
      return [];
    }

    const winners: RankedSubmission[] = [];
    let lastIncludedPlacement = 0;

    for (const ranked of rankings) {
      // Include if within numberOfWinners OR if tied with someone already included
      if (ranked.placement <= numberOfWinners || ranked.placement === lastIncludedPlacement) {
        winners.push(ranked);
        lastIncludedPlacement = ranked.placement;
      } else {
        break;
      }
    }

    return winners;
  }

  /**
   * Post a single winner card
   */
  private async postWinnerCard(channel: TextChannel, ranked: RankedSubmission): Promise<void> {
    const { submission, voteCount, placement, isTied } = ranked;

    const placementDisplay = PLACEMENT_EMOJIS[placement] ?? `**#${placement}**`;
    const tieIndicator = isTied ? ' (tied)' : '';
    const voteText = voteCount === 1 ? 'vote' : 'votes';

    try {
      const imageUrl = await this.getSignedUrl(submission);

      const embed = new EmbedBuilder()
        .setTitle(`${placementDisplay} Place${tieIndicator}`)
        .setDescription(`<@${submission.userId}>\n\n**${voteCount}** ${voteText}`)
        .setImage(imageUrl)
        .setColor(this.getPlacementColor(placement));

      if (submission.caption) {
        embed.addFields({ name: 'Caption', value: submission.caption });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to post winner card', error as Error, {
        submissionId: submission.id,
        placement,
      });

      // Post without image as fallback
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${placementDisplay} Place${tieIndicator}`)
            .setDescription(
              `<@${submission.userId}>\n\n` +
                `**${voteCount}** ${voteText}\n\n` +
                `*(Image unavailable)*`
            )
            .setColor(this.getPlacementColor(placement)),
        ],
      });
    }
  }

  /**
   * Post statistics summary
   */
  private async postStatistics(
    channel: TextChannel,
    contest: Contest,
    stats: ContestStatistics
  ): Promise<void> {
    const durationText =
      stats.durationDays > 0
        ? `${stats.durationDays} day(s), ${stats.durationHours} hour(s)`
        : `${stats.durationHours} hour(s)`;

    const embed = new EmbedBuilder()
      .setTitle(':bar_chart: Contest Statistics')
      .addFields(
        { name: 'Submissions', value: stats.totalSubmissions.toString(), inline: true },
        { name: 'Total Votes', value: stats.totalVotes.toString(), inline: true },
        { name: 'Unique Voters', value: stats.uniqueVoters.toString(), inline: true },
        { name: 'Duration', value: durationText, inline: true }
      )
      .setFooter({ text: `Contest: ${contest.title}` })
      .setColor(0x3498db)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  private getPlacementColor(placement: number): number {
    switch (placement) {
      case 1:
        return 0xffd700; // Gold
      case 2:
        return 0xc0c0c0; // Silver
      case 3:
        return 0xcd7f32; // Bronze
      default:
        return 0x95a5a6; // Gray
    }
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
