import { Firestore, CollectionReference } from 'firebase-admin/firestore';
import { Vote, VoteData, Collections } from '@uss-enterprise/shared';

/**
 * Repository for Vote operations
 */
export class VoteRepository {
  private collection: CollectionReference;

  constructor(private firestore: Firestore) {
    this.collection = firestore.collection(Collections.VOTES);
  }

  /**
   * Create a new vote
   */
  async create(data: VoteData): Promise<Vote> {
    const docRef = await this.collection.add({
      ...data,
      createdAt: new Date(),
    });

    return {
      id: docRef.id,
      ...data,
    };
  }

  /**
   * Get vote by ID
   */
  async getById(id: string): Promise<Vote | null> {
    const doc = await this.collection.doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Vote;
  }

  /**
   * Get all votes for a contest
   */
  async getByContestId(contestId: string): Promise<Vote[]> {
    const snapshot = await this.collection.where('contestId', '==', contestId).get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Vote[];
  }

  /**
   * Get votes by voter for a contest
   */
  async getByVoterAndContest(voterId: string, contestId: string): Promise<Vote[]> {
    const snapshot = await this.collection
      .where('contestId', '==', contestId)
      .where('voterId', '==', voterId)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Vote[];
  }

  /**
   * Count votes by voter for a contest
   */
  async countByVoterAndContest(voterId: string, contestId: string): Promise<number> {
    const snapshot = await this.collection
      .where('contestId', '==', contestId)
      .where('voterId', '==', voterId)
      .count()
      .get();

    return snapshot.data().count;
  }

  /**
   * Get votes for a specific submission
   */
  async getBySubmissionId(submissionId: string): Promise<Vote[]> {
    const snapshot = await this.collection.where('submissionId', '==', submissionId).get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Vote[];
  }

  /**
   * Count votes for a submission
   */
  async countBySubmissionId(submissionId: string): Promise<number> {
    const snapshot = await this.collection.where('submissionId', '==', submissionId).count().get();

    return snapshot.data().count;
  }

  /**
   * Check if user has voted for a specific submission
   */
  async hasVoted(voterId: string, submissionId: string): Promise<boolean> {
    const snapshot = await this.collection
      .where('voterId', '==', voterId)
      .where('submissionId', '==', submissionId)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  /**
   * Delete vote
   */
  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }

  /**
   * Delete vote by voter and submission (for unvoting)
   */
  async deleteByVoterAndSubmission(voterId: string, submissionId: string): Promise<void> {
    const snapshot = await this.collection
      .where('voterId', '==', voterId)
      .where('submissionId', '==', submissionId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
  }

  /**
   * Get vote count grouped by submission for a contest
   */
  async getVoteCountsByContest(contestId: string): Promise<Map<string, number>> {
    const votes = await this.getByContestId(contestId);
    const counts = new Map<string, number>();

    for (const vote of votes) {
      const current = counts.get(vote.submissionId) || 0;
      counts.set(vote.submissionId, current + 1);
    }

    return counts;
  }
}
