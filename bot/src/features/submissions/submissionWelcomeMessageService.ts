import { logger } from '../../logger';
import {
  SubmissionCreatedEvent,
  SubmissionPersistenceService,
} from './submissionPersistenceService';
import { updateContestWelcomeMessage } from '../contestCreation/welcomeMessage';

export class SubmissionWelcomeMessageService {
  private unsubscribe?: () => void;

  constructor(private readonly persistenceService: SubmissionPersistenceService) {
    this.unsubscribe = this.persistenceService.onCreated((event) =>
      this.handleSubmissionCreated(event).catch((error) => {
        logger.warn('Failed to refresh contest welcome message after submission', error as Error, {
          contestId: event.contest.id,
          channelId: event.channel.id,
          submissionId: event.submission.id,
        });
      })
    );
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private async handleSubmissionCreated(event: SubmissionCreatedEvent): Promise<void> {
    if (!event.contest.welcomeMessageId) {
      return;
    }

    await updateContestWelcomeMessage(event.channel, event.contest);
  }
}
