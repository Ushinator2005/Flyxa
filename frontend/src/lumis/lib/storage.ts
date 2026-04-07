export type LumisUser = {
  name: string;
  email: string;
  password: string;
};

export type LumisSession = {
  name: string;
  email: string;
};

export type LumisEntry = {
  id: string;
  title: string;
  body: string;
  date: string;
};

const USERS_KEY = 'lumis_users';
const SESSION_KEY = 'lumis_session';

function readJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function entriesKey(email: string) {
  return `lumis_journal_${email.toLowerCase()}`;
}

export function getUsers(): LumisUser[] {
  return readJson<LumisUser[]>(USERS_KEY, []);
}

export function getSession(): LumisSession | null {
  return readJson<LumisSession | null>(SESSION_KEY, null);
}

export function setSession(session: LumisSession) {
  writeJson(SESSION_KEY, session);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function signUpUser(user: LumisUser): { ok: true; session: LumisSession } | { ok: false; error: string } {
  const users = getUsers();
  const existing = users.find(entry => entry.email.toLowerCase() === user.email.toLowerCase());

  if (existing) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  const nextUsers = [...users, { ...user, email: user.email.toLowerCase() }];
  writeJson(USERS_KEY, nextUsers);
  const session = { name: user.name, email: user.email.toLowerCase() };
  setSession(session);
  return { ok: true, session };
}

export function signInUser(email: string, password: string): { ok: true; session: LumisSession } | { ok: false; error: string } {
  const user = getUsers().find(entry => entry.email.toLowerCase() === email.toLowerCase() && entry.password === password);

  if (!user) {
    return { ok: false, error: 'Invalid email or password' };
  }

  const session = { name: user.name, email: user.email.toLowerCase() };
  setSession(session);
  return { ok: true, session };
}

export function getJournalEntries(email: string): LumisEntry[] {
  const entries = readJson<LumisEntry[]>(entriesKey(email), []);
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function saveJournalEntries(email: string, entries: LumisEntry[]) {
  writeJson(entriesKey(email), entries);
}

export function createJournalEntry(): LumisEntry {
  const now = new Date();
  const identifier = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: identifier,
    title: 'Untitled Entry',
    body: '',
    date: now.toISOString(),
  };
}
