import type { StateStorage } from 'zustand/middleware';
import { supabase } from '../services/api.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SAVE_DEBOUNCE_MS = 1500;
const LOCAL_SAVED_AT_KEY = 'flyxa-store-saved-at';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;
let cachedUserId: string | null = null;
let cachedToken: string | null = null;

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
  cachedUserId = session?.user?.id ?? null;
  cachedToken = session?.access_token ?? null;
  return cachedUserId;
}

async function flushSave(userId: string, value: string): Promise<void> {
  try {
    const parsed = JSON.parse(value) as unknown;
    const sanitized = stripBase64Images(parsed);
    const now = new Date().toISOString();
    await supabase.from('user_store').upsert(
      { user_id: userId, flyxa_data: sanitized, updated_at: now },
      { onConflict: 'user_id' }
    );
    try { localStorage.setItem(LOCAL_SAVED_AT_KEY, Date.now().toString()); } catch { /* quota */ }
  } catch {
    // silently fail — data is still in localStorage fallback
  }
}

export async function flushSupabaseStoreNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const userId = await getUserId();
  if (!userId) return;

  const value = pendingValue ?? (typeof window !== 'undefined' ? localStorage.getItem('flyxa-store') : null);
  if (!value) return;

  pendingValue = null;
  await flushSave(userId, value);
}

// On page close/refresh, fire a keepalive fetch so the save completes even if
// the tab is being destroyed. Regular async calls are abandoned mid-flight on unload.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (!pendingValue || !cachedUserId || !cachedToken) return;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }

    const value = pendingValue;
    const userId = cachedUserId;
    const token = cachedToken;
    pendingValue = null;

    try {
      const parsed = JSON.parse(value) as unknown;
      const sanitized = stripBase64Images(parsed);
      const body = JSON.stringify([{
        user_id: userId,
        flyxa_data: sanitized,
        updated_at: new Date().toISOString(),
      }]);

      // keepalive: true ensures this request outlives the page
      void fetch(`${SUPABASE_URL}/rest/v1/user_store?on_conflict=user_id`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
        body,
      });
    } catch { /* ignore — localStorage still has the data */ }
  });
}

export const supabaseZustandStorage: StateStorage = {
  getItem: async (_key: string): Promise<string | null> => {
    const userId = await getUserId();
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_store')
        .select('flyxa_data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.flyxa_data) {
        const supabaseMs = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        const localSavedMs = parseInt(localStorage.getItem(LOCAL_SAVED_AT_KEY) ?? '0', 10);
        const local = localStorage.getItem('flyxa-store');

        // Only prefer local over Supabase if:
        // 1. Local was written after the last confirmed Supabase save (unsaved changes), AND
        // 2. Local actually has more journal entries than Supabase (never overwrite with less data)
        if (local && localSavedMs > supabaseMs + 2000) {
          try {
            const localParsed = JSON.parse(local) as { state?: { entries?: unknown[] } };
            const remoteParsed = data.flyxa_data as { state?: { entries?: unknown[] } };
            const localEntryCount = localParsed?.state?.entries?.length ?? 0;
            const remoteEntryCount = remoteParsed?.state?.entries?.length ?? 0;

            // Local is only authoritative if it has at least as many entries as Supabase
            if (localEntryCount >= remoteEntryCount) {
              void flushSave(userId, local);
              return local;
            }
          } catch { /* fall through to use Supabase */ }
        }

        return JSON.stringify(data.flyxa_data);
      }

      // No Supabase record yet — migrate from localStorage if data exists
      const local = localStorage.getItem('flyxa-store');
      if (local) {
        void flushSave(userId, local);
        return local;
      }
    } catch {
      // Supabase unreachable — fall back to localStorage
      return localStorage.getItem('flyxa-store');
    }

    return null;
  },

  setItem: async (_key: string, value: string): Promise<void> => {
    // Keep localStorage as a fast local cache and record when it was last written
    try {
      localStorage.setItem('flyxa-store', value);
      localStorage.setItem(LOCAL_SAVED_AT_KEY, Date.now().toString());
    } catch { /* quota exceeded */ }

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
    localStorage.removeItem(LOCAL_SAVED_AT_KEY);
    const userId = await getUserId();
    if (!userId) return;
    await supabase.from('user_store').delete().eq('user_id', userId);
  },
};
