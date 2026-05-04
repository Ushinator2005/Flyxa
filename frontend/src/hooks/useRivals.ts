import { useMemo, useState } from 'react';
import type { Rival } from '../types/rivals.js';
import { mockRivals } from '../data/rivals.mock.js';
import { getMascotXP } from '../lib/mascotProgression.js';
import { useActiveAccountEntries, useJournalStreak } from '../store/selectors.js';

const STORAGE_KEY = 'flyxa_rivals_v1';

function loadStoredRivals(): Rival[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Rival[];
  } catch {
    // Ignore parse errors.
  }
  return mockRivals.filter((rival) => !rival.isMe);
}

function saveRivals(rivals: Rival[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rivals.filter((rival) => !rival.isMe)));
  } catch {
    // Ignore write failures.
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function useRivals() {
  const [storedRivals, setStoredRivals] = useState<Rival[]>(() => loadStoredRivals());
  const entries = useActiveAccountEntries();
  const journalStreak = useJournalStreak();

  const myRival = useMemo(() => {
    const last30 = [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    const discipline = mean(last30.map((entry) => entry.psychology.discipline)) * 20;
    const psychology = mean(last30.map((entry) => (
      (entry.psychology.setupQuality + entry.psychology.discipline + entry.psychology.execution) / 3
    ))) * 20;

    const ruleRates = last30.map((entry) => {
      const scored = entry.rules.filter((rule) => rule.state !== 'unchecked');
      if (scored.length === 0) return 0;
      const passed = scored.filter((rule) => rule.state === 'ok').length;
      return (passed / scored.length) * 100;
    });
    const consistency = mean(ruleRates);

    const me: Rival = {
      id: 'rival-me',
      username: 'you',
      displayName: 'You',
      avatarInitials: 'YU',
      avatarColor: '#f59e0b',
      isMe: true,
      mascot: {
        stage: journalStreak >= 60 ? 'apex' : journalStreak >= 30 ? 'elite' : journalStreak >= 14 ? 'veteran' : journalStreak >= 7 ? 'rookie' : 'seed',
        name: 'Alex Chen',
        streakDays: journalStreak,
        stats: {
          discipline: Math.round(discipline),
          psychology: Math.round(psychology),
          consistency: Math.round(consistency),
          backtestHours: 0,
        },
        xp: 0,
      },
    };

    me.mascot.xp = getMascotXP(me.mascot.streakDays, me.mascot.stats);
    return me;
  }, [entries, journalStreak]);

  const rivals = useMemo(() => {
    const list = [myRival, ...storedRivals.filter((rival) => !rival.isMe)];
    return list;
  }, [myRival, storedRivals]);

  const addRival = (username: string) => {
    const initials = username.slice(0, 2).toUpperCase();
    const colors = ['#7c3aed', '#0d9488', '#e11d48', '#f59e0b', '#06b6d4'];
    const newRival: Rival = {
      id: `rival-${Date.now()}`,
      username,
      displayName: username,
      avatarInitials: initials,
      avatarColor: colors[storedRivals.length % colors.length],
      mascot: {
        stage: 'seed',
        name: 'The Newcomer',
        streakDays: 0,
        stats: { discipline: 0, psychology: 0, consistency: 0, backtestHours: 0 },
        xp: 0,
      },
    };
    newRival.mascot.xp = getMascotXP(newRival.mascot.streakDays, newRival.mascot.stats);
    setStoredRivals((current) => {
      const next = [...current, newRival];
      saveRivals(next);
      return next;
    });
  };

  const removeRival = (id: string) => {
    setStoredRivals((current) => {
      const next = current.filter((rival) => rival.id !== id);
      saveRivals(next);
      return next;
    });
  };

  return { rivals, addRival, removeRival };
}
