import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppPreferences, Trade, TradingAccount, TradingAccountStatus } from '../types/index.js';
import { useAuth } from './AuthContext.js';

export const ALL_ACCOUNTS_ID = 'all';
export const DEFAULT_ACCOUNT_ID = 'default-account';
const DEFAULT_TIMEZONE = 'America/New_York';
const TIMEZONE_STORAGE_KEY = 'settings.timezone';

const SUPPORTED_TIMEZONE_SET = (() => {
  const intlWithSupportedValues = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intlWithSupportedValues.supportedValuesOf?.('timeZone') ?? [];

  if (!zones.includes(DEFAULT_TIMEZONE)) {
    zones.push(DEFAULT_TIMEZONE);
  }

  return new Set(zones);
})();

const DEFAULT_ACCOUNT: TradingAccount = {
  id: DEFAULT_ACCOUNT_ID,
  name: 'Default Account',
  broker: '',
  credentials: '',
  type: 'Futures',
  status: 'Live',
  color: '#3b82f6',
  createdAt: new Date(0).toISOString(),
};

const DEFAULT_PREFERENCES: AppPreferences = {
  dateFormat: 'dd/MM/yyyy',
  currencySymbol: '$',
  timezone: DEFAULT_TIMEZONE,
  defaultTimeframe: '5m',
  defaultChartType: 'Candles',
  sessionTimes: {
    asia: { start: '19:00', end: '04:00' },
    london: { start: '03:00', end: '11:30' },
    preMarket: { start: '07:00', end: '09:30' },
    newYork: { start: '09:30', end: '16:00' },
  },
};

const DEFAULT_CONFLUENCE_OPTIONS = [
  'Liquidity sweep',
  'VWAP reclaim',
  'HTF bias',
  'Session high/low sweep',
  'Market structure shift',
  'Order block retest',
  'Volume confirmation',
];

function normalizeConfluenceOption(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, 64);
}

