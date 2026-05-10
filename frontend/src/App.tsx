import { useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import Layout from './components/layout/Layout.js';
import Auth from './pages/Auth.js';
import Dashboard from './pages/Dashboard.js';
import FlyxaAI from './pages/FlyxaAI.js';
import FlyxaAIPatterns from './pages/FlyxaAIPatterns.js';
import FlyxaAIPreSession from './pages/FlyxaAIPreSession.js';
import FlyxaAIEmotionalFingerprint from './pages/FlyxaAIEmotionalFingerprint.js';
import Analytics from './pages/Analytics.js';
import Achievements from './pages/Achievements.js';
import PsychologyTracker from './pages/PsychologyTracker.js';
import Goals from './pages/Goals.js';
import Rivals from './pages/Rivals.js';
import Journal from './pages/Journal.js';
import Backtest from './pages/Backtest.js';
import TradingPlan from './pages/TradingPlan.js';
import Billing from './pages/Billing.js';
import Settings from './pages/Settings.js';
import MarketNews from './pages/MarketNews.js';
import TradeScanner from './pages/TradeScanner.js';
import LoadingSpinner from './components/common/LoadingSpinner.js';
import ToastStack from './components/common/Toast.js';
import useFlyxaStore from './store/flyxaStore.js';
import { useDailyLossUsed } from './store/selectors.js';
import { pushToast } from './store/toastStore.js';
import { useBackgroundNewsPoller } from './hooks/useBackgroundNewsPoller.js';

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
  return <Layout />;
}

export default function App() {
  const { user, loading } = useAuth();
  const hydrateSharedData = useFlyxaStore(state => state.hydrateSharedData);
  const hasWarned80 = useRef(false);
  const hasWarnedHit = useRef(false);
  const dailyLoss = useDailyLossUsed();

  // Silently poll Finnhub every 5 min; write AI-confirmed breaking news to
  // flyxa_breaking_cache_v1 so the Dashboard bubble fires without the user
  // having to open the Market News page first.
  useBackgroundNewsPoller(!!user);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if (window.localStorage.getItem('flyxa_store_migrated_v1') === '1') return;

    const payload: Record<string, unknown> = {};

    try {
      const entriesRaw = window.localStorage.getItem('flyxa_entries');
      if (entriesRaw) payload.entries = JSON.parse(entriesRaw) as unknown;
    } catch {
      // Ignore malformed legacy data.
    }

    try {
      const billingRaw = window.localStorage.getItem('flyxa_billing_accounts');
      if (billingRaw) payload.billingAccounts = JSON.parse(billingRaw) as unknown;
    } catch {
      // Ignore malformed legacy data.
    }

    try {
      const tradingPlanRaw = window.localStorage.getItem('flyxa_trading_plan_state_v1');
      if (tradingPlanRaw) {
        const parsed = JSON.parse(tradingPlanRaw) as {
          planBlocks?: unknown;
          checklist?: unknown;
          setups?: unknown;
        };
        if (parsed.planBlocks) payload.planBlocks = parsed.planBlocks;
        if (parsed.checklist) payload.checklist = parsed.checklist;
        if (parsed.setups) payload.setupPlaybook = parsed.setups;
      }
    } catch {
      // Ignore malformed legacy data.
    }

    try {
      const checklistRaw = window.localStorage.getItem('flyxa_checklist');
      if (checklistRaw && !payload.checklist) {
        const parsed = JSON.parse(checklistRaw) as unknown[];
        if (Array.isArray(parsed)) {
          payload.checklist = parsed.map((text, index) => ({
            id: `cl-${index + 1}`,
            text: typeof text === 'string' ? text : `Rule ${index + 1}`,
            done: false,
          }));
        }
      }
    } catch {
      // Ignore malformed legacy data.
    }

    try {
      const prefsRaw = window.localStorage.getItem(`tw_preferences_${user.id}`);
      if (prefsRaw) {
        const parsed = JSON.parse(prefsRaw) as { scannerColors?: unknown };
        if (parsed.scannerColors && typeof parsed.scannerColors === 'object') {
          payload.scannerColors = parsed.scannerColors;
        }
      }
    } catch {
      // Ignore malformed legacy data.
    }

    try {
      const goalsRaw = window.localStorage.getItem('tw_goals_local');
      if (goalsRaw) payload.goals = JSON.parse(goalsRaw) as unknown;
    } catch {
      // Ignore malformed legacy data.
    }

    if (Object.keys(payload).length > 0) {
      hydrateSharedData(payload as any);
    }

    [
      'flyxa_entries',
      'flyxa_accounts',
      'flyxa_billing_accounts',
      'flyxa_trading_plan_state_v1',
      'flyxa_checklist',
      'tw_goals_local',
    ].forEach((key) => window.localStorage.removeItem(key));

    window.localStorage.setItem('flyxa_store_migrated_v1', '1');
  }, [hydrateSharedData, user]);


  useEffect(() => {
    if (dailyLoss.limit <= 0) return;

    if (dailyLoss.pct >= 100 && !hasWarnedHit.current) {
      pushToast({
        tone: 'red',
        durationMs: null,
        message: `Daily loss limit reached - stop trading for today`,
      });
      hasWarnedHit.current = true;
      hasWarned80.current = true;
      return;
    }

    if (dailyLoss.pct >= 80 && !hasWarned80.current) {
      pushToast({
        tone: 'red',
        durationMs: null,
        message: `Daily loss limit: 80% used - ${dailyLoss.remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })} remaining`,
      });
      hasWarned80.current = true;
    }

    if (dailyLoss.pct < 80) {
      hasWarned80.current = false;
      hasWarnedHit.current = false;
    }
  }, [dailyLoss.limit, dailyLoss.pct, dailyLoss.remaining]);

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
        <Route path="/landing" element={<Navigate to={user ? '/' : '/auth'} replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scanner" element={<TradeScanner />} />
            <Route path="/trade-scanner" element={<TradeScanner />} />
            <Route path="/market-news" element={<MarketNews />} />
            <Route path="/flyxa-ai" element={<FlyxaAI />} />
            <Route path="/flyxa-ai/patterns" element={<FlyxaAIPatterns />} />
            <Route path="/flyxa-ai/pre-session" element={<FlyxaAIPreSession />} />
            <Route path="/flyxa-ai/emotional-fingerprint" element={<FlyxaAIEmotionalFingerprint />} />
            <Route path="/coach" element={<Navigate to="/flyxa-ai" replace />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/backtest" element={<Backtest />} />
            <Route path="/trading-plan" element={<TradingPlan />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/chart" element={<Navigate to="/backtest" replace />} />
            <Route path="/psychology" element={<PsychologyTracker />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/rivals" element={<Rivals />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/risk" element={<Navigate to="/" replace />} />
            <Route path="/playbook" element={<Navigate to="/" replace />} />
            <Route path="/chart-analyzer" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
      </Routes>
      <ToastStack />
    </>
  );
}
