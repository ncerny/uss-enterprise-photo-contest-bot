import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserSubmissions,
  getContestsByIds,
  Submission,
  Contest,
} from '../services/submissions';
import SubmissionCard from '../components/SubmissionCard';
import styles from './MySubmissions.module.css';

export default function MySubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [contests, setContests] = useState<Map<string, Contest>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubmissions() {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch submissions first
        const submissionsData = await getUserSubmissions(user.discordId);
        setSubmissions(submissionsData);

        // Then batch-fetch all related contests
        const contestIds = submissionsData.map((s) => s.contestId);
        const contestsMap = await getContestsByIds(contestIds);
        setContests(contestsMap);
      } catch (err) {
        console.error('Failed to load submissions:', err);
        setError('Failed to load your submissions. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadSubmissions();
  }, [user]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="loading-spinner" />
        <p className="text-muted">Loading your submissions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <p className="text-error">{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Submissions</h1>
        <p className={styles.subtitle}>
          {submissions.length === 0
            ? 'You haven\'t submitted any photos yet.'
            : `You have ${submissions.length} submission${submissions.length !== 1 ? 's' : ''}`}
        </p>
      </header>

      {submissions.length > 0 ? (
        <div className={styles.grid}>
          {submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              contest={contests.get(submission.contestId)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>Submit photos to contests through Discord to see them here.</p>
        </div>
      )}
    </div>
  );
}
