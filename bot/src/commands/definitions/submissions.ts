import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { SlashCommandDefinition } from '../types';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository, ContestRepository } from '../../repositories';

const data = new SlashCommandBuilder()
  .setName('submissions')
  .setDescription('View and manage your contest submissions')
  .setDMPermission(true);

export const command: SlashCommandDefinition = {
  data,
  help: {
    usage: '/submissions',
    examples: ['Use /submissions in DM to manage your entries'],
    notes: 'Only works in direct messages with the bot.',
  },
  async execute({ interaction }) {
    // Must be used in DMs
    if (interaction.guild) {
      await interaction.reply({
        content: 'This command only works in direct messages. Please DM me to manage your submissions.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const firestore = getFirestoreClient();
    const submissionRepo = new SubmissionRepository(firestore);
    const contestRepo = new ContestRepository(firestore);

    // Get submissions in active contests (SUBMISSION phase only)
    const submissions = await submissionRepo.getByUserInContestStatuses(
      interaction.user.id,
      [ContestStatus.SUBMISSION]
    );

    if (submissions.length === 0) {
      await interaction.editReply({
        content: "You don't have any submissions in active contests.",
      });
      return;
    }

    // Group by contest and build embeds
    const contestIds = [...new Set(submissions.map((s) => s.contestId))];
    const contests = await Promise.all(
      contestIds.map((id) => contestRepo.getById(id))
    );
    const contestMap = new Map(
      contests.filter(Boolean).map((c) => [c!.id, c!])
    );

    const embeds: EmbedBuilder[] = [];
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    for (const submission of submissions) {
      const contest = contestMap.get(submission.contestId);
      if (!contest) continue;

      const embed = new EmbedBuilder()
        .setTitle(contest.title)
        .setDescription(submission.caption || '_No caption_')
        .setThumbnail(
          `https://firebasestorage.googleapis.com/v0/b/${submission.assets.thumbnail.bucket}/o/${encodeURIComponent(submission.assets.thumbnail.path)}?alt=media`
        )
        .setFooter({
          text: `Submitted ${submission.createdAt.toLocaleDateString()}`,
        })
        .setColor(0x5865f2);

      embeds.push(embed);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`submission:edit:${submission.id}`)
          .setLabel('Edit Caption')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`submission:withdraw:${submission.id}`)
          .setLabel('Withdraw')
          .setStyle(ButtonStyle.Danger)
      );

      components.push(row);
    }

    await interaction.editReply({
      content: `You have **${submissions.length}** submission(s) in active contests:`,
      embeds,
      components,
    });
  },
};

export default command;
