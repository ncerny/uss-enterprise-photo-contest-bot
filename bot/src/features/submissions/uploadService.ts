import { randomUUID } from 'node:crypto';
import { TextChannel } from 'discord.js';
import { Contest } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { getStorageBucket } from '../../config/firebaseAdmin';
import { generateImageVariants, ImageVariant } from './imageProcessor';
import { SubmissionCaptureHandler, SubmissionCaptureResult } from './captureService';

export type SubmissionUploadFailureCode = 'PROCESSING_FAILED' | 'UPLOAD_FAILED';

export interface StoredImageVariant {
  bucket: string;
  path: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
}

export interface SubmissionUploadResult {
  contest: Contest;
  channel: TextChannel;
  userId: string;
  messageId: string;
  uploadId: string;
  variants: {
    archive: StoredImageVariant;
    display: StoredImageVariant;
    thumbnail: StoredImageVariant;
  };
  caption?: string;
}

export interface SubmissionUploadFailure {
  contest: Contest;
  channel: TextChannel;
  userId: string;
  messageId: string;
  reason: SubmissionUploadFailureCode;
  detail?: string;
}

export type SubmissionUploadListener = (result: SubmissionUploadResult) => Promise<void> | void;
export type SubmissionUploadFailureListener = (
  failure: SubmissionUploadFailure
) => Promise<void> | void;

export class SubmissionUploadService {
  private readonly bucket = getStorageBucket();
  private readonly successListeners = new Set<SubmissionUploadListener>();
  private readonly failureListeners = new Set<SubmissionUploadFailureListener>();
  private unsubscribeCapture?: () => void;

  constructor(private readonly captureHandler: SubmissionCaptureHandler) {
    this.unsubscribeCapture = this.captureHandler.onCapture((result) =>
      this.handleCapture(result).catch((error) => {
        logger.error('SubmissionUploadService failed to process capture', error as Error, {
          contestId: result.contest.id,
          userId: result.userId,
          messageId: result.messageId,
        });
      })
    );
  }

  stop(): void {
    this.unsubscribeCapture?.();
    this.unsubscribeCapture = undefined;
  }

  onUpload(listener: SubmissionUploadListener): () => void {
    this.successListeners.add(listener);
    return () => this.successListeners.delete(listener);
  }

  onFailure(listener: SubmissionUploadFailureListener): () => void {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  private async handleCapture(result: SubmissionCaptureResult): Promise<void> {
    try {
      const variants = await generateImageVariants(result.buffer, result.mimeType);
      const uploadId = randomUUID();
      const basePath = `submissions/${result.contest.id}/${uploadId}/`;

      const archive = await this.uploadVariant(
        `${basePath}archive.${variants.archive.extension}`,
        variants.archive,
        'private, max-age=0, no-cache'
      );
      const display = await this.uploadVariant(
        `${basePath}display.${variants.display.extension}`,
        variants.display,
        'public,max-age=60,immutable'
      );
      const thumbnail = await this.uploadVariant(
        `${basePath}thumbnail.${variants.thumbnail.extension}`,
        variants.thumbnail,
        'public,max-age=60,immutable'
      );

      await this.dispatchSuccess({
        contest: result.contest,
        channel: result.channel,
        userId: result.userId,
        messageId: result.messageId,
        uploadId,
        variants: {
          archive,
          display,
          thumbnail,
        },
        caption: result.caption,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Submission upload failed', error as Error, {
        contestId: result.contest.id,
        userId: result.userId,
        messageId: result.messageId,
      });
      await this.dispatchFailure({
        contest: result.contest,
        channel: result.channel,
        userId: result.userId,
        messageId: result.messageId,
        reason: 'UPLOAD_FAILED',
        detail,
      });
    }
  }

  private async uploadVariant(
    path: string,
    variant: ImageVariant,
    cacheControl: string
  ): Promise<StoredImageVariant> {
    const file = this.bucket.file(path);
    await file.save(variant.buffer, {
      resumable: false,
      contentType: variant.mimeType,
      metadata: {
        cacheControl,
      },
    });

    return {
      bucket: this.bucket.name,
      path,
      size: variant.size,
      width: variant.width,
      height: variant.height,
      mimeType: variant.mimeType,
    };
  }

  private async dispatchSuccess(result: SubmissionUploadResult): Promise<void> {
    logger.info('Submission uploaded to Firebase Storage', {
      contestId: result.contest.id,
      userId: result.userId,
      messageId: result.messageId,
      uploadId: result.uploadId,
    });

    await Promise.allSettled([...this.successListeners].map((listener) => listener(result)));
  }

  private async dispatchFailure(failure: SubmissionUploadFailure): Promise<void> {
    await Promise.allSettled([...this.failureListeners].map((listener) => listener(failure)));
  }
}
