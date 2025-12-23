import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { logger } from '../../logger';
import {
  SubmissionCreatedEvent,
  SubmissionPersistenceService,
} from './submissionPersistenceService';

export class SubmissionMessageCleanupService {
  private unsubscribe?: () => void;

  constructor(private readonly persistenceService: SubmissionPersistenceService) {
    this.unsubscribe = this.persistenceService.onCreated((event) =>
      this.handleSubmission(event).catch((error) => {
        logger.error('Failed to delete submission source message', error as Error, {
          contestId: event.contest.id,
          channelId: event.channel.id,
          messageId: event.submission.sourceMessageId,
        });
      })
    );
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private async handleSubmission(event: SubmissionCreatedEvent): Promise<void> {
    const { channel, submission, contest } = event;
    const messageId = submission.sourceMessageId;

    try {
      const message =
        channel.messages.cache.get(messageId) ?? (await channel.messages.fetch(messageId));
      await message.delete();
      logger.info('Deleted submission message after capture', {
        contestId: contest.id,
        channelId: channel.id,
        messageId,
      });
    } catch (error) {
      if (error instanceof DiscordAPIError) {
        if (error.code === RESTJSONErrorCodes.UnknownMessage) {
          logger.warn('Submission message already deleted before cleanup', {
            contestId: contest.id,
            channelId: channel.id,
            messageId,
          });
          return;
        }

        if (
          error.code === RESTJSONErrorCodes.MissingPermissions ||
          error.code === RESTJSONErrorCodes.MissingAccess
        ) {
          logger.error('Bot lacks permission to delete submission message', error, {
            contestId: contest.id,
            channelId: channel.id,
            messageId,
          });
          return;
        }
      }

      throw error;
    }
  }
}
