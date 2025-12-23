import crypto from 'node:crypto';
import { clearTimeout as clearTimer, setTimeout as setTimer } from 'node:timers';
import { Attachment, TextChannel } from 'discord.js';
import { Contest } from '@uss-enterprise/shared';
import { SubmissionMessageContext, SubmissionMessageHandler } from './messageWatcher';
import { logger } from '../../logger';
import {
  DEFAULT_MAX_FILE_BYTES,
  detectMimeType,
  extractImageMetadata,
  ImageValidationError,
  ensureDimensions as enforceImageDimensions,
  isSupportedImageType,
} from './imageValidation';
import { SUBMISSION_CAPTION_MAX_LENGTH } from './submissionConstraints';

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = 'USS-Enterprise-Photo-Bot/1.0 (+https://github.com/uss-enterprise)';

export type SubmissionCaptureFailureCode =
  | 'NO_ATTACHMENT'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'DOWNLOAD_FAILED'
  | 'MAGIC_BYTES_MISMATCH'
  | 'DIMENSIONS_OUT_OF_RANGE'
  | 'LIMIT_REACHED'
  | 'UNKNOWN';

export interface SubmissionCaptureFailure {
  contest: Contest;
  channel: TextChannel;
  userId: string;
  messageId: string;
  reason: SubmissionCaptureFailureCode;
  detail?: string;
}

export interface SubmissionCaptureResult {
  contest: Contest;
  channel: TextChannel;
  userId: string;
  messageId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  width: number;
  height: number;
  spoiler: boolean;
  sha256: string;
  buffer: Buffer;
  caption?: string;
}

export interface SubmissionCaptureOptions {
  maxFileBytes?: number;
  minWidth?: number;
  minHeight?: number;
  downloadTimeoutMs?: number;
  userAgent?: string;
  limitValidator?: SubmissionLimitValidator;
}

export interface SubmissionLimitValidationResult {
  allowed: boolean;
  detail?: string;
}

export type SubmissionLimitValidator = (
  contest: Contest,
  userId: string
) => Promise<SubmissionLimitValidationResult>;

export type SubmissionCaptureListener = (result: SubmissionCaptureResult) => Promise<void> | void;
export type SubmissionCaptureFailureListener = (
  failure: SubmissionCaptureFailure
) => Promise<void> | void;

class SubmissionCaptureError extends Error {
  constructor(
    public readonly code: SubmissionCaptureFailureCode,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'SubmissionCaptureError';
    if (cause instanceof Error) {
      this.stack = cause.stack;
    }
  }
}

export class SubmissionCaptureHandler implements SubmissionMessageHandler {
  private readonly successListeners = new Set<SubmissionCaptureListener>();
  private readonly failureListeners = new Set<SubmissionCaptureFailureListener>();

  constructor(private readonly options: SubmissionCaptureOptions = {}) {}

  onCapture(listener: SubmissionCaptureListener): () => void {
    this.successListeners.add(listener);
    return () => this.successListeners.delete(listener);
  }

  onFailure(listener: SubmissionCaptureFailureListener): () => void {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  async handleSubmissionMessage(context: SubmissionMessageContext): Promise<void> {
    const { message } = context;
    const candidate = this.selectAttachment(message.attachments.values());

    if (!candidate) {
      await this.notifyFailure(context, 'NO_ATTACHMENT', 'No image attachment found.');
      return;
    }

    try {
      this.ensureSupportedType(candidate);
      this.ensureSizeWithinLimit(candidate);
      const buffer = await this.downloadAttachment(candidate);
      const mimeType = await this.detectMimeType(buffer, candidate.contentType);
      const metadata = await this.extractMetadata(buffer);
      this.ensureImageDimensions(metadata.width, metadata.height);

      if (this.options.limitValidator) {
        const limitResult = await this.options.limitValidator(context.contest, message.author.id);

        if (!limitResult.allowed) {
          await this.notifyFailure(context, 'LIMIT_REACHED', limitResult.detail);
          return;
        }
      }

      const result: SubmissionCaptureResult = {
        contest: context.contest,
        channel: context.channel,
        userId: message.author.id,
        messageId: message.id,
        attachmentId: candidate.id,
        fileName: this.normalizeFileName(candidate.name, mimeType),
        mimeType,
        byteLength: buffer.length,
        width: metadata.width,
        height: metadata.height,
        spoiler: candidate.spoiler ?? false,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        buffer,
        caption: this.extractCaption(message.content),
      };

      await this.dispatchCapture(result);
    } catch (error) {
      if (error instanceof SubmissionCaptureError) {
        await this.notifyFailure(context, error.code, error.message);
        return;
      }

      logger.error('Unexpected submission capture error', error as Error, {
        contestId: context.contest.id,
        channelId: context.channel.id,
        messageId: message.id,
      });
      await this.notifyFailure(context, 'UNKNOWN', 'Unexpected error while processing submission.');
    }
  }

  private selectAttachment(iterator?: IterableIterator<Attachment>): Attachment | null {
    if (!iterator) {
      return null;
    }

    for (const attachment of iterator) {
      if (attachment.size === 0) {
        continue;
      }

      if (isSupportedImageType(attachment.name, attachment.contentType)) {
        return attachment;
      }
    }

    return null;
  }

  private ensureSupportedType(attachment: Attachment): void {
    if (isSupportedImageType(attachment.name, attachment.contentType)) {
      return;
    }

    throw new SubmissionCaptureError('UNSUPPORTED_TYPE', 'Unsupported attachment type.');
  }

  private ensureSizeWithinLimit(attachment: Attachment): void {
    const maxBytes = this.options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

    if (attachment.size > maxBytes) {
      throw new SubmissionCaptureError('FILE_TOO_LARGE', `Attachment exceeds ${maxBytes} bytes.`);
    }
  }

  private async downloadAttachment(attachment: Attachment): Promise<Buffer> {
    const timeoutMs = this.options.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimer(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(attachment.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.options.userAgent ?? DEFAULT_USER_AGENT,
        },
      });

      if (!response.ok) {
        throw new SubmissionCaptureError(
          'DOWNLOAD_FAILED',
          `Discord CDN returned ${response.status}.`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new SubmissionCaptureError('DOWNLOAD_FAILED', 'Downloaded attachment was empty.');
      }

      return buffer;
    } catch (error) {
      if (error instanceof SubmissionCaptureError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new SubmissionCaptureError(
          'DOWNLOAD_FAILED',
          'Attachment download timed out.',
          error
        );
      }

      throw new SubmissionCaptureError('DOWNLOAD_FAILED', 'Failed to download attachment.', error);
    } finally {
      clearTimer(timeout);
    }
  }

