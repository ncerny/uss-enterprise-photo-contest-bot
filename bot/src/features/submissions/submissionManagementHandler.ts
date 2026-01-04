import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ContestStatus } from '@uss-enterprise/shared';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository, ContestRepository } from '../../repositories';
import { SubmissionDeletionService } from './submissionDeletionService';
import { logger } from '../../logger';

export class SubmissionManagementHandler {
  private readonly submissionRepo = new SubmissionRepository(getFirestoreClient());
  private readonly contestRepo = new ContestRepository(getFirestoreClient());

  constructor(private readonly deletionService: SubmissionDeletionService) {}

  /**
   * Handle button interactions for submission management
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [prefix, action, submissionId] = interaction.customId.split(':');

    if (prefix !== 'submission') {
      return;
    }

    switch (action) {
      case 'edit':
        await this.handleEditButton(interaction, submissionId);
        break;
      case 'withdraw':
        await this.handleWithdrawButton(interaction, submissionId);
        break;
      case 'confirm-withdraw':
        await this.handleConfirmWithdraw(interaction, submissionId);
        break;
      case 'cancel-withdraw':
        await this.handleCancelWithdraw(interaction);
        break;
      default:
        logger.warn('Unknown submission action', { action, submissionId });
    }
  }

  /**
   * Handle modal submissions for caption editing
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('submission:edit-modal:')) {
      return;
    }

    const submissionId = interaction.customId.split(':')[2];
    const newCaption = interaction.fields.getTextInputValue('caption');

    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.reply({
        content: 'This submission no longer exists.',
        ephemeral: true,
      });
      return;
    }

    // Verify contest is still in submission phase
    const contest = await this.contestRepo.getById(submission.contestId);
    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      await interaction.reply({
        content: 'This contest is no longer accepting changes. Submissions are locked.',
        ephemeral: true,
      });
      return;
    }

    await this.submissionRepo.updateCaption(submissionId, newCaption);

    await interaction.reply({
      content: 'Caption updated!',
      ephemeral: true,
    });

    logger.info('Submission caption updated', {
      submissionId,
      userId: interaction.user.id,
    });
  }

  private async handleEditButton(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.reply({
        content: 'This submission no longer exists.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`submission:edit-modal:${submissionId}`)
      .setTitle('Edit Caption');

    const captionInput = new TextInputBuilder()
      .setCustomId('caption')
      .setLabel('Caption')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter a caption for your submission...')
      .setValue(submission.caption || '')
      .setMaxLength(300)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(captionInput)
    );

    await interaction.showModal(modal);
  }

  private async handleWithdrawButton(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.reply({
        content: 'This submission no longer exists.',
        ephemeral: true,
      });
      return;
    }

    // Verify contest is still in submission phase
    const contest = await this.contestRepo.getById(submission.contestId);
    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      await interaction.reply({
        content: 'This contest is no longer accepting changes. Submissions are locked.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: '**Are you sure you want to withdraw this submission?**\n\nThis cannot be undone. You can submit again in the contest channel if the submission period is still open.',
      ephemeral: true,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`submission:confirm-withdraw:${submissionId}`)
            .setLabel('Confirm Withdraw')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('submission:cancel-withdraw:')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  }

  private async handleConfirmWithdraw(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const submission = await this.submissionRepo.getById(submissionId);
    if (!submission) {
      await interaction.update({
        content: 'This submission no longer exists.',
        components: [],
      });
      return;
    }

    // Verify contest is still in submission phase
    const contest = await this.contestRepo.getById(submission.contestId);
    if (!contest || contest.status !== ContestStatus.SUBMISSION) {
      await interaction.update({
        content: 'This contest is no longer accepting changes. Submissions are locked.',
        components: [],
      });
      return;
    }

    await this.deletionService.deleteSubmission(submission, {
      deletedBy: interaction.user.id,
      reason: 'User withdrew submission',
    });

    await interaction.update({
      content: `Submission withdrawn. You can submit again in <#${submission.channelId}> if the submission period is still open.`,
      components: [],
    });

    logger.info('User withdrew submission', {
      submissionId,
      userId: interaction.user.id,
      contestId: submission.contestId,
    });
  }

  private async handleCancelWithdraw(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
      content: 'Withdrawal cancelled.',
      components: [],
    });
  }
}
