import { Client, TextChannel } from 'discord.js';
import { Submission, SubmissionAssetSet } from '@uss-enterprise/shared';
import { getStorageBucket, getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository } from '../../repositories';
import { logger } from '../../logger';

export interface DeletionOptions {
  /** Reason for deletion (for logging and DM) */
  reason?: string;
  /** Discord user ID who initiated the deletion */
  deletedBy?: string;
  /** Whether this is an admin action */
  isAdminAction?: boolean;
}

export class SubmissionDeletionService {
  private readonly bucket = getStorageBucket();
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());

  constructor(private readonly client: Client) {}

  /**
   * Delete a submission completely: Firestore record, Storage assets, Discord message
   */
  async deleteSubmission(submission: Submission, options: DeletionOptions = {}): Promise<void> {
    const { reason, deletedBy, isAdminAction } = options;

    logger.info('Deleting submission', {
      submissionId: submission.id,
      contestId: submission.contestId,
      userId: submission.userId,
      deletedBy,
      isAdminAction,
      reason,
    });

    // Delete from Firestore first (source of truth)
    await this.submissionRepository.delete(submission.id);

    // Delete storage assets (best effort, don't fail if already gone)
    await this.deleteStorageAssets(submission.assets);

    // Delete Discord message (best effort)
    await this.deleteDiscordMessage(
      submission.guildId,
      submission.channelId,
      submission.sourceMessageId
    );

    logger.info('Submission deleted successfully', {
      submissionId: submission.id,
    });
  }

  /**
   * Delete all image variants from Firebase Storage
   */
  private async deleteStorageAssets(assets: SubmissionAssetSet): Promise<void> {
    const paths = [assets.archive.path, assets.display.path, assets.thumbnail.path];

    const results = await Promise.allSettled(
      paths.map((path) =>
        this.bucket.file(path).delete().catch((error) => {
          // Ignore "not found" errors - file may already be deleted
          if (error.code !== 404) {
            throw error;
          }
        })
      )
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some storage assets failed to delete', {
        failureCount: failures.length,
        paths,
      });
    }
  }

  /**
   * Delete the original Discord message
   */
  private async deleteDiscordMessage(
    guildId: string,
    channelId: string,
    messageId: string
  ): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        logger.warn('Could not find text channel for message deletion', { channelId });
        return;
      }

      const message = await (channel as TextChannel).messages.fetch(messageId);
      await message.delete();

      logger.debug('Deleted Discord message', { messageId });
    } catch (error) {
      // Don't fail if message is already gone or bot lacks permissions
      const err = error as Error & { code?: number };
      if (err.code === 10008) {
        // Unknown Message - already deleted
        logger.debug('Discord message already deleted', { messageId });
      } else {
        logger.warn('Could not delete Discord message', {
          messageId,
          error: err.message,
        });
      }
    }
  }

  /**
   * Send DM to user about their submission being removed by admin
   */
  async notifyUserOfAdminRemoval(
    userId: string,
    contestTitle: string,
    reason: string
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      await user.send({
        content: [
          `Your submission to **${contestTitle}** was removed by a moderator.`,
          `**Reason:** ${reason}`,
          '',
          'You may submit a new entry if the submission period is still open.',
        ].join('\n'),
      });
    } catch (error) {
      // User may have DMs disabled
      logger.warn('Could not DM user about submission removal', {
        userId,
        error: (error as Error).message,
      });
    }
  }
}
