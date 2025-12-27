import {
  Firestore,
  CollectionReference,
  Query,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import {
  Contest,
  ContestData,
  Collections,
  ContestStatus,
  ContestStatusChange,
} from '@uss-enterprise/shared';

/**
 * Repository for Contest operations
 */
export class ContestRepository {
  private collection: CollectionReference;

  constructor(private firestore: Firestore) {
    this.collection = firestore.collection(Collections.CONTESTS);
  }

  /**
   * Create a new contest
   */
  async create(data: ContestData): Promise<Contest> {
    const now = data.createdAt ?? new Date();
    const initialHistory =
      data.statusHistory ??
      ([
        {
          status: data.status,
          changedAt: now,
          changedBy: data.createdBy,
        },
      ] as Contest['statusHistory']);

    const docRef = await this.collection.add({
      ...data,
      createdAt: now,
      submissionCount: data.submissionCount ?? 0,
      statusHistory: initialHistory,
    });

    return {
      id: docRef.id,
      ...data,
      createdAt: now,
      submissionCount: data.submissionCount ?? 0,
      statusHistory: initialHistory,
    };
  }

  /**
   * Get contest by ID
   */
  async getById(id: string): Promise<Contest | null> {
    const doc = await this.collection.doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return this.deserializeContest(doc);
  }

  /**
   * Get contest by channel ID
   */
  async getByChannelId(channelId: string): Promise<Contest | null> {
    const snapshot = await this.collection.where('channelId', '==', channelId).limit(1).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.deserializeContest(doc);
  }

  /**
   * Get all contests for a guild
   */
  async getByGuildId(guildId: string): Promise<Contest[]> {
    const snapshot = await this.collection
      .where('guildId', '==', guildId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.deserializeContest(doc));
  }

  /**
   * Get active contests (not in results or cancelled status)
   */
  async getActive(guildId?: string): Promise<Contest[]> {
    let query: Query = this.collection.where('status', 'in', ['created', 'submission', 'voting']);

    if (guildId) {
      query = query.where('guildId', '==', guildId);
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => this.deserializeContest(doc));
  }

  /**
   * Update contest
   */
  async update(id: string, data: Partial<ContestData>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: new Date(),
    });
  }

  /**
   * Update contest status
   */
  async updateStatus(
    id: string,
    status: Contest['status'],
    history?: Contest['statusHistory']
  ): Promise<void> {
    await this.collection.doc(id).update({
      status,
      statusHistory: history,
      updatedAt: new Date(),
    });
  }

  /**
   * Increment submission count
   */
  async incrementSubmissionCount(id: string): Promise<void> {
    const docRef = this.collection.doc(id);
    await this.firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const currentCount = doc.data()?.submissionCount || 0;
      transaction.update(docRef, {
        submissionCount: currentCount + 1,
      });
    });
  }

  /**
   * Delete contest
   */
  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }

  async findDueByStatus(
    status: ContestStatus,
    deadlineField: DeadlineField,
    cutoff: Date
  ): Promise<Contest[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .where(deadlineField, '<=', cutoff)
      .get();

    return snapshot.docs.map((doc) => this.deserializeContest(doc));
  }

  /**
   * Find contests by status
   */
  async findByStatus(status: ContestStatus): Promise<Contest[]> {
    const snapshot = await this.collection.where('status', '==', status).get();

    return snapshot.docs.map((doc) => this.deserializeContest(doc));
  }

  private deserializeContest(doc: DocumentSnapshot | QueryDocumentSnapshot): Contest {
    const data = doc.data() as ContestData & {
      createdAt: Date | Timestamp;
      submissionDeadline: Date | Timestamp;
      votingDeadline: Date | Timestamp;
      statusHistory?: ContestStatusHistoryDoc[];
      orphanedAt?: Date | Timestamp;
    };

    const coerceDate = (value: Date | Timestamp | undefined, field: string): Date => {
      if (!value) {
        throw new Error(`Contest document ${doc.id} missing ${field}`);
      }

      if (value instanceof Timestamp) {
        return value.toDate();
      }

      return value;
    };

    return {
      id: doc.id,
      ...data,
      createdAt: coerceDate(data.createdAt, 'createdAt'),
      submissionDeadline: coerceDate(data.submissionDeadline, 'submissionDeadline'),
      votingDeadline: coerceDate(data.votingDeadline, 'votingDeadline'),
      statusHistory: data.statusHistory?.map((entry) => ({
        ...entry,
        changedAt: coerceDate(entry.changedAt, 'statusHistory.changedAt'),
      })),
      orphanedAt: data.orphanedAt
        ? data.orphanedAt instanceof Timestamp
          ? data.orphanedAt.toDate()
          : data.orphanedAt
        : undefined,
    } as Contest;
  }
}

type ContestStatusHistoryDoc = Omit<ContestStatusChange, 'changedAt'> & {
  changedAt: Date | Timestamp;
};

type DeadlineField = 'submissionDeadline' | 'votingDeadline';
