import { ChatInputCommandInteraction } from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { CommandValidationError } from '../../commands/errors';
import { resolveContestCommandContext } from './contestContext';
import { transitionContest } from './stateMachine';

const CHANNEL_OPTION = 'channel';
const REASON_OPTION = 'reason';
const CONFIRM_OPTION = 'confirm';

export async function handleContestClose(interaction: ChatInputCommandInteraction): Promise<void> {
  const confirm = interaction.options.getBoolean(CONFIRM_OPTION) ?? false;
  const reason = interaction.options.getString(REASON_OPTION) ?? undefined;
  const { contest, channel } = await resolveContestCommandContext(interaction, CHANNEL_OPTION);

  const targetStatus = getCloseTarget(contest.status);

  if (!targetStatus) {
    throw new CommandValidationError('This contest is not in a state that can be closed manually.');
  }

  if (!confirm) {
    await interaction.reply({
      content: buildConfirmationText(
        `This will end the current ${formatStatus(contest.status)} phase and move the contest to ${formatStatus(
          targetStatus
        )}. Re-run the command with the "confirm" option set to true to proceed.`
      ),
      ephemeral: true,
    });
    return;
  }

  await transitionContest(contest, targetStatus, {
    actorId: interaction.user.id,
    channel,
    reason: reason ?? 'Manual close',
    announcement: buildAnnouncement(
      `⏱️ ${formatStatus(contest.status)} phase closed early by ${interaction.user}. ${phaseFollowUp(
        targetStatus
      )}`,
      reason
    ),
  });

  await interaction.reply({
    content: `Contest moved to ${formatStatus(targetStatus)}.`,
    ephemeral: true,
  });
}

export async function handleContestCancel(interaction: ChatInputCommandInteraction): Promise<void> {
  const confirm = interaction.options.getBoolean(CONFIRM_OPTION) ?? false;
  const reason = interaction.options.getString(REASON_OPTION) ?? undefined;
  const { contest, channel } = await resolveContestCommandContext(interaction, CHANNEL_OPTION);

  if (contest.status === ContestStatus.CANCELLED) {
    throw new CommandValidationError('This contest is already cancelled.');
  }

  if (contest.status === ContestStatus.RESULTS) {
    throw new CommandValidationError('This contest has already completed and cannot be cancelled.');
  }

  if (!confirm) {
    await interaction.reply({
      content: buildConfirmationText(
        'Cancelling will pause all activity and prevent submissions or voting until resumed. Re-run with confirm=true to proceed.'
      ),
      ephemeral: true,
    });
    return;
  }

  await transitionContest(contest, ContestStatus.CANCELLED, {
    actorId: interaction.user.id,
    channel,
    reason: reason ?? 'Contest cancelled by admin',
    announcement: buildAnnouncement(
      `⛔ Contest cancelled by ${interaction.user}. All submissions are preserved, but no further activity is allowed until resumed.`,
      reason
    ),
  });

  await interaction.reply({
    content: 'Contest cancelled. Use /contest resume when you are ready to continue.',
    ephemeral: true,
  });
}

export async function handleContestResume(interaction: ChatInputCommandInteraction): Promise<void> {
  const reason = interaction.options.getString(REASON_OPTION) ?? undefined;
  const { contest, channel } = await resolveContestCommandContext(interaction, CHANNEL_OPTION);

  if (contest.status !== ContestStatus.CANCELLED) {
    throw new CommandValidationError('Only cancelled contests can be resumed.');
  }

  const targetStatus = getResumeTargetStatus(contest);

  validateResumeWindow(contest, targetStatus);

  await transitionContest(contest, targetStatus, {
    actorId: interaction.user.id,
    channel,
    reason: reason ?? 'Contest resumed by admin',
    announcement: buildAnnouncement(
      `✅ Contest resumed by ${interaction.user}. Phase: ${formatStatus(targetStatus)}.`,
      reason
    ),
  });

  await interaction.reply({
    content: `Contest resumed in the ${formatStatus(targetStatus)} phase.`,
    ephemeral: true,
  });
}

function buildConfirmationText(message: string): string {
  return `${message}\n\nIf this was a mistake, no changes were made.`;
}

function buildAnnouncement(base: string, reason?: string): string {
  return reason ? `${base}\nReason: ${reason}` : base;
}

function getCloseTarget(status: ContestStatus): ContestStatus | null {
  switch (status) {
    case ContestStatus.SUBMISSION:
      return ContestStatus.VOTING;
    case ContestStatus.VOTING:
      return ContestStatus.RESULTS;
    default:
      return null;
  }
}

function getResumeTargetStatus(contest: {
  statusHistory?: { status: ContestStatus }[];
}): ContestStatus {
  const history = [...(contest.statusHistory ?? [])].reverse();
  const previous = history.find((entry) => entry.status !== ContestStatus.CANCELLED);

  if (!previous) {
    return ContestStatus.SUBMISSION;
  }

  if (previous.status === ContestStatus.RESULTS) {
    throw new CommandValidationError('Completed contests cannot be resumed.');
  }

  return previous.status;
}

function validateResumeWindow(
  contest: { submissionDeadline: Date; votingDeadline: Date },
  status: ContestStatus
): void {
  const now = Date.now();

  if (status === ContestStatus.SUBMISSION && contest.submissionDeadline.getTime() <= now) {
    throw new CommandValidationError(
      'Submission deadline has passed. Consider closing into voting instead.'
    );
  }

  if (status === ContestStatus.VOTING && contest.votingDeadline.getTime() <= now) {
    throw new CommandValidationError(
      'Voting deadline has passed. Consider moving to results instead.'
    );
  }
}

function phaseFollowUp(status: ContestStatus): string {
  switch (status) {
    case ContestStatus.VOTING:
      return 'Voting begins immediately.';
    case ContestStatus.RESULTS:
      return 'Results will be posted shortly.';
    default:
      return '';
  }
}

function formatStatus(status: ContestStatus): string {
  switch (status) {
    case ContestStatus.CREATED:
      return 'Created';
    case ContestStatus.SUBMISSION:
      return 'Submission';
    case ContestStatus.VOTING:
      return 'Voting';
    case ContestStatus.RESULTS:
      return 'Results';
    case ContestStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}
