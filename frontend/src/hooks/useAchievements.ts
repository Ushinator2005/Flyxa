import { useMemo, useEffect } from 'react';
import { useTrades } from './useTrades.js';
import { useAuth } from '../contexts/AuthContext.js';
import { computeStreaks, computeUnlockedKeys, ACHIEVEMENT_DEFS } from '../utils/streaks.js';

export interface Achievement {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface StoredAchievements {
  unlockedAt: Record<string, string>;
}

function storageKey(userId: string): string {
  return `tw_achievements_${userId}`;
}

function loadStored(userId: string): StoredAchievements {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return JSON.parse(raw) as StoredAchievements;
  } catch { /* ignore */ }
  return { unlockedAt: {} };
}

function saveStored(userId: string, data: StoredAchievements): void {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(data)); } catch { /* ignore */ }
}

export function useAchievements() {
  const { trades, loading } = useTrades();
  const { user } = useAuth();

  const stats = useMemo(() => computeStreaks(trades), [trades]);
  const unlockedKeys = useMemo(() => computeUnlockedKeys(trades), [trades]);

  // Stamp unlock timestamps the first time each achievement is earned
  useEffect(() => {
    if (!user || loading) return;
    const stored = loadStored(user.id);
    let changed = false;
    for (const key of unlockedKeys) {
      if (!stored.unlockedAt[key]) {
        stored.unlockedAt[key] = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) saveStored(user.id, stored);
  }, [unlockedKeys, user, loading]);

  const achievements = useMemo<Achievement[]>(() => {
    const stored = user ? loadStored(user.id) : { unlockedAt: {} };
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: unlockedKeys.has(def.key),
      unlockedAt: stored.unlockedAt[def.key] ?? null,
    }));
  }, [unlockedKeys, user]);

  return {
    stats,
    achievements,
    unlockedCount: unlockedKeys.size,
    totalCount: ACHIEVEMENT_DEFS.length,
    loading,
  };
}
