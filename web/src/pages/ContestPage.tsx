import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getContest,
  subscribeToContest,
  Contest,
  getNextDeadline,
  isSubmissionOpen,
  isVotingOpen,
  areVoteCountsVisible,
} from '../services/contests';
import styles from './ContestPage.module.css';

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.total <= 0) {
    return <span className={styles.expired}>Ended</span>;
  }

  return (
    <div className={styles.countdown}>
      {timeLeft.days > 0 && (
        <span className={styles.countdownUnit}>
          <span className={styles.countdownValue}>{timeLeft.days}</span>
          <span className={styles.countdownLabel}>d</span>
        </span>
      )}
      <span className={styles.countdownUnit}>
        <span className={styles.countdownValue}>{timeLeft.hours.toString().padStart(2, '0')}</span>
        <span className={styles.countdownLabel}>h</span>
      </span>
      <span className={styles.countdownUnit}>
        <span className={styles.countdownValue}>{timeLeft.minutes.toString().padStart(2, '0')}</span>
        <span className={styles.countdownLabel}>m</span>
      </span>
      <span className={styles.countdownUnit}>
        <span className={styles.countdownValue}>{timeLeft.seconds.toString().padStart(2, '0')}</span>
        <span className={styles.countdownLabel}>s</span>
      </span>
    </div>
  );
}

function calculateTimeLeft(targetDate: Date) {
  const total = targetDate.getTime() - Date.now();
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { total, days, hours, minutes, seconds };
}

function StatusBadge({ status }: { status: Contest['status'] }) {
  const statusConfig: Record<Contest['status'], { label: string; className: string }> = {
    created: { label: 'Draft', className: styles.statusDraft },
    submission: { label: 'Submissions Open', className: styles.statusSubmission },
    voting: { label: 'Voting Open', className: styles.statusVoting },
    results: { label: 'Results', className: styles.statusResults },
    cancelled: { label: 'Cancelled', className: styles.statusCancelled },
  };

  const config = statusConfig[status];

  return <span className={`${styles.statusBadge} ${config.className}`}>{config.label}</span>;
}

export default function ContestPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contestId) {
      setError('No contest ID provided');
      setLoading(false);
      return;
    }

    // Initial load
    getContest(contestId)
      .then((data) => {
        if (!data) {
          setError('Contest not found');
        } else {
          setContest(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load contest:', err);
        setError('Failed to load contest');
        setLoading(false);
      });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToContest(contestId, (data) => {
      if (data) {
        setContest(data);
      }
    });

    return () => unsubscribe();
  }, [contestId]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="loading-spinner" />
        <p className="text-muted">Loading contest...</p>
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

  const nextDeadline = getNextDeadline(contest);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <StatusBadge status={contest.status} />
        <h1 className={styles.title}>{contest.title}</h1>
      </header>

      {nextDeadline && (
        <div className={styles.deadlineSection}>
          <span className={styles.deadlineLabel}>{nextDeadline.label}</span>
          <CountdownTimer targetDate={nextDeadline.date} />
        </div>
      )}

      <div className={styles.description}>
        <p>{contest.description}</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contest.submissionCount ?? 0}</span>
          <span className={styles.statLabel}>Submissions</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contest.maxSubmissionsPerUser}</span>
          <span className={styles.statLabel}>Max per user</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contest.maxVotesPerUser}</span>
          <span className={styles.statLabel}>Votes per user</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{contest.numberOfWinners}</span>
          <span className={styles.statLabel}>Winners</span>
        </div>
      </div>

      <div className={styles.actions}>
        {isSubmissionOpen(contest) && (
          <Link to={`/contest/${contest.id}/gallery`} className={styles.actionButton}>
            View Gallery
          </Link>
        )}

        {isVotingOpen(contest) && (
          <Link to={`/contest/${contest.id}/vote`} className={styles.actionButtonPrimary}>
            Vote Now
          </Link>
        )}

        {areVoteCountsVisible(contest) && (
          <Link to={`/contest/${contest.id}/results`} className={styles.actionButtonPrimary}>
            View Results
          </Link>
        )}
      </div>

      <div className={styles.deadlines}>
        <div className={styles.deadlineRow}>
          <span>Submission deadline:</span>
          <span>{contest.submissionDeadline.toLocaleString()}</span>
        </div>
        <div className={styles.deadlineRow}>
          <span>Voting deadline:</span>
          <span>{contest.votingDeadline.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
