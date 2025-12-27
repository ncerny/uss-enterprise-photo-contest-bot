import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import MySubmissions from './pages/MySubmissions';
import EditSubmission from './pages/EditSubmission';
import ContestPage from './pages/ContestPage';
import VotingPage from './pages/VotingPage';
import ResultsPage from './pages/ResultsPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="loading-spinner" />
        <p className="text-muted" style={{ marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <MySubmissions />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/submissions/:submissionId/edit"
        element={
          <ProtectedRoute>
            <Layout>
              <EditSubmission />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contest/:contestId"
        element={
          <Layout>
            <ContestPage />
          </Layout>
        }
      />
      <Route
        path="/contest/:contestId/vote"
        element={
          <ProtectedRoute>
            <Layout>
              <VotingPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contest/:contestId/results"
        element={
          <Layout>
            <ResultsPage />
          </Layout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
