import { useEffect, useMemo, useRef } from 'react';
import useFlyxaStore from '../store/flyxaStore.js';
import { useAllTrades, useActiveAccountEntries, useJournalStreak } from '../store/selectors.js';
import type { Goal } from '../types/goals.js';
import { pushToast } from '../store/toastStore.js';

export type { Goal, GoalStep, GoalStatus } from '../types/goals.js';

type GoalProgressMeta = Goal & {
  type?: 'financial' | 'discipline' | 'consistency' | 'trade_count' | 'funded';
  target?: number;
};

export function useGoalProgress(goal: GoalProgressMeta): number {
  const trades = useAllTrades();
  const entries = useActiveAccountEntries();
  const billingAccounts = useFlyxaStore((state) => state.billingAccounts);
  const journalStreak = useJournalStreak();

  return useMemo(() => {
    const target = goal.target ?? 100;
    if (target <= 0) return 0;

    if (goal.type === 'financial') {
      const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
      return Math.min(100, Math.max(0, (totalPnL / target) * 100));
    }

    if (goal.type === 'funded') {
      const passed = billingAccounts.filter((account) => account.status === 'Passed').length;
      return Math.min(100, Math.max(0, (passed / target) * 100));
    }

    if (goal.type === 'discipline') {
      const average = entries.length
        ? entries.reduce((sum, entry) => sum + entry.psychology.discipline, 0) / entries.length
        : 0;
      return Math.min(100, Math.max(0, (average / target) * 100));
    }

    if (goal.type === 'consistency') {
      return Math.min(100, Math.max(0, (journalStreak / target) * 100));
    }

    if (goal.type === 'trade_count') {
      return Math.min(100, Math.max(0, (trades.length / target) * 100));
    }

    const completed = goal.steps.filter((step) => step.done).length;
    return goal.steps.length ? (completed / goal.steps.length) * 100 : 0;
  }, [billingAccounts, entries, goal, journalStreak, trades]);
}

export function useGoals() {
  const goals = useFlyxaStore((state) => state.goals) as Goal[];
  const addGoalToStore = useFlyxaStore((state) => state.addGoal);
  const updateGoalInStore = useFlyxaStore((state) => state.updateGoal);
  const notifiedGoalsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    goals.forEach((goal) => {
      const completedBySteps = goal.steps.length > 0 && goal.steps.every((step) => step.done);
      const completed = goal.status === 'Achieved' || completedBySteps;
      if (completed && !notifiedGoalsRef.current.has(goal.id)) {
        notifiedGoalsRef.current.add(goal.id);
        pushToast({
          tone: 'amber',
          durationMs: 4000,
          message: `Goal achieved: ${goal.title}`,
        });
      }
    });
  }, [goals]);

  const addGoal = (goal: Goal) => {
    addGoalToStore(goal as any);
  };

  const updateGoal = (goal: Goal) => {
    updateGoalInStore(goal.id, goal as any);
  };

  const toggleStep = (goalId: string, stepId: string) => {
    const goal = useFlyxaStore.getState().goals.find((item) => item.id === goalId);
    if (!goal) return;

    updateGoalInStore(goalId, {
      steps: goal.steps.map((step) => (
        step.id === stepId ? { ...step, done: !step.done } : step
      )),
    });
  };

  return {
    goals,
    loading: false,
    error: null,
    addGoal,
    updateGoal,
    toggleStep,
  };
}
