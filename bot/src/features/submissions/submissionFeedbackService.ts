import { Client, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { logger } from '../../logger';
import { SubmissionCaptureFailure, SubmissionCaptureHandler } from './captureService';
import { SubmissionUploadFailure, SubmissionUploadService } from './uploadService';
import {
  SubmissionCreatedEvent,
  SubmissionPersistenceService,
} from './submissionPersistenceService';

const CAPTURE_FAILURE_MESSAGES: Record<SubmissionCaptureFailure['reason'], string> = {
  NO_ATTACHMENT: 'Please attach an image file to your message.',
  UNSUPPORTED_TYPE:
    'That file type is not supported. Please upload a JPEG, PNG, WebP, or HEIC photo.',
  FILE_TOO_LARGE:
    'The file exceeds the contest size limit. Try compressing it before resubmitting.',
  DOWNLOAD_FAILED: 'We could not download the image from Discord. Please try again.',
  MAGIC_BYTES_MISMATCH:
    'The file did not look like a valid image. Please export it as a standard photo format.',
  DIMENSIONS_OUT_OF_RANGE: 'The image is too small. Please submit a photo at least 256x256 pixels.',
  LIMIT_REACHED:
    'You have already submitted the maximum number of photos allowed for this contest.',
  UNKNOWN: 'An unexpected error occurred while processing your photo.',
};

export class SubmissionFeedbackService {
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly client: Client,
    private readonly captureHandler: SubmissionCaptureHandler,
    private readonly uploadService: SubmissionUploadService,
    private readonly persistenceService: SubmissionPersistenceService
  ) {
    this.disposers.push(
      this.captureHandler.onFailure((failure) =>
        this.handleCaptureFailure(failure).catch((error) => {
          logger.error('SubmissionFeedbackService capture failure handler error', error as Error, {
            userId: failure.userId,
          });
        })
      )
    );
    this.disposers.push(
      this.uploadService.onFailure((failure) =>
        this.handleUploadFailure(failure).catch((error) => {
          logger.error('SubmissionFeedbackService upload failure handler error', error as Error, {
            userId: failure.userId,
          });
        })
      )
    );
    this.disposers.push(
      this.persistenceService.onCreated((event) =>
        this.handleSubmissionSuccess(event).catch((error) => {
          logger.error('SubmissionFeedbackService success handler error', error as Error, {
            submissionId: event.submission.id,
          });
        })
      )
    );
  }

  stop(): void {
    while (this.disposers.length > 0) {
      const dispose = this.disposers.pop();
      dispose?.();
    }
  }

  private async handleCaptureFailure(failure: SubmissionCaptureFailure): Promise<void> {
    const baseMessage =
      CAPTURE_FAILURE_MESSAGES[failure.reason] ?? CAPTURE_FAILURE_MESSAGES.UNKNOWN;
    const detailSuffix = failure.detail ? `\nDetails: ${failure.detail}` : '';

    const message = [
      '❌ We could not accept your photo submission.',
      `Contest: ${failure.contest.title}`,
      `Reason: ${baseMessage}`,
      detailSuffix,
    ]
      .filter(Boolean)
      .join('\n');

    await this.dmUser(failure.userId, message);
  }

  private async handleUploadFailure(failure: SubmissionUploadFailure): Promise<void> {
    const message = [
      '⚠️ Your photo upload did not complete successfully.',
      `Contest: ${failure.contest.title}`,
      failure.detail ? `Details: ${failure.detail}` : 'Please try sending the photo again shortly.',
    ].join('\n');

    await this.dmUser(failure.userId, message);
  }

  private async handleSubmissionSuccess(event: SubmissionCreatedEvent): Promise<void> {
    const message = [
      '✅ Thanks! Your photo has been received.',
      `Contest: ${event.contest.title}`,
      `Submission ID: ${event.submission.id}`,
      `You can submit up to ${event.contest.maxSubmissionsPerUser} photo(s) during this contest.`,
    ].join('\n');

    await this.dmUser(event.submission.userId, message);
  }

  private async dmUser(userId: string, content: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);

      if (!user) {
        logger.warn('Unable to fetch user for submission feedback DM', { userId });
        return;
      }

      await user.send({ content });
    } catch (error) {
      if (error instanceof DiscordAPIError) {
        if (error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
          logger.warn('User has DMs disabled; unable to send submission feedback', {
            userId,
          });
          return;
        }
      }

      logger.error('Failed to send submission feedback DM', error as Error, { userId });
    }
  }
}
