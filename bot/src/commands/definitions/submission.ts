import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { SlashCommandDefinition } from '../types';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository, ContestRepository } from '../../repositories';
import { SubmissionDeletionService } from '../../features/submissions/submissionDeletionService';

const data = new SlashCommandBuilder()
  .setName('submission')
  .setDescription('Manage contest submissions (admin)')
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

data.addSubcommand((subcommand) =>
  subcommand
    .setName('remove')
    .setDescription('Remove a submission from the contest')
    .addStringOption((option) =>
      option
        .setName('submission_id')
        .setDescription('The submission ID to remove')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for removal (sent to the user)')
        .setRequired(true)
        .setMaxLength(500)
    )
);

export const command: SlashCommandDefinition = {
  data,
  guard: {
    guildOnly: true,
    discordPermissions: 'ManageChannels',
  },
  help: {
    usage: '/submission remove <submission_id> <reason>',
    examples: ['/submission remove abc123 "Inappropriate content"'],
    notes: 'Only works during the submission phase. The user will be notified.',
  },
  async execute({ interaction }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== 'remove') {
      await interaction.reply({
        content: 'Unknown subcommand.',
        ephemeral: true,
      });
      return;
    }

    const submissionId = interaction.options.getString('submission_id', true);
    const reason = interaction.options.getString('reason', true);

    await interaction.deferReply({ ephemeral: true });

    const firestore = getFirestoreClient();
    const submissionRepo = new SubmissionRepository(firestore);
    const contestRepo = new ContestRepository(firestore);

    const submission = await submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.editReply({
        content: 'Submission not found. Please check the ID and try again.',
      });
      return;
    }

    const contest = await contestRepo.getById(submission.contestId);
    if (!contest) {
      await interaction.editReply({
        content: 'Contest not found.',
      });
      return;
    }

    // Verify contest is in submission phase
    if (contest.status !== ContestStatus.SUBMISSION) {
      await interaction.editReply({
        content: 'Submissions can only be removed during the submission phase.',
      });
      return;
    }

    // Verify admin is in the same guild as the contest
    if (contest.guildId !== interaction.guildId) {
      await interaction.editReply({
        content: 'This submission belongs to a contest in a different server.',
      });
      return;
    }

    const deletionService = new SubmissionDeletionService(interaction.client);

    await deletionService.deleteSubmission(submission, {
      deletedBy: interaction.user.id,
      reason,
      isAdminAction: true,
    });

    // Notify the user
    await deletionService.notifyUserOfAdminRemoval(
      submission.userId,
      contest.title,
      reason
    );

    await interaction.editReply({
      content: `Submission removed. The user has been notified.\n\n**Submission ID:** ${submissionId}\n**Reason:** ${reason}`,
    });
  },
};

export default command;
