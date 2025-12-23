import {
  Firestore,
  CollectionReference,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { Submission, SubmissionData, Collections } from '@uss-enterprise/shared';

/**
 * Repository for Submission operations
 */
export class SubmissionRepository {
  private collection: CollectionReference;

  constructor(private firestore: Firestore) {
    this.collection = firestore.collection(Collections.SUBMISSIONS);
  }

  /**
   * Create a new submission
   */
  async create(data: SubmissionData): Promise<Submission> {
    const payload = {
      ...data,
      createdAt: data.createdAt ?? new Date(),
    };

    const docRef = await this.collection.add(payload);
    const snapshot = await docRef.get();
    return this.deserializeSubmission(snapshot);
  }

  /**
   * Get submission by ID
   */
  async getById(id: string): Promise<Submission | null> {
    const doc = await this.collection.doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return this.deserializeSubmission(doc);
  }

  /**
   * Get all submissions for a contest
   */
  async getByContestId(contestId: string): Promise<Submission[]> {
    const snapshot = await this.collection
      .where('contestId', '==', contestId)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => this.deserializeSubmission(doc));
  }

  /**
   * Get submissions by user for a contest
   */
  async getByUserAndContest(userId: string, contestId: string): Promise<Submission[]> {
    const snapshot = await this.collection
      .where('contestId', '==', contestId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => this.deserializeSubmission(doc));
  }

  /**
   * Count submissions for a user in a contest
   */
  async countByUserAndContest(userId: string, contestId: string): Promise<number> {
    const snapshot = await this.collection
      .where('contestId', '==', contestId)
      .where('userId', '==', userId)
      .count()
      .get();

    return snapshot.data().count;
  }

  /**
   * Update submission
   */
  async update(id: string, data: Partial<SubmissionData>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: new Date(),
    });
  }

  /**
   * Update display order for voting
   */
  async updateDisplayOrder(id: string, displayOrder: number): Promise<void> {
    await this.collection.doc(id).update({ displayOrder });
  }

  /**
   * Update vote count (for results)
   */
  async updateVoteCount(id: string, voteCount: number): Promise<void> {
    await this.collection.doc(id).update({ voteCount });
  }

  /**
   * Delete submission
   */
  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }

  /**
   * Get submissions ordered by vote count (for results)
   */
  async getByContestIdOrderedByVotes(contestId: string): Promise<Submission[]> {
    const snapshot = await this.collection
      .where('contestId', '==', contestId)
      .orderBy('voteCount', 'desc')
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => this.deserializeSubmission(doc));
  }

  private deserializeSubmission(doc: DocumentSnapshot | QueryDocumentSnapshot): Submission {
    const data = doc.data() as SubmissionData & {
      createdAt?: Date | Timestamp;
      updatedAt?: Date | Timestamp;
      editedAt?: Date | Timestamp;
    };

    const convertDate = (value?: Date | Timestamp): Date | undefined => {
      if (!value) {
        return undefined;
      }

      return value instanceof Timestamp ? value.toDate() : value;
    };

    return {
      id: doc.id,
      ...data,
      createdAt: convertDate(data.createdAt),
      updatedAt: convertDate(data.updatedAt),
      editedAt: convertDate(data.editedAt),
    } as Submission;
  }
}
