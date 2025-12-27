import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.logo}>USS Enterprise Photo Contest</h1>
          <div className={styles.userMenu}>
            <ThemeToggle />
            {user && (
              <>
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className={styles.avatar}
                />
                <span className={styles.username}>{user.username}</span>
                <button onClick={logout} className="btn-secondary">
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
