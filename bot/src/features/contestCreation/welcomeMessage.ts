import {
  EmbedBuilder,
  Message,
  MessageCreateOptions,
  MessageEditOptions,
  TextChannel,
} from 'discord.js';
import { Contest, ContestStatus } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { CommandExecutionError } from '../../commands/errors';

const EMBED_COLOR = 0xff9f43;

export async function postContestWelcomeMessage(
  channel: TextChannel,
  contest: Contest
): Promise<Message> {
  try {
    const payload = buildWelcomeMessagePayload(contest);
    const message = await channel.send(payload);
    await pinSafely(message);
    return message;
  } catch (error) {
    throw new CommandExecutionError('Failed to post the contest welcome message.', error);
  }
}

export async function updateContestWelcomeMessage(
  channel: TextChannel,
  contest: Contest
): Promise<void> {
  if (!contest.welcomeMessageId) {
    return;
  }

  try {
    const message = await channel.messages.fetch(contest.welcomeMessageId);
    await message.edit(buildWelcomeMessagePayload(contest) as MessageEditOptions);
  } catch (error) {
    logger.warn(
      `Unable to update welcome message ${contest.welcomeMessageId} in channel ${channel.id}.`,
      error as Error
    );
  }
}

function buildWelcomeMessagePayload(contest: Contest): MessageCreateOptions {
  return {
    content: buildInstructionText(),
    embeds: [buildWelcomeEmbed(contest)],
  };
}

function buildInstructionText(): string {
  return [
    '📸 **How to participate**',
    '1. Post your photo in this channel as an attachment.',
    '2. The bot will capture your submission and remove the original message.',
    '3. Watch for a DM confirming how many submissions you have left.',
    '',
    '_Questions?_ Ping a moderator any time.',
  ].join('\n');
}

function buildWelcomeEmbed(contest: Contest): EmbedBuilder {
  const submissionDeadline = contest.submissionDeadline;
  const votingDeadline = contest.votingDeadline;
  const submissionCount = contest.submissionCount ?? 0;

  return new EmbedBuilder()
    .setTitle(contest.title)
    .setColor(EMBED_COLOR)
    .setDescription(contest.description)
    .addFields(
      {
        name: 'Timeline',
        value: [
          `• Submissions close ${formatTimestamp(submissionDeadline, 'F')} (${formatTimestamp(
            submissionDeadline,
            'R'
          )})`,
          `• Voting ends ${formatTimestamp(votingDeadline, 'F')} (${formatTimestamp(
            votingDeadline,
            'R'
          )})`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Limits',
        value: [
          `• ${contest.maxSubmissionsPerUser} submissions / user`,
          `• ${contest.maxVotesPerUser} votes / user`,
          `• Top ${contest.numberOfWinners} winner${contest.numberOfWinners === 1 ? '' : 's'}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: 'Status',
        value: [
          `• Phase: ${formatPhase(contest.status)}`,
          `• Submissions: **${submissionCount}** received`,
        ].join('\n'),
        inline: true,
      }
    )
    .setFooter({ text: `Contest ID: ${contest.id}` });
}

function formatPhase(status: Contest['status']): string {
  switch (status) {
    case ContestStatus.CREATED:
      return 'Created (setup in progress)';
    case ContestStatus.SUBMISSION:
      return 'Submission (accepting entries)';
    case ContestStatus.VOTING:
      return 'Voting (review and vote)';
    case ContestStatus.RESULTS:
      return 'Results (contest closed)';
    case ContestStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

function formatTimestamp(date: Date, style: 'F' | 'R'): string {
  const seconds = Math.floor(date.getTime() / 1000);
  return `<t:${seconds}:${style}>`;
}

async function pinSafely(message: Message): Promise<void> {
  try {
    await message.pin();
  } catch (error) {
    logger.warn('Unable to pin welcome message.', error as Error);
  }
}
