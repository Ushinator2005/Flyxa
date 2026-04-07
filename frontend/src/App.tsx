import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import Layout from './components/layout/Layout.js';
import Auth from './pages/Auth.js';
import Dashboard from './pages/Dashboard.js';
import TradeScanner from './pages/TradeScanner.js';
import AICoach from './pages/AICoach.js';
import Analytics from './pages/Analytics.js';
import PsychologyTracker from './pages/PsychologyTracker.js';
import Journal from './pages/Journal.js';
import Chart from './pages/Chart.js';
import LoadingSpinner from './components/common/LoadingSpinner.js';
import FlyxaChatWidget from './components/common/FlyxaChatWidget.js';
import LandingPage from './lumis/pages/LandingPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading Flyxa..." />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
        <Route path="/scanner" element={<ProtectedPage><TradeScanner /></ProtectedPage>} />
        <Route path="/coach" element={<ProtectedPage><AICoach /></ProtectedPage>} />
        <Route path="/analytics" element={<ProtectedPage><Analytics /></ProtectedPage>} />
        <Route path="/chart" element={<Navigate to="/backtest" replace />} />
        <Route path="/backtest" element={<ProtectedPage><Chart /></ProtectedPage>} />
        <Route path="/psychology" element={<ProtectedPage><PsychologyTracker /></ProtectedPage>} />
        <Route path="/journal" element={<ProtectedPage><Journal /></ProtectedPage>} />
        <Route path="/risk" element={<Navigate to="/" replace />} />
        <Route path="/playbook" element={<Navigate to="/" replace />} />
        <Route path="/chart-analyzer" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
      </Routes>
      <FlyxaChatWidget />
    </>
  );
}