function normalizeConfluenceOptions(values: unknown): string[] {
  const source = Array.isArray(values) ? values : [];
  const deduped = new Set<string>();
  const normalized: string[] = [];

  for (const value of source) {
    const cleaned = normalizeConfluenceOption(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (deduped.has(key)) continue;
    deduped.add(key);
    normalized.push(cleaned);
    if (normalized.length >= 64) break;
  }

  return normalized.length ? normalized : [...DEFAULT_CONFLUENCE_OPTIONS];
}

function normalizeSessionTimes(raw: unknown): AppPreferences['sessionTimes'] {
  const isValidTime = (value: unknown): value is string => (
    typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
  );

  const readTime = (value: unknown, fallback: string) => (isValidTime(value) ? value : fallback);
  const input = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  const asia = typeof input.asia === 'object' && input.asia !== null ? input.asia as Record<string, unknown> : {};
  const london = typeof input.london === 'object' && input.london !== null ? input.london as Record<string, unknown> : {};
  const preMarket = typeof input.preMarket === 'object' && input.preMarket !== null ? input.preMarket as Record<string, unknown> : {};
  const newYork = typeof input.newYork === 'object' && input.newYork !== null ? input.newYork as Record<string, unknown> : {};

  return {
    asia: {
      start: readTime(asia.start, DEFAULT_PREFERENCES.sessionTimes.asia.start),
      end: readTime(asia.end, DEFAULT_PREFERENCES.sessionTimes.asia.end),
    },
    london: {
      start: readTime(london.start, DEFAULT_PREFERENCES.sessionTimes.london.start),
      end: readTime(london.end, DEFAULT_PREFERENCES.sessionTimes.london.end),
    },
    preMarket: {
      start: readTime(preMarket.start, DEFAULT_PREFERENCES.sessionTimes.preMarket.start),
      end: readTime(preMarket.end, DEFAULT_PREFERENCES.sessionTimes.preMarket.end),
    },
    newYork: {
      start: readTime(newYork.start, DEFAULT_PREFERENCES.sessionTimes.newYork.start),
      end: readTime(newYork.end, DEFAULT_PREFERENCES.sessionTimes.newYork.end),
    },
  };
}

interface AppSettingsContextValue {
  accounts: TradingAccount[];
  preferences: AppPreferences;
  confluenceOptions: string[];
  selectedAccountId: string;
  setSelectedAccountId: (accountId: string) => void;
  addAccount: (account: Omit<TradingAccount, 'id' | 'createdAt'>) => void;
  updateAccount: (accountId: string, updates: Partial<Omit<TradingAccount, 'id' | 'createdAt'>>) => void;
  deleteAccount: (accountId: string) => void;
  addConfluenceOption: (option: string) => void;
  updateConfluenceOption: (index: number, option: string) => void;
  deleteConfluenceOption: (index: number) => void;
  updatePreferences: (updates: Partial<AppPreferences>) => void;
  getDefaultTradeAccountId: () => string;
  resolveTradeAccountId: (trade: Partial<Trade>) => string;
  isTradeAccountAllocatable: (accountId: string) => boolean;
  decorateTrades: (trades: Trade[]) => Trade[];
  filterTradesBySelectedAccount: (trades: Trade[]) => Trade[];
  persistTradeAccount: (tradeId: string, accountId?: string) => void;
  removeTradeAccount: (tradeId: string) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

function getAccountsKey(userId: string) {
  return `tw_accounts_${userId}`;
}

function getPreferencesKey(userId: string) {
  return `tw_preferences_${userId}`;
}

function getSelectedAccountKey(userId: string) {
  return `tw_selected_account_${userId}`;
}

function getTradeAccountsKey(userId: string) {
  return `tw_trade_accounts_${userId}`;
}

function getConfluenceOptionsKey(userId: string) {
  return `tw_confluence_options_${userId}`;
}

function normalizeAccountStatus(
  status: unknown,
  fallbackStatus: TradingAccountStatus = 'Eval'
): TradingAccountStatus {
  return status === 'Eval' || status === 'Funded' || status === 'Live' || status === 'Blown'
    ? status
    : fallbackStatus;
}

function ensureDefaultAccount(accounts: TradingAccount[]): TradingAccount[] {
  const normalizedAccounts = accounts.map(account => ({
    ...account,
    status: normalizeAccountStatus(
      account.status,
      account.id === DEFAULT_ACCOUNT_ID ? DEFAULT_ACCOUNT.status : 'Eval'
    ),
  }));

  const withoutDuplicates = normalizedAccounts.filter((account, index, collection) => (
    collection.findIndex(candidate => candidate.id === account.id) === index
  ));

  if (withoutDuplicates.some(account => account.id === DEFAULT_ACCOUNT_ID)) {
    return withoutDuplicates;
  }

  return [DEFAULT_ACCOUNT, ...withoutDuplicates];
}

function loadAccounts(userId: string): TradingAccount[] {
  if (typeof window === 'undefined') return [DEFAULT_ACCOUNT];

  try {
    const raw = window.localStorage.getItem(getAccountsKey(userId));
    if (!raw) return [DEFAULT_ACCOUNT];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? ensureDefaultAccount(parsed as TradingAccount[]) : [DEFAULT_ACCOUNT];
  } catch {
    return [DEFAULT_ACCOUNT];
  }
}

function loadPreferences(userId: string): AppPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(getPreferencesKey(userId));
    const parsed = raw ? JSON.parse(raw) as Partial<AppPreferences> : {};
    const rawTimezone = window.localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? parsed.timezone ?? DEFAULT_TIMEZONE;
    const normalizedTimezone = SUPPORTED_TIMEZONE_SET.has(rawTimezone) ? rawTimezone : DEFAULT_TIMEZONE;

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      timezone: normalizedTimezone,
      sessionTimes: normalizeSessionTimes(parsed.sessionTimes),
    };
  } catch {
    const fallbackTimezone = window.localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? DEFAULT_TIMEZONE;
    return {
      ...DEFAULT_PREFERENCES,
      timezone: SUPPORTED_TIMEZONE_SET.has(fallbackTimezone) ? fallbackTimezone : DEFAULT_TIMEZONE,
      sessionTimes: DEFAULT_PREFERENCES.sessionTimes,
    };
  }
}

function loadSelectedAccount(userId: string): string {
  if (typeof window === 'undefined') return ALL_ACCOUNTS_ID;
  return window.localStorage.getItem(getSelectedAccountKey(userId)) || ALL_ACCOUNTS_ID;
}

