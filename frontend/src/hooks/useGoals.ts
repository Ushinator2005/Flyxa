import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import type { Goal } from '../types/goals.js';

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) || '',
    category: row.category as Goal['category'],
    color: row.color as Goal['color'],
    horizon: row.horizon ? (row.horizon as string) : '',
    steps: (row.steps as Goal['steps']) || [],
    createdAt: row.created_at as string,
  };
}

export function useGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setGoals((data ?? []).map(rowToGoal));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const addGoal = useCallback(async (goal: Goal) => {
    if (!user) return;
    const { data, error: err } = await supabase
      .from('goals')
      .insert({
        id: goal.id,
        user_id: user.id,
        title: goal.title,
        description: goal.description,
        category: goal.category,
        color: goal.color,
        horizon: goal.horizon || null,
        steps: goal.steps,
      })
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setGoals(prev => [rowToGoal(data), ...prev]);
  }, [user]);

  const updateGoal = useCallback(async (goal: Goal) => {
    if (!user) return;
    const { data, error: err } = await supabase
      .from('goals')
      .update({
        title: goal.title,
        description: goal.description,
        category: goal.category,
        color: goal.color,
        horizon: goal.horizon || null,
        steps: goal.steps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goal.id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (err) { setError(err.message); return; }
    setGoals(prev => prev.map(g => g.id === goal.id ? rowToGoal(data) : g));
  }, [user]);

  const toggleStep = useCallback(async (goalId: string, stepId: string) => {
    if (!user) return;
    setGoals(prev => {
      const updated = prev.map(g => {
        if (g.id !== goalId) return g;
        const steps = g.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s);
        supabase
          .from('goals')
          .update({ steps, updated_at: new Date().toISOString() })
          .eq('id', goalId)
          .eq('user_id', user.id)
          .then(() => {});
        return { ...g, steps };
      });
      return updated;
    });
  }, [user]);

  return { goals, loading, error, addGoal, updateGoal, toggleStep };
}
