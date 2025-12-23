import { Contest } from '@uss-enterprise/shared';
import { getFirestoreClient } from '../../config/firebaseAdmin';
import { SubmissionRepository } from '../../repositories';
import { SubmissionLimitValidationResult } from './captureService';

export class SubmissionLimitService {
  private readonly submissionRepository = new SubmissionRepository(getFirestoreClient());

  async validateLimit(contest: Contest, userId: string): Promise<SubmissionLimitValidationResult> {
    const max = contest.maxSubmissionsPerUser;

    if (max <= 0) {
      return { allowed: true };
    }

    const currentCount = await this.submissionRepository.countByUserAndContest(userId, contest.id);

    if (currentCount >= max) {
      return {
        allowed: false,
        detail: `You have already submitted ${currentCount} photo(s), which is the contest limit.`,
      };
    }

    return {
      allowed: true,
    };
  }
}
