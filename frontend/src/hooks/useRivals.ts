import { useState, useEffect, useCallback } from 'react';
import type { Rival } from '../types/rivals.js';
import { mockRivals } from '../data/rivals.mock.js';
import { getMascotXP } from '../lib/mascotProgression.js';

const STORAGE_KEY = 'flyxa_rivals_v1';

function load(): Rival[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Rival[];
  } catch {}
  return mockRivals;
}

function save(rivals: Rival[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rivals)); } catch {}
}

export function useRivals() {
  const [rivals, setRivals] = useState<Rival[]>(() => load());

  useEffect(() => { save(rivals); }, [rivals]);

  const addRival = useCallback((username: string) => {
    const initials = username.slice(0, 2).toUpperCase();
    const colors = ['#7c3aed', '#0d9488', '#e11d48', '#f59e0b', '#06b6d4'];
    setRivals(prev => {
      const color = colors[prev.length % colors.length];
      const newRival: Rival = {
        id: `rival-${Date.now()}`,
        username,
        displayName: username,
        avatarInitials: initials,
        avatarColor: color,
        mascot: {
          stage: 'seed',
          name: 'The Newcomer',
          streakDays: 0,
          stats: { discipline: 0, psychology: 0, consistency: 0, backtestHours: 0 },
          xp: 0,
        },
      };
      newRival.mascot.xp = getMascotXP(newRival.mascot.streakDays, newRival.mascot.stats);
      return [...prev, newRival];
    });
  }, []);

  const removeRival = useCallback((id: string) => {
    setRivals(prev => prev.filter(r => r.id !== id || r.isMe));
  }, []);

  return { rivals, addRival, removeRival };
}