  private async detectMimeType(buffer: Buffer, fallback?: string | null): Promise<string> {
    try {
      return await detectMimeType(buffer, fallback);
    } catch (error) {
      if (error instanceof ImageValidationError) {
        throw new SubmissionCaptureError(error.code, error.message, error);
      }

      throw new SubmissionCaptureError('MAGIC_BYTES_MISMATCH', 'Image could not be parsed.', error);
    }
  }

  private extractCaption(content: string | null): string | undefined {
    if (!content) {
      return undefined;
    }

    const trimmed = content.trim();

    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length <= SUBMISSION_CAPTION_MAX_LENGTH) {
      return trimmed;
    }

    return trimmed.slice(0, SUBMISSION_CAPTION_MAX_LENGTH);
  }

  private async extractMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
    try {
      return await extractImageMetadata(buffer);
    } catch (error) {
      if (error instanceof ImageValidationError) {
        throw new SubmissionCaptureError(error.code, error.message, error);
      }

      throw new SubmissionCaptureError('MAGIC_BYTES_MISMATCH', 'Image could not be parsed.', error);
    }
  }

  private ensureImageDimensions(width: number, height: number): void {
    try {
      enforceImageDimensions(width, height, this.options.minWidth, this.options.minHeight);
    } catch (error) {
      if (error instanceof ImageValidationError) {
        throw new SubmissionCaptureError(error.code, error.message, error);
      }

      throw new SubmissionCaptureError(
        'DIMENSIONS_OUT_OF_RANGE',
        'Invalid image dimensions.',
        error
      );
    }
  }

  private normalizeFileName(name: string | null, mimeType: string): string {
    const extension = this.extensionForMime(mimeType);
    const base =
      name
        ?.replace(/[^a-z0-9-_]/gi, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '') || 'submission';
    return `${base}.${extension}`;
  }

  private extensionForMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/heic':
        return 'heic';
      default:
        return 'jpg';
    }
  }

  private async dispatchCapture(result: SubmissionCaptureResult): Promise<void> {
    logger.info('Submission image captured', {
      contestId: result.contest.id,
      userId: result.userId,
      messageId: result.messageId,
      mimeType: result.mimeType,
      byteLength: result.byteLength,
    });

    const listeners = [...this.successListeners];

    await Promise.allSettled(listeners.map((listener) => listener(result)));
  }

  private async notifyFailure(
    context: SubmissionMessageContext,
    reason: SubmissionCaptureFailureCode,
    detail?: string
  ): Promise<void> {
    const payload: SubmissionCaptureFailure = {
      contest: context.contest,
      channel: context.channel,
      userId: context.message.author.id,
      messageId: context.message.id,
      reason,
      detail,
    };

    if (reason !== 'UNKNOWN') {
      logger.debug('Submission capture failed', {
        contestId: context.contest.id,
        channelId: context.channel.id,
        messageId: context.message.id,
        reason,
        detail,
      });
    } else {
      logger.warn('Submission capture failed with unknown error', {
        contestId: context.contest.id,
        channelId: context.channel.id,
        messageId: context.message.id,
        detail,
      });
    }

    const listeners = [...this.failureListeners];
    await Promise.allSettled(listeners.map((listener) => listener(payload)));
  }
}
