import { Client, EmbedBuilder } from 'discord.js';
import { Contest } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { VotingReactionHandler } from './reactionHandler';
import { env } from '../../config/env';

/**
 * Sends DM feedback to users about their votes
 */
export class VoteFeedbackService {
  private unsubscribeLimitReached?: () => void;

  constructor(
    private readonly client: Client,
    private readonly reactionHandler: VotingReactionHandler
  ) {
    this.unsubscribeLimitReached = this.reactionHandler.onVoteLimitReached(
      (userId, contest, currentVotes) => this.handleLimitReached(userId, contest, currentVotes)
    );
  }

  stop(): void {
    this.unsubscribeLimitReached?.();
    this.unsubscribeLimitReached = undefined;
  }

  private async handleLimitReached(
    userId: string,
    contest: Contest,
    currentVotes: number
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);

      const webAppUrl = env.WEB_APP_URL || 'https://your-app.web.app';
      const manageVotesUrl = `${webAppUrl}/contests/${contest.id}/votes`;

      const embed = new EmbedBuilder()
        .setTitle('Vote Limit Reached')
        .setDescription(
          `You've used all **${currentVotes}** of your votes for **${contest.title}**.\n\n` +
            `To vote for a different submission, you'll need to remove one of your existing votes first.`
        )
        .addFields(
          {
            name: 'How to Change Your Votes',
            value:
              '**Option 1:** Remove your reaction (👍) from a submission in Discord\n' +
              `**Option 2:** [Manage your votes online](${manageVotesUrl})`,
          },
          {
            name: 'Voting Ends',
            value: `<t:${Math.floor(contest.votingDeadline.getTime() / 1000)}:R>`,
            inline: true,
          }
        )
        .setColor(0xfee75c) // Yellow warning color
        .setFooter({ text: 'USS Enterprise Photo Contest' });

      await user.send({ embeds: [embed] });

      logger.info('Sent vote limit DM', {
        userId,
        contestId: contest.id,
        currentVotes,
      });
    } catch (error) {
      // User may have DMs disabled
      logger.debug('Failed to send vote limit DM', {
        userId,
        contestId: contest.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
