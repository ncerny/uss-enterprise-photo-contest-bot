import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getContest,
  getContestSubmissions,
  subscribeToContest,
  Contest,
  Submission,
  isVotingOpen,
} from '../services/contests';
import {
  getUserVotedSubmissionIds,
  castVote,
  removeVote,
  subscribeToUserVotes,
} from '../services/votes';
import SubmissionGallery from '../components/SubmissionGallery';
import styles from './VotingPage.module.css';

export default function VotingPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { user } = useAuth();

  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Load contest and submissions
  useEffect(() => {
    if (!contestId) {
      setError('No contest ID provided');
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [contestData, submissionsData] = await Promise.all([
          getContest(contestId!),
          getContestSubmissions(contestId!),
        ]);

        if (!contestData) {
          setError('Contest not found');
          return;
        }

        setContest(contestData);
        setSubmissions(submissionsData);
      } catch (err) {
        console.error('Failed to load voting data:', err);
        setError('Failed to load contest');
      } finally {
        setLoading(false);
      }
    }

    load();

    // Subscribe to contest updates
    const unsubscribe = subscribeToContest(contestId, (data) => {
      if (data) {
        setContest(data);
      }
    });

    return () => unsubscribe();
  }, [contestId]);

  // Load and subscribe to user's votes
  useEffect(() => {
    if (!contestId || !user) return;

    // Initial load
    getUserVotedSubmissionIds(user.discordId, contestId).then(setVotedIds);

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUserVotes(user.discordId, contestId, (votes) => {
      setVotedIds(new Set(votes.map((v) => v.submissionId)));
    });

    return () => unsubscribe();
  }, [contestId, user]);

  const handleVote = useCallback(
    async (submissionId: string) => {
      if (!user || !contestId) return;

      setVoteError(null);

      try {
        await castVote(user.discordId, submissionId, contestId);
        // Optimistic update
        setVotedIds((prev) => new Set([...prev, submissionId]));
      } catch (err) {
        console.error('Failed to cast vote:', err);
        setVoteError(err instanceof Error ? err.message : 'Failed to cast vote');
      }
    },
    [user, contestId]
  );

  const handleUnvote = useCallback(
    async (submissionId: string) => {
      if (!user) return;

      setVoteError(null);

      try {
        await removeVote(user.discordId, submissionId);
        // Optimistic update
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(submissionId);
          return next;
        });
      } catch (err) {
        console.error('Failed to remove vote:', err);
        setVoteError(err instanceof Error ? err.message : 'Failed to remove vote');
      }
    },
    [user]
  );

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="loading-spinner" />
        <p className="text-muted">Loading voting gallery...</p>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className={styles.centered}>
        <p className="text-error">{error || 'Contest not found'}</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  // Redirect if voting is not open
  if (!isVotingOpen(contest)) {
    return <Navigate to={`/contest/${contestId}`} replace />;
  }

  const voteCount = votedIds.size;
  const maxVotes = contest.maxVotesPerUser;
  const votesRemaining = maxVotes - voteCount;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={`/contest/${contestId}`} className={styles.backLink}>
          &larr; Back to contest
        </Link>
        <h1 className={styles.title}>Vote for Your Favorites</h1>
        <p className={styles.subtitle}>{contest.title}</p>
      </header>

      <div className={styles.voteStatus}>
        <div className={styles.voteCounter}>
          <span className={styles.voteCountValue}>{voteCount}</span>
          <span className={styles.voteCountMax}>/ {maxVotes}</span>
          <span className={styles.voteCountLabel}>votes used</span>
        </div>

        {votesRemaining === 0 ? (
          <p className={styles.voteMessage}>
            You've used all your votes. Remove a vote to vote for something else.
          </p>
        ) : (
          <p className={styles.voteMessage}>
            You can vote for {votesRemaining} more submission{votesRemaining !== 1 ? 's' : ''}.
          </p>
        )}
      </div>

      {voteError && (
        <div className={styles.errorBanner}>
          {voteError}
          <button onClick={() => setVoteError(null)}>&times;</button>
        </div>
      )}

      <SubmissionGallery
        submissions={submissions}
        votedSubmissionIds={votedIds}
        votingEnabled={true}
        onVote={handleVote}
        onUnvote={handleUnvote}
        voteCount={voteCount}
        maxVotes={maxVotes}
      />
    </div>
  );
}
