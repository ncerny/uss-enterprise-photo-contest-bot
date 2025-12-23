import {
  ChannelType,
  DiscordAPIError,
  Guild,
  ModalSubmitInteraction,
  OverwriteResolvable,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  TextChannel,
} from 'discord.js';
import { Contest, ContestStatus } from '@uss-enterprise/shared';
import { ContestCreationInput } from './modal';
import { ContestRepository } from '../../repositories';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { CommandExecutionError, CommandValidationError } from '../../commands/errors';
import { logger } from '../../logger';
import { postContestWelcomeMessage } from './welcomeMessage';
import { transitionContest } from './stateMachine';

const MAX_CHANNEL_NAME_LENGTH = 95;
const MAX_NAME_ATTEMPTS = 25;
const STATUS_LABELS: Record<ContestStatus, string> = {
  [ContestStatus.CREATED]: 'Created',
  [ContestStatus.SUBMISSION]: 'Submission',
  [ContestStatus.VOTING]: 'Voting',
  [ContestStatus.RESULTS]: 'Results',
  [ContestStatus.CANCELLED]: 'Cancelled',
};

const contestRepository = new ContestRepository(getFirestoreClient());

export async function startContestCreationFlow(
  interaction: ModalSubmitInteraction,
  input: ContestCreationInput
): Promise<void> {
  if (!interaction.guildId) {
    throw new CommandValidationError('Contest creation is only available inside a server.');
  }

  const guild = interaction.guild ?? (await interaction.client.guilds.fetch(interaction.guildId));

  if (!guild) {
    throw new CommandExecutionError('Unable to resolve guild context for contest creation.');
  }

  const channelName = generateUniqueChannelName(guild, getContestChannelSlug(input.title));
  const channel = await createContestChannel(guild, channelName, interaction.user.tag);

  const now = new Date();
  const contest = await contestRepository.create({
    title: input.title,
    description: input.description,
    channelId: channel.id,
    guildId: guild.id,
    submissionDeadline: input.submissionDeadline,
    votingDeadline: input.votingDeadline,
    maxSubmissionsPerUser: input.maxSubmissionsPerUser,
    maxVotesPerUser: input.maxVotesPerUser,
    numberOfWinners: input.numberOfWinners,
    status: ContestStatus.CREATED,
    createdAt: now,
    createdBy: interaction.user.id,
    submissionCount: 0,
    statusHistory: [
      {
        status: ContestStatus.CREATED,
        changedAt: now,
        changedBy: interaction.user.id,
      },
    ],
  });

  const contestRecord: Contest = {
    ...contest,
    submissionCount: contest.submissionCount ?? 0,
    statusHistory: contest.statusHistory ?? [],
  };

  const welcomeMessage = await postContestWelcomeMessage(channel, contestRecord);
  await contestRepository.update(contest.id, { welcomeMessageId: welcomeMessage.id });

  const finalizedContest: Contest = {
    ...contestRecord,
    welcomeMessageId: welcomeMessage.id,
  };

  const submissionContest = await transitionContest(finalizedContest, ContestStatus.SUBMISSION, {
    actorId: interaction.user.id,
    channel,
    reason: 'Contest initialized',
  });

  logger.info(
    `Created contest ${contest.id} in guild ${guild.id} with channel ${channel.id} (${channel.name}).`
  );

  await interaction.editReply({
    content: buildContestCreationSummary(submissionContest, channel),
  });
}

export function getContestChannelSlug(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const trimmed = sanitized.slice(0, MAX_CHANNEL_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : 'photo-contest';
}

function generateUniqueChannelName(guild: Guild, base: string): string {
  const existingNames = new Set(
    guild.channels.cache
      .filter((channel) => channel.type === ChannelType.GuildText)
      .map((channel) => channel.name)
  );

  if (!existingNames.has(base)) {
    return base;
  }

  for (let attempt = 2; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
    const suffix = `-${attempt}`;
    const adjustedBase = base.slice(0, Math.max(1, MAX_CHANNEL_NAME_LENGTH - suffix.length));
    const candidate = `${adjustedBase}${suffix}`;

    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  throw new CommandExecutionError(
    'Unable to find an available channel name. Please rename the contest and try again.'
  );
}

async function createContestChannel(
  guild: Guild,
  channelName: string,
  requestedBy: string
): Promise<TextChannel> {
  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      reason: `Photo contest created by ${requestedBy}`,
      permissionOverwrites: buildPermissionOverwrites(guild),
    });

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new CommandExecutionError('Contest channel was created with an unexpected type.');
    }

    return channel as TextChannel;
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) {
      throw new CommandValidationError(
        'I need the Manage Channels permission to create the contest channel. Please adjust my role and try again.'
      );
    }

    throw new CommandExecutionError('Failed to create the contest channel.', error);
  }
}

function buildPermissionOverwrites(guild: Guild): OverwriteResolvable[] {
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.roles.everyone,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
      ],
    },
  ];

  const botUserId = guild.client.user?.id;
  if (botUserId) {
    overwrites.push({
      id: botUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  return overwrites;
}

function buildContestCreationSummary(contest: Contest, channel: TextChannel): string {
  return [
    '✅ Contest created successfully.',
    `• Channel: ${channel}`,
    `• Contest ID: ${contest.id}`,
    `• Current phase: ${STATUS_LABELS[contest.status] ?? contest.status}`,
    `• Submission deadline: ${formatDate(contest.submissionDeadline)}`,
    `• Voting deadline: ${formatDate(contest.votingDeadline)}`,
    `• Limits: ${contest.maxSubmissionsPerUser} submissions, ${contest.maxVotesPerUser} votes, ${contest.numberOfWinners} winners`,
    contest.welcomeMessageId ? `• Welcome message pinned in ${channel}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatDate(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}
