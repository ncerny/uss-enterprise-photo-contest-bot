import { useState } from 'react';
import { Submission, getImageUrl } from '../services/contests';
import styles from './SubmissionGallery.module.css';

interface SubmissionGalleryProps {
  submissions: Submission[];
  votedSubmissionIds?: Set<string>;
  showVoteCounts?: boolean;
  onVote?: (submissionId: string) => void;
  onUnvote?: (submissionId: string) => void;
  votingEnabled?: boolean;
  voteCount?: number;
  maxVotes?: number;
}

export default function SubmissionGallery({
  submissions,
  votedSubmissionIds = new Set(),
  showVoteCounts = false,
  onVote,
  onUnvote,
  votingEnabled = false,
  voteCount = 0,
  maxVotes = 0,
}: SubmissionGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<Submission | null>(null);

  if (submissions.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No submissions yet.</p>
      </div>
    );
  }

  const canVote = votingEnabled && voteCount < maxVotes;

  return (
    <>
      <div className={styles.grid}>
        {submissions.map((submission) => {
          const hasVoted = votedSubmissionIds.has(submission.id);
          const thumbnailUrl = getImageUrl(
            submission.assets.thumbnail.bucket,
            submission.assets.thumbnail.path
          );

          return (
            <div
              key={submission.id}
              className={`${styles.card} ${hasVoted ? styles.voted : ''}`}
            >
              <div
                className={styles.imageContainer}
                onClick={() => setSelectedImage(submission)}
              >
                <img
                  src={thumbnailUrl}
                  alt={submission.caption || `Submission #${submission.displayOrder}`}
                  className={styles.image}
                  loading="lazy"
                />
                {submission.displayOrder && (
                  <span className={styles.orderBadge}>#{submission.displayOrder}</span>
                )}
                {hasVoted && <span className={styles.votedBadge}>Voted</span>}
              </div>

              {submission.caption && (
                <p className={styles.caption}>{submission.caption}</p>
              )}

              {showVoteCounts && submission.voteCount !== undefined && (
                <div className={styles.voteCount}>
                  {submission.voteCount} vote{submission.voteCount !== 1 ? 's' : ''}
                </div>
              )}

              {votingEnabled && (
                <div className={styles.voteActions}>
                  {hasVoted ? (
                    <button
                      className={styles.unvoteButton}
                      onClick={() => onUnvote?.(submission.id)}
                    >
                      Remove Vote
                    </button>
                  ) : (
                    <button
                      className={styles.voteButton}
                      onClick={() => onVote?.(submission.id)}
                      disabled={!canVote}
                    >
                      Vote
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedImage && (
        <div className={styles.lightbox} onClick={() => setSelectedImage(null)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.closeButton}
              onClick={() => setSelectedImage(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <img
              src={getImageUrl(
                selectedImage.assets.display.bucket,
                selectedImage.assets.display.path
              )}
              alt={selectedImage.caption || 'Submission'}
              className={styles.lightboxImage}
            />
            {selectedImage.caption && (
              <p className={styles.lightboxCaption}>{selectedImage.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
