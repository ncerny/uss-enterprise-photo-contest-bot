import { TextChannel } from 'discord.js';
import { Contest, Submission } from '@uss-enterprise/shared';
import { logger } from '../../logger';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { ContestRepository, SubmissionRepository } from '../../repositories';
import { SubmissionUploadService, SubmissionUploadResult } from './uploadService';

export interface SubmissionCreatedEvent {
  submission: Submission;
  contest: Contest;
  channel: TextChannel;
}

export type SubmissionCreatedListener = (event: SubmissionCreatedEvent) => Promise<void> | void;

export class SubmissionPersistenceService {
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());
  private readonly contestRepository = new ContestRepository(getFirestoreClient());
  private readonly listeners = new Set<SubmissionCreatedListener>();
  private unsubscribeUpload?: () => void;

  constructor(private readonly uploadService: SubmissionUploadService) {
    this.unsubscribeUpload = this.uploadService.onUpload((result) =>
      this.persistSubmission(result).catch((error) => {
        logger.error('Failed to persist submission record', error as Error, {
          contestId: result.contest.id,
          userId: result.userId,
          messageId: result.messageId,
        });
      })
    );
  }

  stop(): void {
    this.unsubscribeUpload?.();
    this.unsubscribeUpload = undefined;
  }

  onCreated(listener: SubmissionCreatedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async persistSubmission(result: SubmissionUploadResult): Promise<void> {
    const now = new Date();

    const submission = await this.submissionRepository.create({
      contestId: result.contest.id,
      guildId: result.contest.guildId,
      channelId: result.contest.channelId,
      userId: result.userId,
      assets: result.variants,
      uploadId: result.uploadId,
      sourceMessageId: result.messageId,
      caption: result.caption,
      createdAt: now,
    });

    await this.contestRepository.incrementSubmissionCount(result.contest.id);
    const updatedContest =
      (await this.contestRepository.getById(result.contest.id)) ?? result.contest;

    logger.info('Submission record created in Firestore', {
      contestId: result.contest.id,
      submissionId: submission.id,
      userId: result.userId,
    });

    await Promise.allSettled(
      [...this.listeners].map((listener) =>
        listener({
          submission,
          contest: updatedContest,
          channel: result.channel,
        })
      )
    );
  }
}
