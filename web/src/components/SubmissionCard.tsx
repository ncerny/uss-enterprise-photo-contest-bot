import { Link } from 'react-router-dom';
import { Submission, getDisplayImageUrl, Contest } from '../services/submissions';
import styles from './SubmissionCard.module.css';

interface SubmissionCardProps {
  submission: Submission;
  contest?: Contest;
}

export default function SubmissionCard({ submission, contest }: SubmissionCardProps) {
  const imageUrl = getDisplayImageUrl(submission);
  const formattedDate = submission.createdAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const canEdit = contest?.status === 'submission';

  return (
    <div className={styles.card}>
      <div className={styles.imageContainer}>
        <img
          src={imageUrl}
          alt={submission.caption || 'Submission'}
          className={styles.image}
          loading="lazy"
        />
      </div>
      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.contest}>
            {contest?.title || 'Loading...'}
          </span>
          <span className={styles.date}>{formattedDate}</span>
        </div>
        {submission.caption && (
          <p className={styles.caption}>{submission.caption}</p>
        )}
        {submission.editedAt && (
          <p className={styles.edited}>
            Edited {submission.editedAt.toLocaleDateString()}
          </p>
        )}
        <div className={styles.actions}>
          {canEdit ? (
            <Link
              to={`/submissions/${submission.id}/edit`}
              className={styles.editButton}
            >
              Edit
            </Link>
          ) : (
            <span className={styles.status}>
              {contest?.status === 'voting'
                ? 'Voting in progress'
                : contest?.status === 'results'
                  ? 'Contest ended'
                  : 'View only'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
