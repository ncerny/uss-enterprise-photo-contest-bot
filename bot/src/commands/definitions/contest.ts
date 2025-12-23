import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { SlashCommandDefinition } from '../types';
import { buildContestCreationModal } from '../../features/contestCreation/modal';
import {
  handleContestCancel,
  handleContestClose,
  handleContestResume,
} from '../../features/contestCreation/adminCommands';

const data = new SlashCommandBuilder();

data
  .setName('contest')
  .setDescription('Manage photo contests on this server.')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

data.addSubcommand((subcommand) =>
  subcommand.setName('create').setDescription('Launch the contest creation flow for admins.')
);

data.addSubcommand((subcommand) =>
  subcommand
    .setName('close')
    .setDescription('Manually move the contest to the next phase.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Contest text channel (defaults to current).')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Optional reason to log with the transition.')
        .setMaxLength(200)
    )
    .addBooleanOption((option) =>
      option.setName('confirm').setDescription('Set true to run the close command.')
    )
);

data.addSubcommand((subcommand) =>
  subcommand
    .setName('cancel')
    .setDescription('Pause contest activity until resumed.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Contest text channel (defaults to current).')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Optional reason to log with the cancellation.')
        .setMaxLength(200)
    )
    .addBooleanOption((option) =>
      option.setName('confirm').setDescription('Set true to cancel the contest.')
    )
);

data.addSubcommand((subcommand) =>
  subcommand
    .setName('resume')
    .setDescription('Resume a cancelled contest and return to the right phase.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Contest text channel (defaults to current).')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Optional reason to log when resuming.')
        .setMaxLength(200)
    )
);

export const command: SlashCommandDefinition = {
  data,
  guard: {
    guildOnly: true,
    discordPermissions: 'ManageChannels',
  },
  help: {
    usage: '/contest create',
    examples: ['Use /contest create to launch a new themed contest.'],
    notes: 'Only members with Manage Channel permissions can run this command.',
  },
  throttle: {
    limit: 3,
    windowMs: 60_000,
    scope: 'user',
    message: 'Contest admin actions are rate limited. Please wait a moment and try again.',
  },
  async execute({ interaction }) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await interaction.showModal(buildContestCreationModal());
        return;
      case 'close':
        await handleContestClose(interaction);
        return;
      case 'cancel':
        await handleContestCancel(interaction);
        return;
      case 'resume':
        await handleContestResume(interaction);
        return;
      default:
        await interaction.reply({
          content: 'That contest subcommand is not available yet.',
          ephemeral: true,
        });
        return;
    }
  },
};

export default command;
