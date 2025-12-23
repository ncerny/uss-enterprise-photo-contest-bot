import {
  ActionRowBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import * as chrono from 'chrono-node';
import { CommandExecutionError, CommandValidationError } from '../../commands/errors';
import { logger } from '../../logger';
import { startContestCreationFlow } from './service';

const CONTEST_CREATION_MODAL_ID = 'contest-create-modal';

const FIELD_IDS = {
  title: 'contest-title',
  description: 'contest-description',
  submissionDeadline: 'contest-submission-deadline',
  votingDeadline: 'contest-voting-deadline',
  limits: 'contest-limits',
} as const;

const DEFAULT_LIMITS_VALUE = '2,2,3';
const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MIN_SUBMISSION_LEAD_MINUTES = 5;

export interface ContestCreationInput {
  title: string;
  description: string;
  submissionDeadline: Date;
  votingDeadline: Date;
  maxSubmissionsPerUser: number;
  maxVotesPerUser: number;
  numberOfWinners: number;
}

export function buildContestCreationModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(CONTEST_CREATION_MODAL_ID)
    .setTitle('Create Contest')
    .addComponents(
      buildRow(
        new TextInputBuilder()
          .setCustomId(FIELD_IDS.title)
          .setLabel('Contest title')
          .setPlaceholder('Summer Sunset Challenge')
          .setMinLength(MIN_TITLE_LENGTH)
          .setMaxLength(MAX_TITLE_LENGTH)
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      ),
      buildRow(
        new TextInputBuilder()
          .setCustomId(FIELD_IDS.description)
          .setLabel('Description and rules')
          .setPlaceholder('Share the theme, rules, and what judges are looking for.')
          .setMaxLength(MAX_DESCRIPTION_LENGTH)
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
      ),
      buildRow(
        new TextInputBuilder()
          .setCustomId(FIELD_IDS.submissionDeadline)
          .setLabel('Submission deadline (date & time)')
          .setPlaceholder('July 4 5pm PT or 2025-07-04T17:00-07:00')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      ),
      buildRow(
        new TextInputBuilder()
          .setCustomId(FIELD_IDS.votingDeadline)
          .setLabel('Voting deadline (date & time)')
          .setPlaceholder('July 8 5pm PT or 2025-07-08T17:00-07:00')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      ),
      buildRow(
        new TextInputBuilder()
          .setCustomId(FIELD_IDS.limits)
          .setLabel('Limits (submissions,votes,winners)')
          .setPlaceholder('2,2,3')
          .setRequired(true)
          .setValue(DEFAULT_LIMITS_VALUE)
          .setStyle(TextInputStyle.Short)
      )
    );

  return modal;
}

