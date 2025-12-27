import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'My Submissions' },
  // Add more nav items as pages are built
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <button
              className={styles.menuButton}
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className={styles.menuIcon} />
            </button>
            <Link to="/" className={styles.logo} onClick={closeMobileMenu}>
              USS Enterprise Photo Contest
            </Link>
          </div>

          <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navLink} ${location.pathname === item.path ? styles.navLinkActive : ''}`}
                onClick={closeMobileMenu}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.headerRight}>
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

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className={styles.mobileMenuOverlay} onClick={closeMobileMenu} />
        )}
      </header>

      <main className={styles.main}>
        <div className="container">{children}</div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.copyright}>
            USS Enterprise Photo Contest
          </p>
          <nav className={styles.footerNav}>
            <a
              href="https://discord.gg/uss-enterprise"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>
            <a
              href="https://github.com/ncerny/uss-enterprise-photo-contest-bot"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
