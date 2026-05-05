import type { StateStorage } from 'zustand/middleware';
import { supabase } from '../services/api.js';

const SAVE_DEBOUNCE_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;

function stripBase64Images(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('data:image') || value.startsWith('data:application') ? '' : value;
  }
  if (Array.isArray(value)) return value.map(stripBase64Images);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripBase64Images(v)])
    );
  }
  return value;
}

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function flushSave(userId: string, value: string): Promise<void> {
  try {
    const parsed = JSON.parse(value) as unknown;
    const sanitized = stripBase64Images(parsed);
    await supabase.from('user_store').upsert(
      { user_id: userId, flyxa_data: sanitized, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch {
    // silently fail — data is still in localStorage fallback
  }
}

export const supabaseZustandStorage: StateStorage = {
  getItem: async (_key: string): Promise<string | null> => {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_store')
        .select('flyxa_data')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.flyxa_data) {
        return JSON.stringify(data.flyxa_data);
      }

      // First login — migrate from localStorage if data exists
      const local = localStorage.getItem('flyxa-store');
      if (local) {
        void flushSave(userId, local);
        return local;
      }
    } catch {
      // Fall back to localStorage
      return localStorage.getItem('flyxa-store');
    }

    return null;
  },

  setItem: async (_key: string, value: string): Promise<void> => {
    // Always keep localStorage as a fast local cache
    try { localStorage.setItem('flyxa-store', value); } catch { /* quota exceeded */ }

    pendingValue = value;
    if (saveTimer) clearTimeout(saveTimer);

    const userId = await getUserId();
    if (!userId) return;

    saveTimer = setTimeout(() => {
      if (pendingValue) void flushSave(userId, pendingValue);
    }, SAVE_DEBOUNCE_MS);
  },

  removeItem: async (_key: string): Promise<void> => {
    localStorage.removeItem('flyxa-store');
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('user_store').delete().eq('user_id', userId);
  },
};
