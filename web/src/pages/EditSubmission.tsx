import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getSubmission,
  getContest,
  updateSubmission,
  getDisplayImageUrl,
  Submission,
  Contest,
} from '../services/submissions';
import {
  validateImage,
  validateCaption,
  processAndUploadImage,
  deleteImageVariants,
  generateUploadId,
  IMAGE_CONSTRAINTS,
} from '../services/imageUpload';
import styles from './EditSubmission.module.css';

type SaveState = 'idle' | 'saving' | 'success' | 'error';

export default function EditSubmission() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [caption, setCaption] = useState('');
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Save state
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Cleanup object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (newImagePreview) {
        URL.revokeObjectURL(newImagePreview);
      }
    };
  }, [newImagePreview]);

  useEffect(() => {
    async function loadSubmission() {
      if (!submissionId) {
        setError('No submission ID provided');
        setLoading(false);
        return;
      }

      try {
        const sub = await getSubmission(submissionId);

        if (!sub) {
          setError('Submission not found');
          setLoading(false);
          return;
        }

        // Check ownership
        if (sub.userId !== user?.discordId) {
          setError('You can only edit your own submissions');
          setLoading(false);
          return;
        }

        const contestData = await getContest(sub.contestId);

        // Check if editing is allowed (contest must exist and be in submission period)
        if (!contestData || contestData.status !== 'submission') {
          setError('This submission can no longer be edited');
          setLoading(false);
          return;
        }

        setSubmission(sub);
        setContest(contestData);
        setCaption(sub.caption || '');
      } catch (err) {
        console.error('Failed to load submission:', err);
        setError('Failed to load submission');
      } finally {
        setLoading(false);
      }
    }

    loadSubmission();
  }, [submissionId, user]);

  const handleCaptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCaption = e.target.value;
      setCaption(newCaption);

      const validation = validateCaption(newCaption);
      setCaptionError(validation.valid ? null : validation.error || null);
    },
    []
  );

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Clear previous state
      setImageError(null);
      setNewImage(null);
      setNewImagePreview(null);

      // Validate image
      const validation = await validateImage(file);
      if (!validation.valid) {
        setImageError(validation.error || 'Invalid image');
        return;
      }

      // Set new image
      setNewImage(file);
      setNewImagePreview(URL.createObjectURL(file));
    },
    []
  );

  const handleRemoveNewImage = useCallback(() => {
    if (newImagePreview) {
      URL.revokeObjectURL(newImagePreview);
    }
    setNewImage(null);
    setNewImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [newImagePreview]);

  const handleSave = async () => {
    if (!submission || !user) return;

    // Validate caption
    const captionValidation = validateCaption(caption);
    if (!captionValidation.valid) {
      setCaptionError(captionValidation.error || 'Invalid caption');
      return;
    }

    setSaveState('saving');
    setSaveError(null);

    try {
      const updates: {
        caption?: string;
        assets?: typeof submission.assets;
        uploadId?: string;
      } = {};

      // Check if caption changed
      if (caption !== (submission.caption || '')) {
        updates.caption = caption;
      }

      // Handle image replacement
      if (newImage) {
        const newUploadId = generateUploadId();
        const oldAssets = submission.assets;

        // Upload new image first
        const newAssets = await processAndUploadImage(
          newImage,
          submission.contestId,
          newUploadId
        );

        updates.assets = newAssets;
        updates.uploadId = newUploadId;

        try {
          // Update Firestore with new asset paths
          await updateSubmission(submission.id, updates);

          // Only delete old files after successful DB update
          deleteImageVariants(oldAssets).catch((err) => {
            console.error('Failed to delete old image variants:', err);
          });
        } catch (dbError) {
          // Rollback: delete newly uploaded files since DB update failed
          console.error('DB update failed, rolling back uploaded files:', dbError);
          deleteImageVariants(newAssets).catch((rollbackErr) => {
            console.error('Failed to rollback uploaded files:', rollbackErr);
          });
          throw dbError;
        }
      } else if (Object.keys(updates).length > 0) {
        // Only caption changed
        await updateSubmission(submission.id, updates);
      }

      setSaveState('success');

      // Navigate back after short delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    } catch (err) {
      console.error('Failed to save submission:', err);
      setSaveState('error');
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save changes'
      );
    }
  };

  const hasChanges =
    caption !== (submission?.caption || '') || newImage !== null;
  const canSave = hasChanges && !captionError && !imageError;

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className="loading-spinner" />
        <p className="text-muted">Loading submission...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <p className="text-error">{error}</p>
        <Link to="/">Back to submissions</Link>
      </div>
    );
  }

  if (!submission) {
    return null;
  }

  const currentImageUrl = newImagePreview || getDisplayImageUrl(submission);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>
          &larr; Back to submissions
        </Link>
        <h1 className={styles.title}>Edit Submission</h1>
        {contest && <p className={styles.contestName}>{contest.title}</p>}
      </header>

      <div className={styles.content}>
        <div className={styles.imageSection}>
          <div className={styles.imageContainer}>
            <img
              src={currentImageUrl}
              alt={submission.caption || 'Submission'}
              className={styles.image}
            />
            {newImagePreview && (
              <div className={styles.newImageBadge}>New image</div>
            )}
          </div>

          <div className={styles.imageActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_CONSTRAINTS.SUPPORTED_TYPES.join(',')}
              onChange={handleImageSelect}
              className={styles.fileInput}
              id="image-input"
            />
            <label htmlFor="image-input" className={styles.uploadButton}>
              {newImage ? 'Choose Different Image' : 'Replace Image'}
            </label>

            {newImage && (
              <button
                type="button"
                onClick={handleRemoveNewImage}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>

          {imageError && <p className="text-error">{imageError}</p>}

          <p className={styles.imageHint}>
            Supported formats: JPEG, PNG, WebP. Max size: 10 MB. Min dimensions:
            256x256px.
          </p>
        </div>

        <div className={styles.formSection}>
          <div className={styles.field}>
            <label htmlFor="caption" className={styles.label}>
              Caption
              <span className={styles.charCount}>
                {caption.length}/{IMAGE_CONSTRAINTS.MAX_CAPTION_LENGTH}
              </span>
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={handleCaptionChange}
              className={styles.textarea}
              rows={4}
              placeholder="Add a caption for your photo..."
              maxLength={IMAGE_CONSTRAINTS.MAX_CAPTION_LENGTH}
            />
            {captionError && <p className="text-error">{captionError}</p>}
          </div>

          <div className={styles.actions}>
            <Link to="/" className="btn-secondary">
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saveState === 'saving'}
            >
              {saveState === 'saving' ? (
                <>
                  <span className="loading-spinner" style={{ width: '1rem', height: '1rem' }} />
                  Saving...
                </>
              ) : saveState === 'success' ? (
                'Saved!'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>

          {saveState === 'error' && saveError && (
            <p className="text-error">{saveError}</p>
          )}

          {saveState === 'success' && (
            <p className="text-success">
              Changes saved successfully! Redirecting...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
