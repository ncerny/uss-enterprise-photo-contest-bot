import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCodeForToken } from '../services/auth';
import styles from './AuthCallback.module.css';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Discord authorization failed: ${errorParam}`);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    async function handleCallback() {
      try {
        await exchangeCodeForToken(code!);
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to complete authentication'
        );
      }
    }

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.title}>Authentication Failed</h2>
          <p className={styles.error}>{error}</p>
          <button onClick={() => navigate('/login', { replace: true })}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className="loading-spinner" />
        <p className={styles.message}>Completing sign in...</p>
      </div>
    </div>
  );
}
