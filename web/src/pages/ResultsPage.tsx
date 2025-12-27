import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  getContest,
  getContestSubmissionsByVotes,
  Contest,
  Submission,
  getImageUrl,
  areVoteCountsVisible,
} from '../services/contests';
import { countContestVotes, countUniqueVoters } from '../services/votes';
import styles from './ResultsPage.module.css';

interface RankedSubmission extends Submission {
  placement: number;
  isTied: boolean;
}

function rankSubmissions(submissions: Submission[]): RankedSubmission[] {
  if (submissions.length === 0) return [];

  const ranked: RankedSubmission[] = [];
  let currentPlacement = 1;
  let previousVoteCount: number | null = null;
  let sameRankCount = 0;

  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];
    const voteCount = submission.voteCount ?? 0;

    if (previousVoteCount !== null && voteCount < previousVoteCount) {
      currentPlacement += sameRankCount;
      sameRankCount = 1;
    } else if (previousVoteCount === voteCount) {
      sameRankCount++;
    } else {
      sameRankCount = 1;
    }

    const prevVotes = i > 0 ? (submissions[i - 1].voteCount ?? 0) : null;
    const nextVotes = i < submissions.length - 1 ? (submissions[i + 1].voteCount ?? 0) : null;
    const isTied = voteCount === prevVotes || voteCount === nextVotes;

    ranked.push({
      ...submission,
      placement: currentPlacement,
      isTied,
    });

    previousVoteCount = voteCount;
  }

  return ranked;
}

function getPlacementEmoji(placement: number): string {
  switch (placement) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return `#${placement}`;
  }
}

export default function ResultsPage() {
  const { contestId } = useParams<{ contestId: string }>();

  const [contest, setContest] = useState<Contest | null>(null);
  const [submissions, setSubmissions] = useState<RankedSubmission[]>([]);
  const [stats, setStats] = useState<{ totalVotes: number; uniqueVoters: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contestId) {
      setError('No contest ID provided');
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [contestData, submissionsData, totalVotes, uniqueVoters] = await Promise.all([
          getContest(contestId!),
          getContestSubmissionsByVotes(contestId!),
          countContestVotes(contestId!),
          countUniqueVoters(contestId!),
        ]);

        if (!contestData) {
          setError('Contest not found');
          return;
        }

        setContest(contestData);
        setSubmissions(rankSubmissions(submissionsData));
        setStats({ totalVotes, uniqueVoters });
      } catch (err) {
        console.error('Failed to load results:', err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [contestId]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="loading-spinner" />
        <p className="text-muted">Loading results...</p>
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

  // Redirect if results are not available
  if (!areVoteCountsVisible(contest)) {
    return <Navigate to={`/contest/${contestId}`} replace />;
  }

  const winners = submissions.filter((s) => s.placement <= contest.numberOfWinners);
  const others = submissions.filter((s) => s.placement > contest.numberOfWinners);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={`/contest/${contestId}`} className={styles.backLink}>
          &larr; Back to contest
        </Link>
        <h1 className={styles.title}>Contest Results</h1>
        <p className={styles.subtitle}>{contest.title}</p>
      </header>

      {stats && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{submissions.length}</span>
            <span className={styles.statLabel}>Submissions</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.totalVotes}</span>
            <span className={styles.statLabel}>Total Votes</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.uniqueVoters}</span>
            <span className={styles.statLabel}>Voters</span>
          </div>
        </div>
      )}

      {winners.length === 0 ? (
        <div className={styles.noWinners}>
          <p>No votes were cast in this contest.</p>
        </div>
      ) : (
        <>
          <section className={styles.winnersSection}>
            <h2 className={styles.sectionTitle}>Winners</h2>
            <div className={styles.winnersGrid}>
              {winners.map((submission) => (
                <div
                  key={submission.id}
                  className={`${styles.winnerCard} ${styles[`place${submission.placement}`]}`}
                >
                  <div className={styles.placement}>
                    <span className={styles.placementEmoji}>
                      {getPlacementEmoji(submission.placement)}
                    </span>
                    {submission.isTied && <span className={styles.tiedBadge}>Tied</span>}
                  </div>

                  <div className={styles.winnerImageContainer}>
                    <img
                      src={getImageUrl(
                        submission.assets.display.bucket,
                        submission.assets.display.path
                      )}
                      alt={submission.caption || `Winner #${submission.placement}`}
                      className={styles.winnerImage}
                    />
                  </div>

                  <div className={styles.winnerInfo}>
                    {submission.caption && (
                      <p className={styles.winnerCaption}>{submission.caption}</p>
                    )}
                    <div className={styles.winnerVotes}>
                      {submission.voteCount} vote{submission.voteCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {others.length > 0 && (
            <section className={styles.othersSection}>
              <h2 className={styles.sectionTitle}>All Submissions</h2>
              <div className={styles.othersGrid}>
                {others.map((submission) => (
                  <div key={submission.id} className={styles.otherCard}>
                    <img
                      src={getImageUrl(
                        submission.assets.thumbnail.bucket,
                        submission.assets.thumbnail.path
                      )}
                      alt={submission.caption || `Submission #${submission.displayOrder}`}
                      className={styles.otherImage}
                    />
                    <div className={styles.otherInfo}>
                      <span className={styles.otherPlacement}>#{submission.placement}</span>
                      <span className={styles.otherVotes}>
                        {submission.voteCount} vote{submission.voteCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
