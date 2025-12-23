import { TextChannel } from 'discord.js';
import { Contest, ContestStatus, ContestStatusChange } from '@uss-enterprise/shared';
import { CommandValidationError } from '../../commands/errors';
import { ContestRepository } from '../../repositories';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { logger } from '../../logger';
import { updateContestWelcomeMessage } from './welcomeMessage';

const ALLOWED_TRANSITIONS: Record<ContestStatus, ContestStatus[]> = {
  [ContestStatus.CREATED]: [ContestStatus.SUBMISSION, ContestStatus.CANCELLED],
  [ContestStatus.SUBMISSION]: [ContestStatus.VOTING, ContestStatus.CANCELLED],
  [ContestStatus.VOTING]: [ContestStatus.RESULTS, ContestStatus.CANCELLED],
  [ContestStatus.RESULTS]: [],
  [ContestStatus.CANCELLED]: [ContestStatus.SUBMISSION],
};

export interface TransitionOptions {
  actorId?: string;
  channel?: TextChannel;
  reason?: string;
  announcement?: string;
}

const contestRepository = new ContestRepository(getFirestoreClient());

export async function transitionContest(
  contest: Contest,
  targetStatus: ContestStatus,
  options: TransitionOptions = {}
): Promise<Contest> {
  if (!canTransition(contest.status, targetStatus)) {
    throw new CommandValidationError(
      `Contest cannot transition from ${contest.status} to ${targetStatus}.`
    );
  }

  const historyEntry: ContestStatusChange = {
    status: targetStatus,
    changedAt: new Date(),
    changedBy: options.actorId,
  };

  const statusHistory = [...(contest.statusHistory ?? []), historyEntry];

  await contestRepository.update(contest.id, {
    status: targetStatus,
    statusHistory,
  });

  const updatedContest: Contest = {
    ...contest,
    status: targetStatus,
    statusHistory,
  };

  if (options.channel) {
    await updateContestWelcomeMessage(options.channel, updatedContest);
    if (options.announcement) {
      await options.channel.send({ content: options.announcement });
    }
  }

  logger.info(
    `Contest ${contest.id} transitioned from ${contest.status} to ${targetStatus}.`,
    options.reason ? { reason: options.reason } : undefined
  );

  return updatedContest;
}

export function canTransition(current: ContestStatus, next: ContestStatus): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}
