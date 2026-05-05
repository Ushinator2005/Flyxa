import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.js';
import useFlyxaStore from '../store/flyxaStore.js';

export type ProfitabilityStatus = 'profitable' | 'breakeven' | 'not_profitable';

export interface OnboardingSurvey {
  whyJournaling: string;
  improvementAreas: string[];
  profitabilityStatus: ProfitabilityStatus | null;
  goldenRules: string[];
}

interface OnboardingContextValue {
  loading: boolean;
  completed: boolean;
  completedAt?: string;
  survey: OnboardingSurvey;
  saveSurvey: (updates: Partial<OnboardingSurvey>) => void;
  completeOnboarding: (survey: OnboardingSurvey) => void;
  resetOnboarding: () => void;
}

const DEFAULT_SURVEY: OnboardingSurvey = {
  whyJournaling: '',
  improvementAreas: [],
  profitabilityStatus: null,
  goldenRules: ['', '', ''],
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

function normalizeRules(rules: unknown): string[] {
  if (!Array.isArray(rules)) return [...DEFAULT_SURVEY.goldenRules];
  const normalized = rules
    .map(rule => (typeof rule === 'string' ? rule.trim() : ''))
    .slice(0, 12);
  while (normalized.length < 3) normalized.push('');
  return normalized;
}

function normalizeImprovementAreas(areas: unknown): string[] {
  if (!Array.isArray(areas)) return [];
  const dedupe = new Set<string>();
  const normalized: string[] = [];
  for (const area of areas) {
    if (typeof area !== 'string') continue;
    const cleaned = area.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    normalized.push(cleaned);
    if (normalized.length >= 12) break;
  }
  return normalized;
}

function parseSurvey(raw: Record<string, unknown>): OnboardingSurvey {
  return {
    whyJournaling: typeof raw.whyJournaling === 'string' ? raw.whyJournaling : '',
    improvementAreas: normalizeImprovementAreas(raw.improvementAreas),
    profitabilityStatus:
      raw.profitabilityStatus === 'profitable'
      || raw.profitabilityStatus === 'breakeven'
      || raw.profitabilityStatus === 'not_profitable'
        ? raw.profitabilityStatus
        : null,
    goldenRules: normalizeRules(raw.goldenRules),
  };
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const storedOnboarding = useFlyxaStore(state => state.onboarding);
  const setOnboardingAction = useFlyxaStore(state => state.setOnboarding);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | undefined>(undefined);
  const [survey, setSurvey] = useState<OnboardingSurvey>({ ...DEFAULT_SURVEY });

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setCompleted(false);
      setCompletedAt(undefined);
      setSurvey({ ...DEFAULT_SURVEY });
      setLoading(false);
      return;
    }

    if (storedOnboarding) {
      setCompleted(storedOnboarding.completed);
      setCompletedAt(storedOnboarding.completedAt);
      setSurvey(parseSurvey(storedOnboarding.survey as unknown as Record<string, unknown>));
    } else {
      // Migrate from localStorage on first use
      const legacyKey = `tw_onboarding_${user.id}`;
      try {
        const raw = window.localStorage.getItem(legacyKey);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown as Record<string, unknown>;
          const migratedSurvey = parseSurvey((parsed.survey ?? {}) as unknown as Record<string, unknown>);
          const migratedState = {
            completed: Boolean(parsed.completed),
            completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
            survey: migratedSurvey as unknown as Record<string, unknown>,
          };
          setCompleted(migratedState.completed);
          setCompletedAt(migratedState.completedAt);
          setSurvey(migratedSurvey);
          setOnboardingAction(migratedState);
        }
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, [authLoading, user?.id, storedOnboarding, setOnboardingAction]);

  const saveSurvey = (updates: Partial<OnboardingSurvey>) => {
    setSurvey(current => {
      const next: OnboardingSurvey = {
        ...current,
        ...updates,
        improvementAreas: updates.improvementAreas ? normalizeImprovementAreas(updates.improvementAreas) : current.improvementAreas,
        goldenRules: updates.goldenRules ? normalizeRules(updates.goldenRules) : current.goldenRules,
      };
      setOnboardingAction({ completed, completedAt, survey: next as unknown as Record<string, unknown> });
      return next;
    });
  };

  const completeOnboarding = (nextSurvey: OnboardingSurvey) => {
    const now = new Date().toISOString();
    const normalized: OnboardingSurvey = {
      whyJournaling: nextSurvey.whyJournaling.trim(),
      improvementAreas: normalizeImprovementAreas(nextSurvey.improvementAreas),
      profitabilityStatus: nextSurvey.profitabilityStatus,
      goldenRules: normalizeRules(nextSurvey.goldenRules),
    };
    setSurvey(normalized);
    setCompleted(true);
    setCompletedAt(now);
    setOnboardingAction({ completed: true, completedAt: now, survey: normalized as unknown as Record<string, unknown> });
  };

  const resetOnboarding = () => {
    setCompleted(false);
    setCompletedAt(undefined);
    setSurvey({ ...DEFAULT_SURVEY });
    setOnboardingAction({ completed: false, survey: { ...DEFAULT_SURVEY } as unknown as Record<string, unknown> });
  };

  const value = useMemo<OnboardingContextValue>(() => ({
    loading,
    completed,
    completedAt,
    survey,
    saveSurvey,
    completeOnboarding,
    resetOnboarding,
  }), [completed, completedAt, loading, survey]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
