import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.js';

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

function onboardingStorageKey(userId: string) {
  return `tw_onboarding_${userId}`;
}

interface StoredOnboardingState {
  completed: boolean;
  completedAt?: string;
  survey: OnboardingSurvey;
}

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

function loadOnboardingState(userId: string): StoredOnboardingState {
  if (typeof window === 'undefined') {
    return { completed: false, survey: { ...DEFAULT_SURVEY } };
  }

  try {
    const raw = window.localStorage.getItem(onboardingStorageKey(userId));
    if (!raw) {
      return { completed: false, survey: { ...DEFAULT_SURVEY } };
    }
    const parsed = JSON.parse(raw) as Partial<StoredOnboardingState>;
    const survey = (parsed.survey ?? {}) as Partial<OnboardingSurvey>;
    const normalizedSurvey: OnboardingSurvey = {
      whyJournaling: typeof survey.whyJournaling === 'string' ? survey.whyJournaling : '',
      improvementAreas: normalizeImprovementAreas(survey.improvementAreas),
      profitabilityStatus:
        survey.profitabilityStatus === 'profitable'
        || survey.profitabilityStatus === 'breakeven'
        || survey.profitabilityStatus === 'not_profitable'
          ? survey.profitabilityStatus
          : null,
      goldenRules: normalizeRules(survey.goldenRules),
    };

    return {
      completed: Boolean(parsed.completed),
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
      survey: normalizedSurvey,
    };
  } catch {
    return { completed: false, survey: { ...DEFAULT_SURVEY } };
  }
}

function persistOnboardingState(userId: string, state: StoredOnboardingState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(onboardingStorageKey(userId), JSON.stringify(state));
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
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

    const state = loadOnboardingState(user.id);
    setCompleted(state.completed);
    setCompletedAt(state.completedAt);
    setSurvey(state.survey);
    setLoading(false);
  }, [authLoading, user?.id]);

  const saveSurvey = (updates: Partial<OnboardingSurvey>) => {
    setSurvey(current => {
      const next: OnboardingSurvey = {
        ...current,
        ...updates,
        improvementAreas: updates.improvementAreas ? normalizeImprovementAreas(updates.improvementAreas) : current.improvementAreas,
        goldenRules: updates.goldenRules ? normalizeRules(updates.goldenRules) : current.goldenRules,
      };

      if (user?.id) {
        persistOnboardingState(user.id, {
          completed,
          completedAt,
          survey: next,
        });
      }

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

    if (user?.id) {
      persistOnboardingState(user.id, {
        completed: true,
        completedAt: now,
        survey: normalized,
      });
    }
  };

  const resetOnboarding = () => {
    setCompleted(false);
    setCompletedAt(undefined);
    setSurvey({ ...DEFAULT_SURVEY });
    if (user?.id) {
      persistOnboardingState(user.id, {
        completed: false,
        survey: { ...DEFAULT_SURVEY },
      });
    }
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