export async function handleContestCreationModal(
  interaction: ModalSubmitInteraction
): Promise<boolean> {
  if (interaction.customId !== CONTEST_CREATION_MODAL_ID) {
    return false;
  }

  let deferred = false;

  try {
    const input = parseContestCreationSubmission(interaction);
    await interaction.deferReply({ ephemeral: true });
    deferred = true;
    await startContestCreationFlow(interaction, input);
  } catch (error) {
    const message =
      error instanceof CommandValidationError
        ? `Unable to process your contest details: ${error.message}`
        : error instanceof CommandExecutionError
          ? `Contest creation failed: ${error.message}`
          : 'An unexpected error occurred while validating your contest. Please try again.';

    if (!(error instanceof CommandValidationError)) {
      logger.error('Contest creation modal failed', error as Error);
    }

    if (deferred) {
      await interaction.editReply({ content: message });
      return true;
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }

  return true;
}

function parseContestCreationSubmission(interaction: ModalSubmitInteraction): ContestCreationInput {
  const title = interaction.fields.getTextInputValue(FIELD_IDS.title).trim();
  const description = interaction.fields.getTextInputValue(FIELD_IDS.description).trim();
  const submissionDeadlineRaw = interaction.fields
    .getTextInputValue(FIELD_IDS.submissionDeadline)
    .trim();
  const votingDeadlineRaw = interaction.fields.getTextInputValue(FIELD_IDS.votingDeadline).trim();
  const limitsRaw = interaction.fields.getTextInputValue(FIELD_IDS.limits).trim();

  validateTitle(title);
  validateDescription(description);

  const submissionDeadline = parseDateInput(
    submissionDeadlineRaw,
    'Submission deadline must be a valid date/time (example: "July 4 5pm PT" or 2025-07-04T17:00-07:00).'
  );
  const votingDeadline = parseDateInput(
    votingDeadlineRaw,
    'Voting deadline must be a valid date/time (example: "July 8 5pm PT" or 2025-07-08T17:00-07:00).',
    submissionDeadline
  );

  enforceDeadlineOrdering(submissionDeadline, votingDeadline);

  const limits = parseLimits(limitsRaw);

  return {
    title,
    description,
    submissionDeadline,
    votingDeadline,
    ...limits,
  };
}

function validateTitle(title: string): void {
  if (title.length < MIN_TITLE_LENGTH) {
    throw new CommandValidationError('Contest title must be at least 3 characters.');
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw new CommandValidationError('Contest title must be 100 characters or fewer.');
  }
}

function validateDescription(description: string): void {
  if (description.length === 0) {
    throw new CommandValidationError('Contest description is required.');
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new CommandValidationError('Contest description must be 2,000 characters or fewer.');
  }
}

function parseDateInput(value: string, errorMessage: string, referenceDate?: Date): Date {
  const parsed = parseFlexibleDate(value, referenceDate ?? new Date());

  if (!parsed) {
    throw new CommandValidationError(errorMessage);
  }

  const leadTimeMs = MIN_SUBMISSION_LEAD_MINUTES * 60 * 1000;
  const now = Date.now();

  if (parsed.getTime() < now + leadTimeMs) {
    throw new CommandValidationError(
      `All deadlines must be at least ${MIN_SUBMISSION_LEAD_MINUTES} minutes in the future.`
    );
  }

  return parsed;
}

function parseFlexibleDate(value: string, referenceDate: Date): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const normalized = normalizeIsoLikeInput(trimmed);

  if (normalized) {
    const isoDate = new Date(normalized);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  const chronoDate = chrono.parseDate(trimmed, referenceDate, { forwardDate: true });
  return chronoDate ?? null;
}

function normalizeIsoLikeInput(value: string): string | null {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(value)) {
    return value.replace(' ', 'T');
  }

  return value;
}

function enforceDeadlineOrdering(submission: Date, voting: Date): void {
  if (voting.getTime() <= submission.getTime()) {
    throw new CommandValidationError('Voting deadline must be after the submission deadline.');
  }
}

function parseLimits(
  limitsRaw: string
): Omit<ContestCreationInput, 'title' | 'description' | 'submissionDeadline' | 'votingDeadline'> {
  const tokens = limitsRaw
    .split(/[\s,/]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (tokens.length !== 3) {
    throw new CommandValidationError(
      'Limits must include submissions, votes, and winners (example: 2,2,3).'
    );
  }

  const [maxSubmissionsPerUser, maxVotesPerUser, numberOfWinners] = tokens.map((token) => {
    const parsed = Number.parseInt(token, 10);
    if (Number.isNaN(parsed)) {
      throw new CommandValidationError('Contest limits must be whole numbers.');
    }
    return parsed;
  });

  validateRange(maxSubmissionsPerUser, 1, 10, 'Max submissions per user must be between 1 and 10.');
  validateRange(maxVotesPerUser, 1, 20, 'Max votes per user must be between 1 and 20.');
  validateRange(numberOfWinners, 1, 10, 'Number of winners must be between 1 and 10.');

  return { maxSubmissionsPerUser, maxVotesPerUser, numberOfWinners };
}

function validateRange(value: number, min: number, max: number, message: string): void {
  if (value < min || value > max) {
    throw new CommandValidationError(message);
  }
}

function buildRow(component: TextInputBuilder): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(component);
}

export { CONTEST_CREATION_MODAL_ID };
