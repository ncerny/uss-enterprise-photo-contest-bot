import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Vote {
  id: string;
  contestId: string;
  submissionId: string;
  voterId: string;
  createdAt: Date;
}

const VOTES_COLLECTION = 'votes';

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

function deserializeVote(id: string, data: Record<string, unknown>): Vote {
  return {
    id,
    contestId: data.contestId as string,
    submissionId: data.submissionId as string,
    voterId: data.voterId as string,
    createdAt: parseTimestamp(data.createdAt),
  };
}

/**
 * Get all votes by a user for a contest
 */
export async function getUserVotes(voterId: string, contestId: string): Promise<Vote[]> {
  const q = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId),
    where('contestId', '==', contestId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    deserializeVote(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * Get the set of submission IDs the user has voted for
 */
export async function getUserVotedSubmissionIds(
  voterId: string,
  contestId: string
): Promise<Set<string>> {
  const votes = await getUserVotes(voterId, contestId);
  return new Set(votes.map((v) => v.submissionId));
}

/**
 * Check if user has voted for a specific submission
 */
export async function hasUserVoted(voterId: string, submissionId: string): Promise<boolean> {
  const q = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId),
    where('submissionId', '==', submissionId)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Cast a vote for a submission
 */
export async function castVote(
  voterId: string,
  submissionId: string,
  contestId: string
): Promise<Vote> {
  // Check for existing vote first
  const existing = await hasUserVoted(voterId, submissionId);
  if (existing) {
    throw new Error('Already voted for this submission');
  }

  const docRef = await addDoc(collection(db, VOTES_COLLECTION), {
    voterId,
    submissionId,
    contestId,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    voterId,
    submissionId,
    contestId,
    createdAt: new Date(),
  };
}

/**
 * Remove a vote
 */
export async function removeVote(voterId: string, submissionId: string): Promise<void> {
  const q = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId),
    where('submissionId', '==', submissionId)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error('Vote not found');
  }

  // Delete the first matching vote
  await deleteDoc(doc(db, VOTES_COLLECTION, snapshot.docs[0].id));
}

/**
 * Count total votes for a contest
 */
export async function countContestVotes(contestId: string): Promise<number> {
  const q = query(collection(db, VOTES_COLLECTION), where('contestId', '==', contestId));

  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Count unique voters in a contest
 */
export async function countUniqueVoters(contestId: string): Promise<number> {
  const q = query(collection(db, VOTES_COLLECTION), where('contestId', '==', contestId));

  const snapshot = await getDocs(q);
  const voterIds = new Set(snapshot.docs.map((doc) => doc.data().voterId as string));
  return voterIds.size;
}

/**
 * Subscribe to user's votes for a contest (real-time)
 */
export function subscribeToUserVotes(
  voterId: string,
  contestId: string,
  callback: (votes: Vote[]) => void
): Unsubscribe {
  const q = query(
    collection(db, VOTES_COLLECTION),
    where('voterId', '==', voterId),
    where('contestId', '==', contestId)
  );

  return onSnapshot(q, (snapshot) => {
    const votes = snapshot.docs.map((doc) =>
      deserializeVote(doc.id, doc.data() as Record<string, unknown>)
    );
    callback(votes);
  });
}
