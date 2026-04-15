import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { useOnboarding } from './contexts/OnboardingContext.js';
import Layout from './components/layout/Layout.js';
import Auth from './pages/Auth.js';
import Dashboard from './pages/Dashboard.js';
import TradeScanner from './pages/TradeScanner.js';
import FlyxaAI from './pages/FlyxaAI.js';
import FlyxaAIPatterns from './pages/FlyxaAIPatterns.js';
import FlyxaAIPreSession from './pages/FlyxaAIPreSession.js';
import FlyxaAIEmotionalFingerprint from './pages/FlyxaAIEmotionalFingerprint.js';
import Analytics from './pages/Analytics.js';
import Achievements from './pages/Achievements.js';
import PsychologyTracker from './pages/PsychologyTracker.js';
import Journal from './pages/Journal.js';
import Goals from './pages/Goals.js';
import Chart from './pages/Chart.js';
import Settings from './pages/Settings.js';
import LoadingSpinner from './components/common/LoadingSpinner.js';
import LandingPage from './lumis/pages/LandingPage.js';
import Onboarding from './pages/Onboarding.js';

function shouldSkipOnboarding() {
  if (typeof window === 'undefined') return false;
  const value = window.localStorage.getItem('tw_skip_onboarding');
  return value === '1' || value?.toLowerCase() === 'true';
}

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

function ProtectedLayout() {
  const location = useLocation();
  const { loading, completed } = useOnboarding();
  const skipOnboarding = shouldSkipOnboarding();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading onboarding..." />
      </div>
    );
  }

  if (!completed && !skipOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Layout />;
}

function OnboardingRoute() {
  const { loading, completed } = useOnboarding();
  const skipOnboarding = shouldSkipOnboarding();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading onboarding..." />
      </div>
    );
  }

  if (completed || skipOnboarding) {
    return <Navigate to="/" replace />;
  }

  return <Onboarding />;
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
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/landing" element={<LandingPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingRoute />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scanner" element={<TradeScanner />} />
          <Route path="/flyxa-ai" element={<FlyxaAI />} />
          <Route path="/flyxa-ai/patterns" element={<FlyxaAIPatterns />} />
          <Route path="/flyxa-ai/pre-session" element={<FlyxaAIPreSession />} />
          <Route path="/flyxa-ai/emotional-fingerprint" element={<FlyxaAIEmotionalFingerprint />} />
          <Route path="/coach" element={<Navigate to="/flyxa-ai" replace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/backtest" element={<Chart />} />
          <Route path="/chart" element={<Navigate to="/backtest" replace />} />
          <Route path="/psychology" element={<PsychologyTracker />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/risk" element={<Navigate to="/" replace />} />
          <Route path="/playbook" element={<Navigate to="/" replace />} />
          <Route path="/chart-analyzer" element={<Navigate to="/" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
    </Routes>
  );
}
