/**
 * Shared TypeScript types for USS Enterprise Photo Contest Bot
 * Used across bot, web, and functions workspaces
 */

/**
 * Contest status enum
 */
export enum ContestStatus {
  CREATED = 'created',
  SUBMISSION = 'submission',
  VOTING = 'voting',
  RESULTS = 'results',
  CANCELLED = 'cancelled',
}

/**
 * Contest document in Firestore
 */
export interface Contest {
  /** Unique contest ID */
  id: string;

  /** Contest title (becomes channel name when normalized) */
  title: string;

  /** Contest description and rules */
  description: string;

  /** Discord channel ID where contest is hosted */
  channelId: string;

  /** Discord guild (server) ID */
  guildId: string;

  /** When submission period ends */
  submissionDeadline: Date;

  /** When voting period ends */
  votingDeadline: Date;

  /** Maximum submissions allowed per user */
  maxSubmissionsPerUser: number;

  /** Maximum votes allowed per user */
  maxVotesPerUser: number;

  /** Number of winners to announce */
  numberOfWinners: number;

  /** Current contest status */
  status: ContestStatus;

  /** When contest was created */
  createdAt: Date;

  /** Discord user ID of contest creator */
  createdBy: string;

  /** Message ID of the welcome/info message */
  welcomeMessageId?: string;

  /** Total number of submissions received */
  submissionCount?: number;

  /** Historical state change log */
  statusHistory?: ContestStatusChange[];

  /** When the contest was first detected as orphaned (channel inaccessible) */
  orphanedAt?: Date;
}

/** Record of each contest status change */
export interface ContestStatusChange {
  status: ContestStatus;
  changedAt: Date;
  changedBy?: string;
}

/**
 * Submission document in Firestore
 */
export interface Submission {
  /** Unique submission ID */
  id: string;

  /** Contest this submission belongs to */
  contestId: string;

  /** Discord user ID of submitter */
  userId: string;

  /** Processed image variants stored in Firebase Storage */
  assets: SubmissionAssetSet;

  /** Upload batch identifier (maps to storage folder) */
  uploadId: string;

  /** Discord message ID that carried the original attachment */
  sourceMessageId: string;

  /** Optional caption/description from user */
  caption?: string;

  /** Display order during voting (randomized) */
  displayOrder?: number;

  /** When submission was created */
  createdAt: Date;

  /** When submission was last updated */
  updatedAt?: Date;

  /** When submission was last edited by the user */
  editedAt?: Date;

  /** Vote count (calculated during results) */
  voteCount?: number;
}

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

/**
 * Vote document in Firestore
 */
export interface Vote {
  /** Unique vote ID */
  id: string;

  /** Contest this vote belongs to */
  contestId: string;

  /** Submission being voted for */
  submissionId: string;

  /** Discord user ID of voter */
  voterId: string;

  /** When vote was cast */
  createdAt: Date;
}

/**
 * Firestore collection names
 */
export const Collections = {
  CONTESTS: 'contests',
  SUBMISSIONS: 'submissions',
  VOTES: 'votes',
} as const;

/**
 * Helper type for Firestore document data (without id)
 */
export type ContestData = Omit<Contest, 'id'>;
export type SubmissionData = Omit<Submission, 'id'>;
export type VoteData = Omit<Vote, 'id'>;