function loadTradeAccounts(userId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getTradeAccountsKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    );
  } catch {
    return {};
  }
}

function loadConfluenceOptions(userId: string): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_CONFLUENCE_OPTIONS];

  try {
    const raw = window.localStorage.getItem(getConfluenceOptionsKey(userId));
    if (!raw) return [...DEFAULT_CONFLUENCE_OPTIONS];
    return normalizeConfluenceOptions(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_CONFLUENCE_OPTIONS];
  }
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([DEFAULT_ACCOUNT]);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [confluenceOptions, setConfluenceOptions] = useState<string[]>([...DEFAULT_CONFLUENCE_OPTIONS]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string>(ALL_ACCOUNTS_ID);
  const [tradeAccounts, setTradeAccounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      setAccounts([DEFAULT_ACCOUNT]);
      setPreferences(DEFAULT_PREFERENCES);
      setConfluenceOptions([...DEFAULT_CONFLUENCE_OPTIONS]);
      setSelectedAccountIdState(ALL_ACCOUNTS_ID);
      setTradeAccounts({});
      return;
    }

    const nextAccounts = loadAccounts(user.id);
    setAccounts(nextAccounts);
    setPreferences(loadPreferences(user.id));
    setConfluenceOptions(loadConfluenceOptions(user.id));
    setTradeAccounts(loadTradeAccounts(user.id));

    const storedSelection = loadSelectedAccount(user.id);
    const isValidSelection = storedSelection === ALL_ACCOUNTS_ID || nextAccounts.some(account => account.id === storedSelection);
    setSelectedAccountIdState(isValidSelection ? storedSelection : ALL_ACCOUNTS_ID);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(getAccountsKey(user.id), JSON.stringify(ensureDefaultAccount(accounts)));
  }, [accounts, user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(getPreferencesKey(user.id), JSON.stringify(preferences));
  }, [preferences, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, preferences.timezone);
  }, [preferences.timezone]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(getSelectedAccountKey(user.id), selectedAccountId);
  }, [selectedAccountId, user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(getTradeAccountsKey(user.id), JSON.stringify(tradeAccounts));
  }, [tradeAccounts, user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(getConfluenceOptionsKey(user.id), JSON.stringify(confluenceOptions));
  }, [confluenceOptions, user]);

  const validAccountIds = useMemo(() => new Set(accounts.map(account => account.id)), [accounts]);
  const accountById = useMemo(
    () => new Map(accounts.map(account => [account.id, account] as const)),
    [accounts]
  );
  const firstAllocatableAccountId = useMemo(
    () => accounts.find(account => account.status !== 'Blown')?.id ?? DEFAULT_ACCOUNT_ID,
    [accounts]
  );

  const isTradeAccountAllocatable = useCallback((accountId: string) => {
    const account = accountById.get(accountId);
    return Boolean(account && account.status !== 'Blown');
  }, [accountById]);

  const getDefaultTradeAccountId = useCallback(() => {
    if (
      selectedAccountId !== ALL_ACCOUNTS_ID
      && validAccountIds.has(selectedAccountId)
      && isTradeAccountAllocatable(selectedAccountId)
    ) {
      return selectedAccountId;
    }

    if (isTradeAccountAllocatable(DEFAULT_ACCOUNT_ID)) {
      return DEFAULT_ACCOUNT_ID;
    }

    return firstAllocatableAccountId;
  }, [firstAllocatableAccountId, isTradeAccountAllocatable, selectedAccountId, validAccountIds]);

  const resolveTradeAccountId = useCallback((trade: Partial<Trade>) => {
    const accountCandidate = trade.accountId || trade.account_id || (trade.id ? tradeAccounts[trade.id] : undefined);
    if (accountCandidate && validAccountIds.has(accountCandidate)) {
      return accountCandidate;
    }

    return DEFAULT_ACCOUNT_ID;
  }, [tradeAccounts, validAccountIds]);

  const decorateTrades = useCallback((trades: Trade[]) => trades.map(trade => ({
    ...trade,
    accountId: resolveTradeAccountId(trade),
  })), [resolveTradeAccountId]);

  const filterTradesBySelectedAccount = useCallback((trades: Trade[]) => {
    const decorated = decorateTrades(trades);
    if (selectedAccountId === ALL_ACCOUNTS_ID) {
      return decorated;
    }

    return decorated.filter(trade => trade.accountId === selectedAccountId);
  }, [decorateTrades, selectedAccountId]);

  const setSelectedAccountId = useCallback((accountId: string) => {
    if (accountId === ALL_ACCOUNTS_ID || validAccountIds.has(accountId)) {
      setSelectedAccountIdState(accountId);
    }
  }, [validAccountIds]);

  const addAccount = useCallback((account: Omit<TradingAccount, 'id' | 'createdAt'>) => {
    const nextAccount: TradingAccount = {
      id: `account-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      ...account,
    };
    setAccounts(current => ensureDefaultAccount([...current, nextAccount]));
  }, []);

  const updateAccount = useCallback((accountId: string, updates: Partial<Omit<TradingAccount, 'id' | 'createdAt'>>) => {
    setAccounts(current => current.map(account => (
      account.id === accountId
        ? { ...account, ...updates }
        : account
    )));
  }, []);

  const deleteAccount = useCallback((accountId: string) => {
    if (accountId === DEFAULT_ACCOUNT_ID) return;

    setAccounts(current => ensureDefaultAccount(current.filter(account => account.id !== accountId)));
    setTradeAccounts(current => Object.fromEntries(
      Object.entries(current).map(([tradeId, mappedAccountId]) => [
        tradeId,
        mappedAccountId === accountId ? DEFAULT_ACCOUNT_ID : mappedAccountId,
      ])
    ));
    setSelectedAccountIdState(current => current === accountId ? ALL_ACCOUNTS_ID : current);
  }, []);

  const updatePreferences = useCallback((updates: Partial<AppPreferences>) => {
    setPreferences(current => ({ ...current, ...updates }));
  }, []);

  const addConfluenceOption = useCallback((option: string) => {
    const normalizedOption = normalizeConfluenceOption(option);
    if (!normalizedOption) return;

    setConfluenceOptions(current => normalizeConfluenceOptions([...current, normalizedOption]));
  }, []);

  const updateConfluenceOption = useCallback((index: number, option: string) => {
    const normalizedOption = normalizeConfluenceOption(option);
    if (!normalizedOption) return;

    setConfluenceOptions(current => normalizeConfluenceOptions(
      current.map((entry, entryIndex) => (entryIndex === index ? normalizedOption : entry))
    ));
  }, []);

  const deleteConfluenceOption = useCallback((index: number) => {
    setConfluenceOptions(current => {
      const next = current.filter((_, entryIndex) => entryIndex !== index);
      return next.length ? next : [...DEFAULT_CONFLUENCE_OPTIONS];
    });
  }, []);

  const persistTradeAccount = useCallback((tradeId: string, accountId?: string) => {
    if (!accountId) return;
    setTradeAccounts(current => ({
      ...current,
      [tradeId]: validAccountIds.has(accountId) ? accountId : DEFAULT_ACCOUNT_ID,
    }));
  }, [validAccountIds]);

  const removeTradeAccount = useCallback((tradeId: string) => {
    setTradeAccounts(current => {
      const next = { ...current };
      delete next[tradeId];
      return next;
    });
  }, []);

  const value = useMemo<AppSettingsContextValue>(() => ({
    accounts,
    preferences,
    confluenceOptions,
    selectedAccountId,
    setSelectedAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    addConfluenceOption,
    updateConfluenceOption,
    deleteConfluenceOption,
    updatePreferences,
    getDefaultTradeAccountId,
    resolveTradeAccountId,
    isTradeAccountAllocatable,
    decorateTrades,
    filterTradesBySelectedAccount,
    persistTradeAccount,
    removeTradeAccount,
  }), [
    accounts,
    preferences,
    confluenceOptions,
    selectedAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    addConfluenceOption,
    updateConfluenceOption,
    deleteConfluenceOption,
    updatePreferences,
    getDefaultTradeAccountId,
    resolveTradeAccountId,
    isTradeAccountAllocatable,
    decorateTrades,
    filterTradesBySelectedAccount,
    persistTradeAccount,
    removeTradeAccount,
  ]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }

  return context;
}
