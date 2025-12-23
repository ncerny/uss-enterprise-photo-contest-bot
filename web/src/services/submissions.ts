import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface SubmissionAssetVariant {
  bucket: string;
  path: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
}

export interface SubmissionAssetSet {
  archive: SubmissionAssetVariant;
  display: SubmissionAssetVariant;
  thumbnail: SubmissionAssetVariant;
}

export interface Submission {
  id: string;
  contestId: string;
  userId: string;
  assets: SubmissionAssetSet;
  uploadId: string;
  sourceMessageId: string;
  caption?: string;
  displayOrder?: number;
  createdAt: Date;
  updatedAt?: Date;
  editedAt?: Date;
  voteCount?: number;
}

export interface Contest {
  id: string;
  title: string;
  status: string;
}

const SUBMISSIONS_COLLECTION = 'submissions';
const CONTESTS_COLLECTION = 'contests';

function parseTimestamp(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  // Fallback to current date if invalid
  return new Date();
}

function parseOptionalTimestamp(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return undefined;
}

function deserializeSubmission(
  id: string,
  data: Record<string, unknown>
): Submission {
  return {
    id,
    contestId: data.contestId as string,
    userId: data.userId as string,
    assets: data.assets as SubmissionAssetSet,
    uploadId: data.uploadId as string,
    sourceMessageId: data.sourceMessageId as string,
    caption: data.caption as string | undefined,
    displayOrder: data.displayOrder as number | undefined,
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseOptionalTimestamp(data.updatedAt),
    editedAt: parseOptionalTimestamp(data.editedAt),
    voteCount: data.voteCount as number | undefined,
  };
}

export async function getUserSubmissions(userId: string): Promise<Submission[]> {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    deserializeSubmission(doc.id, doc.data() as Record<string, unknown>)
  );
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return deserializeSubmission(
    snapshot.id,
    snapshot.data() as Record<string, unknown>
  );
}

export async function getContest(id: string): Promise<Contest | null> {
  const docRef = doc(db, CONTESTS_COLLECTION, id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: data.title as string,
    status: data.status as string,
  };
}

export async function getContestsByIds(
  ids: string[]
): Promise<Map<string, Contest>> {
  const uniqueIds = [...new Set(ids)];
  const contestMap = new Map<string, Contest>();

  if (uniqueIds.length === 0) {
    return contestMap;
  }

  // Fetch contests in parallel
  const results = await Promise.all(
    uniqueIds.map((id) => getContest(id))
  );

  results.forEach((contest) => {
    if (contest) {
      contestMap.set(contest.id, contest);
    }
  });

  return contestMap;
}

export async function updateSubmissionCaption(
  submissionId: string,
  caption: string
): Promise<void> {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);

  await updateDoc(docRef, {
    caption,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSubmissionAssets(
  submissionId: string,
  assets: SubmissionAssetSet,
  uploadId: string
): Promise<void> {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);

  await updateDoc(docRef, {
    assets,
    uploadId,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSubmission(
  submissionId: string,
  updates: {
    caption?: string;
    assets?: SubmissionAssetSet;
    uploadId?: string;
  }
): Promise<void> {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);

  await updateDoc(docRef, {
    ...updates,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function getDisplayImageUrl(submission: Submission): string {
  const { bucket, path } = submission.assets.display;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

export function getThumbnailUrl(submission: Submission): string {
  const { bucket, path } = submission.assets.thumbnail;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}
