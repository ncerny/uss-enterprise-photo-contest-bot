import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type ContestStatus = 'created' | 'submission' | 'voting' | 'results' | 'cancelled';

export interface Contest {
  id: string;
  title: string;
  description: string;
  channelId: string;
  guildId: string;
  submissionDeadline: Date;
  votingDeadline: Date;
  maxSubmissionsPerUser: number;
  maxVotesPerUser: number;
  numberOfWinners: number;
  status: ContestStatus;
  createdAt: Date;
  createdBy: string;
  submissionCount?: number;
}

export interface Submission {
  id: string;
  contestId: string;
  userId: string;
  assets: {
    display: { bucket: string; path: string };
    thumbnail: { bucket: string; path: string };
  };
  caption?: string;
  displayOrder?: number;
  createdAt: Date;
  voteCount?: number;
}

const CONTESTS_COLLECTION = 'contests';
const SUBMISSIONS_COLLECTION = 'submissions';

function parseTimestamp(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date();
}

function deserializeContest(id: string, data: Record<string, unknown>): Contest {
  return {
    id,
    title: data.title as string,
    description: data.description as string,
    channelId: data.channelId as string,
    guildId: data.guildId as string,
    submissionDeadline: parseTimestamp(data.submissionDeadline),
    votingDeadline: parseTimestamp(data.votingDeadline),
    maxSubmissionsPerUser: data.maxSubmissionsPerUser as number,
    maxVotesPerUser: data.maxVotesPerUser as number,
    numberOfWinners: data.numberOfWinners as number,
    status: data.status as ContestStatus,
    createdAt: parseTimestamp(data.createdAt),
    createdBy: data.createdBy as string,
    submissionCount: data.submissionCount as number | undefined,
  };
}

function deserializeSubmission(id: string, data: Record<string, unknown>): Submission {
  const assets = data.assets as {
    display: { bucket: string; path: string };
    thumbnail: { bucket: string; path: string };
  };

  return {
    id,
    contestId: data.contestId as string,
    userId: data.userId as string,
    assets,
    caption: data.caption as string | undefined,
    displayOrder: data.displayOrder as number | undefined,
    createdAt: parseTimestamp(data.createdAt),
    voteCount: data.voteCount as number | undefined,
  };
}

/**
 * Get a contest by ID
 */
export async function getContest(contestId: string): Promise<Contest | null> {
  const docRef = doc(db, CONTESTS_COLLECTION, contestId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return deserializeContest(snapshot.id, snapshot.data() as Record<string, unknown>);
}

/**
 * Get active contests for a guild (non-cancelled, non-created)
 */
export async function getActiveContests(guildId: string): Promise<Contest[]> {
  const q = query(
    collection(db, CONTESTS_COLLECTION),
    where('guildId', '==', guildId),
    where('status', 'in', ['submission', 'voting', 'results']),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    deserializeContest(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * Get all submissions for a contest (for gallery display)
 */
export async function getContestSubmissions(contestId: string): Promise<Submission[]> {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where('contestId', '==', contestId),
    orderBy('displayOrder', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    deserializeSubmission(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * Get submissions ordered by vote count (for results)
 */
export async function getContestSubmissionsByVotes(contestId: string): Promise<Submission[]> {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where('contestId', '==', contestId),
    orderBy('voteCount', 'desc'),
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    deserializeSubmission(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * Subscribe to contest updates (real-time)
 */
export function subscribeToContest(
  contestId: string,
  callback: (contest: Contest | null) => void
): Unsubscribe {
  const docRef = doc(db, CONTESTS_COLLECTION, contestId);

  return onSnapshot(docRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(deserializeContest(snapshot.id, snapshot.data() as Record<string, unknown>));
  });
}

/**
 * Get image URL from Firebase Storage path
 */
export function getImageUrl(bucket: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/**
 * Check if vote counts should be visible
 */
export function areVoteCountsVisible(contest: Contest): boolean {
  return contest.status === 'results';
}

/**
 * Check if voting is open
 */
export function isVotingOpen(contest: Contest): boolean {
  return contest.status === 'voting';
}

/**
 * Check if submissions are open
 */
export function isSubmissionOpen(contest: Contest): boolean {
  return contest.status === 'submission';
}

/**
 * Get the next deadline for a contest
 */
export function getNextDeadline(contest: Contest): { label: string; date: Date } | null {
  switch (contest.status) {
    case 'submission':
      return { label: 'Submissions close', date: contest.submissionDeadline };
    case 'voting':
      return { label: 'Voting ends', date: contest.votingDeadline };
    default:
      return null;
  }
}
