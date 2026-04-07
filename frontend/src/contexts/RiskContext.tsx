import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { riskApi } from '../services/api.js';
import { RiskSettings, DailyStatus } from '../types/index.js';
import { useAuth } from './AuthContext.js';

type RiskLevel = 'normal' | 'warning' | 'danger' | 'locked';

interface RiskContextType {
  settings: RiskSettings | null;
  dailyStatus: DailyStatus | null;
  riskLevel: RiskLevel;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  refreshDailyStatus: () => Promise<void>;
}

const RiskContext = createContext<RiskContextType | undefined>(undefined);

export function RiskProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const getRiskLevel = (status: DailyStatus | null): RiskLevel => {
    if (!status) return 'normal';
    const pct = status.lossUsedPercent;
    if (pct >= 100) return 'locked';
    if (pct >= 90) return 'danger';
    if (pct >= 75) return 'warning';
    return 'normal';
  };

  const refreshSettings = useCallback(async () => {
    try {
      const data = await riskApi.getSettings() as RiskSettings;
      setSettings(data);
    } catch {
      // silently fail
    }
  }, []);

  const refreshDailyStatus = useCallback(async () => {
    try {
      const data = await riskApi.getDailyStatus() as DailyStatus;
      setDailyStatus(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    Promise.all([refreshSettings(), refreshDailyStatus()]).finally(() => setLoading(false));

    // Poll every 30 seconds
    const interval = setInterval(() => {
      refreshDailyStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, refreshSettings, refreshDailyStatus]);

  const riskLevel = getRiskLevel(dailyStatus);

  return (
    <RiskContext.Provider value={{
      settings,
      dailyStatus,
      riskLevel,
      loading,
      refreshSettings,
      refreshDailyStatus,
    }}>
      {children}
    </RiskContext.Provider>
  );
}

export function useRisk() {
  const context = useContext(RiskContext);
  if (!context) throw new Error('useRisk must be used within RiskProvider');
  return context;
}
