import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  FastForward,
  LayoutTemplate,
  Moon,
  Pause,
  Play,
  Rewind,
  Search,
  ShoppingCart,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { analyticsApi } from '../services/api.js';
import { useRisk } from '../contexts/RiskContext.js';
import { AnalyticsSummary } from '../types/index.js';
import { formatCurrency } from '../utils/calculations.js';

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

type ChartInterval = '1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W';
type ReplaySpeed = 1 | 2 | 5 | 10 | 25 | 50;
type RailPanel = 'order' | 'goto' | null;

interface SymbolSuggestion {
  display: string;
  widgetSymbol: string;
  description: string;
}

interface BacktestConfig {
  sessionId: string;
  symbolDisplay: string;
  widgetSymbol: string;
  timeframe: ChartInterval;
  accountBalance: number;
  startDate: string;
  endDate: string;
  speed: ReplaySpeed;
}

interface BacktestSessionRecord extends BacktestConfig {
  createdAt: string;
  lastOpenedAt: string;
}

const TV_SCRIPT_SRC = 'https://s3.tradingview.com/tv.js';
const TV_CONTAINER_ID = 'tradingview_chart';
const BACKTEST_CONFIG_KEY = 'tw_backtest_config_v1';
const BACKTEST_HISTORY_KEY = 'tw_backtest_history_v1';

const TIMEFRAME_OPTIONS: Array<{ label: string; value: ChartInterval }> = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
];

const SPEED_OPTIONS: ReplaySpeed[] = [1, 2, 5, 10, 25, 50];

const SYMBOL_SUGGESTIONS: SymbolSuggestion[] = [
  { display: 'NQ1', widgetSymbol: 'OANDA:NAS100USD', description: 'Nasdaq 100 CFD' },
  { display: 'NQ', widgetSymbol: 'OANDA:NAS100USD', description: 'Nasdaq 100 CFD' },
  { display: 'ES1', widgetSymbol: 'OANDA:SPX500USD', description: 'S&P 500 CFD' },
  { display: 'ES', widgetSymbol: 'OANDA:SPX500USD', description: 'S&P 500 CFD' },
  { display: 'EURUSD', widgetSymbol: 'FX:EURUSD', description: 'Euro / US Dollar' },
  { display: 'GBPUSD', widgetSymbol: 'FX:GBPUSD', description: 'British Pound / US Dollar' },
  { display: 'USDJPY', widgetSymbol: 'FX:USDJPY', description: 'US Dollar / Japanese Yen' },
  { display: 'AAPL', widgetSymbol: 'NASDAQ:AAPL', description: 'Apple' },
  { display: 'NVDA', widgetSymbol: 'NASDAQ:NVDA', description: 'NVIDIA' },
  { display: 'MSFT', widgetSymbol: 'NASDAQ:MSFT', description: 'Microsoft' },
  { display: 'TSLA', widgetSymbol: 'NASDAQ:TSLA', description: 'Tesla' },
];

let tradingViewScriptPromise: Promise<void> | null = null;

function loadTradingViewScript() {
  if (window.TradingView?.widget) {
    return Promise.resolve();
  }

  if (tradingViewScriptPromise) {
    return tradingViewScriptPromise;
  }

  tradingViewScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TV_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load TradingView widget script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load TradingView widget script.'));
    document.body.appendChild(script);
  });

  return tradingViewScriptPromise;
}

function formatUtcTime(now: Date) {
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)} UTC`;
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    startDate: formatInputDate(start),
    endDate: formatInputDate(end),
  };
}

function getTimeframeLabel(value: ChartInterval) {
  return TIMEFRAME_OPTIONS.find(item => item.value === value)?.label ?? value;
}

function parseStoredConfig() {
  const raw = sessionStorage.getItem(BACKTEST_CONFIG_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BacktestConfig>;
    if (!parsed.symbolDisplay || !parsed.widgetSymbol || !parsed.timeframe) {
      return null;
    }

    return {
      sessionId: parsed.sessionId || `session-${Date.now()}`,
      symbolDisplay: parsed.symbolDisplay,
      widgetSymbol: parsed.widgetSymbol,
      timeframe: parsed.timeframe,
      accountBalance: Number(parsed.accountBalance || 0),
      startDate: parsed.startDate || getDefaultDates().startDate,
      endDate: parsed.endDate || getDefaultDates().endDate,
      speed: (parsed.speed as ReplaySpeed) || 1,
    } satisfies BacktestConfig;
  } catch {
    return null;
  }
}

function parseStoredHistory() {
  const raw = localStorage.getItem(BACKTEST_HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<BacktestSessionRecord> & { id?: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(item => item.symbolDisplay && item.widgetSymbol && item.timeframe)
      .map((item, index) => ({
        sessionId: item.sessionId || item.id || `history-${index}-${Date.now()}`,
        symbolDisplay: item.symbolDisplay as string,
        widgetSymbol: item.widgetSymbol as string,
        timeframe: item.timeframe as ChartInterval,
        accountBalance: Number(item.accountBalance || 0),
        startDate: item.startDate || getDefaultDates().startDate,
        endDate: item.endDate || getDefaultDates().endDate,
        speed: (item.speed as ReplaySpeed) || 1,
        createdAt: item.createdAt || new Date().toISOString(),
        lastOpenedAt: item.lastOpenedAt || item.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
  } catch {
    return [];
  }
}

function resolveSymbol(input: string) {
  const normalized = input.trim().toUpperCase();
  const directMatch = SYMBOL_SUGGESTIONS.find(item => item.display === normalized);

  if (directMatch) {
    return directMatch;
  }

  if (!normalized) {
    return SYMBOL_SUGGESTIONS[0];
  }

  return {
    display: normalized,
    widgetSymbol: normalized,
    description: 'Custom symbol',
  };
}

function toSessionRecord(config: BacktestConfig): BacktestSessionRecord {
  const timestamp = new Date().toISOString();
  return {
    ...config,
    createdAt: timestamp,
    lastOpenedAt: timestamp,
  };
}

export default function Chart() {
  const navigate = useNavigate();
  const { settings } = useRisk();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const symbolMenuRef = useRef<HTMLDivElement | null>(null);
  const timeframeMenuRef = useRef<HTMLDivElement | null>(null);
  const speedMenuRef = useRef<HTMLDivElement | null>(null);
  const setupSearchRef = useRef<HTMLDivElement | null>(null);

  const defaultDates = getDefaultDates();
  const [config, setConfig] = useState<BacktestConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<BacktestConfig | null>(() => parseStoredConfig());
  const [sessionHistory, setSessionHistory] = useState<BacktestSessionRecord[]>(() => parseStoredHistory());
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const [setupSymbolInput, setSetupSymbolInput] = useState('NQ1');
  const [setupTimeframe, setSetupTimeframe] = useState<ChartInterval>('1');
  const [setupAccountBalance, setSetupAccountBalance] = useState(String(settings?.account_size ?? 10000));
  const [setupStartDate, setSetupStartDate] = useState(defaultDates.startDate);
  const [setupEndDate, setSetupEndDate] = useState(defaultDates.endDate);
  const [setupSpeed, setSetupSpeed] = useState<ReplaySpeed>(1);
  const [setupError, setSetupError] = useState('');
  const [showSetupSuggestions, setShowSetupSuggestions] = useState(false);

  const [symbolInput, setSymbolInput] = useState('NQ1');
  const [activeSymbol, setActiveSymbol] = useState<SymbolSuggestion>(SYMBOL_SUGGESTIONS[0]);
  const [interval, setInterval] = useState<ChartInterval>('1');
  const [widgetError, setWidgetError] = useState('');
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCursor, setReplayCursor] = useState(0);
  const [darkToggle, setDarkToggle] = useState(true);
  const [usePercentScale, setUsePercentScale] = useState(false);
  const [autoScale, setAutoScale] = useState(true);
  const [railPanel, setRailPanel] = useState<RailPanel>(null);
  const [jumpDate, setJumpDate] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const filteredSetupSymbols = useMemo(() => {
    const query = setupSymbolInput.trim().toUpperCase();
    if (!query) {
      return SYMBOL_SUGGESTIONS;
    }

    return SYMBOL_SUGGESTIONS.filter(item => (
      item.display.startsWith(query) ||
      item.widgetSymbol.toUpperCase().includes(query) ||
      item.description.toUpperCase().includes(query)
    ));
  }, [setupSymbolInput]);

  const filteredSymbols = useMemo(() => {
    const query = symbolInput.trim().toUpperCase();
    if (!query) {
      return SYMBOL_SUGGESTIONS;
    }

    return SYMBOL_SUGGESTIONS.filter(item => (
      item.display.startsWith(query) ||
      item.widgetSymbol.toUpperCase().includes(query) ||
      item.description.toUpperCase().includes(query)
    ));
  }, [symbolInput]);

  const dashboardStats = useMemo(() => {
    const totalSessions = sessionHistory.length;
    const uniqueMarkets = new Set(sessionHistory.map(item => item.symbolDisplay)).size;
    const averageBalance = totalSessions
      ? sessionHistory.reduce((sum, item) => sum + item.accountBalance, 0) / totalSessions
      : 0;
    const timeframeCounts = sessionHistory.reduce<Record<string, number>>((counts, item) => {
      counts[item.timeframe] = (counts[item.timeframe] || 0) + 1;
      return counts;
    }, {});
    const favoriteTimeframe = Object.entries(timeframeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ChartInterval | undefined;

    return {
      totalSessions,
      uniqueMarkets,
      averageBalance,
      favoriteTimeframe: favoriteTimeframe ? getTimeframeLabel(favoriteTimeframe) : '-',
      latestSession: sessionHistory[0] ?? null,
    };
  }, [sessionHistory]);

  useEffect(() => {
    if (!config) {
      return;
    }

    setActiveSymbol({
      display: config.symbolDisplay,
      widgetSymbol: config.widgetSymbol,
      description: 'Backtest session',
    });
    setSymbolInput(config.symbolDisplay);
    setInterval(config.timeframe);
    setReplaySpeed(config.speed);
    setJumpDate(config.startDate);
  }, [config]);

  useEffect(() => {
    if (savedConfig) {
      sessionStorage.setItem(BACKTEST_CONFIG_KEY, JSON.stringify(savedConfig));
    } else {
      sessionStorage.removeItem(BACKTEST_CONFIG_KEY);
    }
  }, [savedConfig]);

  useEffect(() => {
    localStorage.setItem(BACKTEST_HISTORY_KEY, JSON.stringify(sessionHistory));
  }, [sessionHistory]);

  useEffect(() => {
    analyticsApi.getSummary()
      .then(data => setSummary(data as AnalyticsSummary))
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setReplayCursor(current => Math.min(current + 1, 9999));
    }, Math.max(100, 1000 / replaySpeed));

    return () => window.clearInterval(timer);
  }, [isPlaying, replaySpeed]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!symbolMenuRef.current?.contains(target)) {
        setShowSymbolMenu(false);
      }
      if (!timeframeMenuRef.current?.contains(target)) {
        setShowTimeframeMenu(false);
      }
      if (!speedMenuRef.current?.contains(target)) {
        setShowSpeedMenu(false);
      }
      if (!setupSearchRef.current?.contains(target)) {
        setShowSetupSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!config) {
      return;
    }

    let cancelled = false;

    loadTradingViewScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.TradingView?.widget) {
          return;
        }

        containerRef.current.innerHTML = '';

        new window.TradingView.widget({
          autosize: true,
          symbol: activeSymbol.widgetSymbol,
          interval,
          timezone: 'America/New_York',
          theme: darkToggle ? 'dark' : 'light',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0f0f0f',
          backgroundColor: '#0f0f0f',
          gridColor: 'rgba(255,255,255,0.04)',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: true,
          save_image: true,
          container_id: TV_CONTAINER_ID,
          studies: ['Volume@tv-basicstudies'],
          show_popup_button: false,
          withdateranges: true,
          hide_side_toolbar: false,
          details: false,
          hotlist: false,
          calendar: false,
        });

        setWidgetError('');
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWidgetError(error instanceof Error ? error.message : 'Failed to load TradingView chart.');
        }
      });

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [activeSymbol, config, interval, darkToggle]);

  const controlButtonClass = 'inline-flex h-8 items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-3 text-xs font-medium text-slate-100 transition-colors hover:bg-[#1a1a1a]';
  const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#222] bg-[#141414] text-slate-100 transition-colors hover:bg-[#1a1a1a]';

  const syncSessionRecord = (nextConfig: BacktestConfig) => {
    setConfig(nextConfig);
    setSavedConfig(nextConfig);
    setSessionHistory(current => {
      const timestamp = new Date().toISOString();
      const existing = current.find(item => item.sessionId === nextConfig.sessionId);
      if (!existing) {
        return [toSessionRecord(nextConfig), ...current];
      }

      const nextHistory = current.map(item => (
        item.sessionId === nextConfig.sessionId
          ? { ...item, ...nextConfig, lastOpenedAt: timestamp }
          : item
      ));

      nextHistory.sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
      return nextHistory;
    });
  };

  const updateCurrentSession = (updater: (current: BacktestConfig) => BacktestConfig) => {
    if (!config) {
      return;
    }
    syncSessionRecord(updater(config));
  };

  const openSetupModal = () => {
    const source = savedConfig ?? config;
    if (source) {
      setSetupSymbolInput(source.symbolDisplay);
      setSetupTimeframe(source.timeframe);
      setSetupAccountBalance(String(source.accountBalance));
      setSetupStartDate(source.startDate);
      setSetupEndDate(source.endDate);
      setSetupSpeed(source.speed);
    } else {
      setSetupSymbolInput('NQ1');
      setSetupTimeframe('1');
      setSetupAccountBalance(String(settings?.account_size ?? 10000));
      setSetupStartDate(defaultDates.startDate);
      setSetupEndDate(defaultDates.endDate);
      setSetupSpeed(1);
    }
    setSetupError('');
    setShowSetupSuggestions(false);
    setIsSetupOpen(true);
  };

  const resumeSession = (nextConfig: BacktestConfig) => {
    syncSessionRecord(nextConfig);
    setReplayCursor(0);
    setIsPlaying(false);
    setRailPanel(null);
    setIsSetupOpen(false);
  };

  const returnToDashboard = () => {
    setConfig(null);
    setIsPlaying(false);
    setRailPanel(null);
    setWidgetError('');
  };

  const handleSubmitSetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSetupError('');

    const accountBalance = Number(setupAccountBalance);
    if (!Number.isFinite(accountBalance) || accountBalance <= 0) {
      setSetupError('Enter a valid account balance greater than 0.');
      return;
    }

    if (!setupStartDate || !setupEndDate || setupStartDate > setupEndDate) {
      setSetupError('Choose a valid backtest start and end date.');
      return;
    }

    const resolved = resolveSymbol(setupSymbolInput);
    const nextConfig: BacktestConfig = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbolDisplay: resolved.display,
      widgetSymbol: resolved.widgetSymbol,
      timeframe: setupTimeframe,
      accountBalance,
      startDate: setupStartDate,
      endDate: setupEndDate,
      speed: setupSpeed,
    };

    syncSessionRecord(nextConfig);
    setReplayCursor(0);
    setIsPlaying(false);
    setRailPanel(null);
    setIsSetupOpen(false);
  };

  const accountBalance = config?.accountBalance ?? settings?.account_size ?? 0;
  const realizedPnL = summary?.netPnL ?? 0;
  const unrealizedPnL = 0;

  if (!config) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.08),_transparent_28%),linear-gradient(180deg,_#141312_0%,_#111009_34%,_#0e0d0d_100%)] px-6 py-8 text-slate-100">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="relative overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(135deg,rgba(26,25,23,0.96),rgba(20,19,18,0.94))] px-8 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.48)]">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgba(245,158,11,0.08)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-36 w-full bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.04),transparent)]" />
            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div className="space-y-5">
                <div className="inline-flex items-center rounded-full border border-[rgba(245,158,11,0.25)] bg-[#d97706]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#f59e0b]">
                  Backtest Dashboard
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white">
                    Build, revisit, and relaunch your backtesting sessions from one clean workspace.
                  </h1>
                  <p className="max-w-2xl text-[15px] leading-7 text-slate-300">
                    Use this dashboard to review prior session setups, keep track of the markets you test most, and jump straight into a new replay with the right symbol, window, and balance.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                  <div className="rounded-full border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-3 py-2">TradingView replay shell</div>
                  <div className="rounded-full border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-3 py-2">Saved setup history</div>
                  <div className="rounded-full border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-3 py-2">One-click session resume</div>
                </div>
              </div>

              <div className="grid gap-3 rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(26,25,23,0.82),rgba(20,19,18,0.88))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-4 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Current Focus</p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      {savedConfig ? savedConfig.symbolDisplay : 'No active session'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {savedConfig ? `${getTimeframeLabel(savedConfig.timeframe)} replay ready` : 'Set up your first replay workspace'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-4 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Library Size</p>
                    <p className="mt-3 text-lg font-semibold text-white">{dashboardStats.totalSessions} sessions</p>
                    <p className="mt-1 text-sm text-slate-400">{dashboardStats.uniqueMarkets} markets tracked</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {savedConfig && (
                    <button
                      type="button"
                      onClick={() => resumeSession(savedConfig)}
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-5 text-sm font-semibold text-[#f59e0b] transition-colors hover:bg-[rgba(245,158,11,0.20)]"
                    >
                      Resume Current Session
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openSetupModal}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#d97706] px-6 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(245,158,11,0.20)] transition-colors hover:bg-[#b45309]"
                  >
                    Start New Backtest Session
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total Sessions', String(dashboardStats.totalSessions), 'Saved replay setups in your library'],
              ['Markets Tested', String(dashboardStats.uniqueMarkets), 'Unique symbols explored so far'],
              ['Avg Starting Balance', formatCurrency(dashboardStats.averageBalance), 'Typical capital used to rehearse'],
              ['Most Used Timeframe', dashboardStats.favoriteTimeframe, 'Your most repeated replay rhythm'],
            ].map(([label, value, helper], index) => (
              <div
                key={label}
                className={`group rounded-[26px] border px-5 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)] transition-transform duration-200 hover:-translate-y-0.5 ${
                  index === 0
                    ? 'border-[rgba(245,158,11,0.25)] bg-[linear-gradient(180deg,rgba(32,31,29,0.96),rgba(20,19,18,0.96))]'
                    : 'border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(17,20,28,0.98),rgba(12,14,20,0.98))]'
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-white">{value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p>
              </div>
            ))}
          </div>

          {savedConfig && (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(26,25,23,0.98),rgba(20,19,18,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Current Session Ready</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{savedConfig.symbolDisplay} replay workspace</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      Your most recent setup is parked and ready. Jump straight back into the chart or use it as the template for your next rehearsal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resumeSession(savedConfig)}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] px-4 text-sm font-semibold text-[#f59e0b] transition-colors hover:bg-[rgba(245,158,11,0.20)]"
                  >
                    Open Session
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Symbol', savedConfig.symbolDisplay],
                    ['Timeframe', getTimeframeLabel(savedConfig.timeframe)],
                    ['Date Window', `${savedConfig.startDate} -> ${savedConfig.endDate}`],
                    ['Balance', formatCurrency(savedConfig.accountBalance)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                      <p className="mt-3 text-sm font-medium leading-6 text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(26,25,23,0.98),rgba(20,19,18,0.98))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Latest Session</p>
                {dashboardStats.latestSession ? (
                  <div className="mt-5">
                    <div className="rounded-[24px] border border-[rgba(245,158,11,0.20)] bg-[linear-gradient(180deg,rgba(32,31,29,0.70),rgba(20,19,18,0.90))] p-5">
                      <p className="text-2xl font-semibold tracking-tight text-white">{dashboardStats.latestSession.symbolDisplay}</p>
                      <p className="mt-2 text-sm text-slate-300">
                        Last opened {formatSessionDate(dashboardStats.latestSession.lastOpenedAt)}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                        <span className="rounded-full border border-[rgba(255,255,255,0.07)] bg-[#141312] px-3 py-2">
                          {getTimeframeLabel(dashboardStats.latestSession.timeframe)}
                        </span>
                        <span className="rounded-full border border-[rgba(255,255,255,0.07)] bg-[#141312] px-3 py-2">
                          {dashboardStats.latestSession.startDate} to {dashboardStats.latestSession.endDate}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No backtest sessions yet. Start your first one and it will appear here.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-[30px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(26,25,23,0.98),rgba(20,19,18,0.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.34)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Session Library</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Other Backtesting Sessions</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Keep each rehearsal configuration in one place so you can revisit old markets, time windows, and balances without rebuilding the setup from scratch.
                </p>
              </div>
              <button
                type="button"
                onClick={openSetupModal}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-[#27251f]"
              >
                New Session
              </button>
            </div>

            {sessionHistory.length > 0 ? (
              <div className="mt-6 overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.07)] bg-[#141312]">
                <div className="grid grid-cols-[1.25fr_0.75fr_1fr_0.9fr_0.75fr] gap-3 border-b border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <span>Market</span>
                  <span>Timeframe</span>
                  <span>Range</span>
                  <span>Balance</span>
                  <span className="text-right">Action</span>
                </div>
                <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                  {sessionHistory.slice(0, 8).map(item => (
                    <div
                      key={item.sessionId}
                      className="grid grid-cols-[1.25fr_0.75fr_1fr_0.9fr_0.75fr] items-center gap-3 bg-transparent px-5 py-4 text-sm text-slate-200 transition-colors hover:bg-[#1a1917]"
                    >
                      <div>
                        <p className="font-medium text-white">{item.symbolDisplay}</p>
                        <p className="mt-1 text-xs text-slate-500">Opened {formatSessionDate(item.lastOpenedAt)}</p>
                      </div>
                      <span>{getTimeframeLabel(item.timeframe)}</span>
                      <span>{item.startDate} {'->'} {item.endDate}</span>
                      <span>{formatCurrency(item.accountBalance)}</span>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => resumeSession(item)}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)]/80 px-4 text-sm font-medium text-[#f59e0b] transition-colors hover:bg-[rgba(245,158,11,0.20)]"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 rounded-[26px] border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(180deg,rgba(26,25,23,0.82),rgba(20,19,18,0.92))] px-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#f59e0b]">Ready To Start</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-white">No backtesting sessions saved yet.</p>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                    Start one fresh session and this library will begin filling out with reusable setups for different markets, date ranges, and account sizes.
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-slate-300">
                  {[
                    'Choose the symbol and timeframe you want to rehearse',
                    'Set the date window and the starting balance for context',
                    'Launch the chart and come back here anytime to reopen it',
                  ].map((item, index) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#1a1917] px-4 py-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#d97706]/20 text-xs font-semibold text-[#f59e0b]">
                        {index + 1}
                      </span>
                      <span className="leading-6">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isSetupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 py-8">
            <button
              type="button"
              aria-label="Close setup"
              onClick={() => setIsSetupOpen(false)}
              className="absolute inset-0 cursor-default"
            />
            <div className="relative z-10 w-full max-w-4xl rounded-[32px] border border-[#222] bg-[#111111] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Backtest Setup</p>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">Configure Your Backtest</h2>
                  <p className="max-w-2xl text-sm text-slate-400">
                    Choose the asset, timeframe, backtest window, and account balance first. After you submit, the live backtesting chart will open with those settings applied.
                  </p>
                </div>
                <button type="button" onClick={() => setIsSetupOpen(false)} className={iconButtonClass}>
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSubmitSetup} className="mt-8 space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Asset Pair / Symbol</span>
                    <div ref={setupSearchRef} className="relative">
                      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={setupSymbolInput}
                        onChange={event => {
                          setSetupSymbolInput(event.target.value.toUpperCase());
                          setShowSetupSuggestions(true);
                        }}
                        onFocus={() => setShowSetupSuggestions(true)}
                        className="h-12 w-full rounded-2xl border border-[#222] bg-[#151515] pl-11 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="NQ1, ES1, EURUSD, AAPL"
                      />
                      {showSetupSuggestions && filteredSetupSymbols.length > 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 overflow-hidden rounded-2xl border border-[#222] bg-[#0f0f0f] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                          {filteredSetupSymbols.map(item => (
                            <button
                              key={`${item.display}-${item.widgetSymbol}`}
                              type="button"
                              onClick={() => {
                                setSetupSymbolInput(item.display);
                                setShowSetupSuggestions(false);
                              }}
                              className="flex w-full items-center justify-between border-b border-[#171717] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#1a1a1a]"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-100">{item.display}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                              </div>
                              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.widgetSymbol}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Chart Timeframe</span>
                    <select
                      value={setupTimeframe}
                      onChange={event => setSetupTimeframe(event.target.value as ChartInterval)}
                      className="h-12 w-full rounded-2xl border border-[#222] bg-[#151515] px-4 text-base text-slate-100 outline-none"
                    >
                      {TIMEFRAME_OPTIONS.map(item => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Backtest Start</span>
                    <input
                      type="date"
                      value={setupStartDate}
                      onChange={event => setSetupStartDate(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-[#222] bg-[#151515] px-4 text-base text-slate-100 outline-none"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Backtest End</span>
                    <input
                      type="date"
                      value={setupEndDate}
                      onChange={event => setSetupEndDate(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-[#222] bg-[#151515] px-4 text-base text-slate-100 outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Starting Account Balance</span>
                    <input
                      type="number"
                      min={1}
                      value={setupAccountBalance}
                      onChange={event => setSetupAccountBalance(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-[#222] bg-[#151515] px-4 text-base text-slate-100 outline-none"
                      placeholder="10000"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Default Replay Speed</span>
                    <select
                      value={setupSpeed}
                      onChange={event => setSetupSpeed(Number(event.target.value) as ReplaySpeed)}
                      className="h-12 w-full rounded-2xl border border-[#222] bg-[#151515] px-4 text-base text-slate-100 outline-none"
                    >
                      {SPEED_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}x</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SYMBOL_SUGGESTIONS.slice(0, 6).map(item => (
                    <button
                      key={item.display}
                      type="button"
                      onClick={() => setSetupSymbolInput(item.display)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        setupSymbolInput === item.display
                          ? 'border-[rgba(245,158,11,0.50)] bg-[#d97706]/15 text-[#f59e0b]'
                          : 'border-[#222] bg-[#151515] text-slate-300 hover:bg-[#1a1a1a]'
                      }`}
                    >
                      {item.display}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 rounded-3xl border border-[#222] bg-[#151515] p-5 md:grid-cols-4">
                  {[
                    ['Symbol', resolveSymbol(setupSymbolInput).display],
                    ['Timeframe', getTimeframeLabel(setupTimeframe)],
                    ['Window', `${setupStartDate} -> ${setupEndDate}`],
                    ['Balance', setupAccountBalance ? formatCurrency(Number(setupAccountBalance) || 0) : '$0.00'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>

                {setupError && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {setupError}
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-500">
                    We&apos;ll keep these settings attached to your current backtest session until you change them.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#d97706] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#b45309]"
                  >
                    Launch Backtest
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in h-full min-h-[720px] w-full bg-[#0f0f0f] text-slate-100">
      <div className="flex h-full min-h-[calc(100vh-56px)] w-full flex-col bg-[#0f0f0f]">
        <div className="flex h-12 items-center justify-between gap-3 border-b border-[#222] bg-[#0f0f0f] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div ref={symbolMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowSymbolMenu(current => !current)}
                className={`${controlButtonClass} min-w-[120px] justify-between`}
              >
                <span>{activeSymbol.display}</span>
                <ChevronDown size={14} />
              </button>

              {showSymbolMenu && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[320px] overflow-hidden rounded-2xl border border-[#222] bg-[#0f0f0f] shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                  <div className="border-b border-[#222] p-3">
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={symbolInput}
                        onChange={event => setSymbolInput(event.target.value.toUpperCase())}
                        placeholder="Search symbol"
                        className="h-10 w-full rounded-xl border border-[#222] bg-[#141414] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {filteredSymbols.map(item => (
                      <button
                        key={`${item.display}-${item.widgetSymbol}`}
                        type="button"
                        onClick={() => {
                          updateCurrentSession(current => ({
                            ...current,
                            symbolDisplay: item.display,
                            widgetSymbol: item.widgetSymbol,
                          }));
                          setShowSymbolMenu(false);
                        }}
                        className="flex w-full items-center justify-between border-b border-[#171717] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#1a1a1a]"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-100">{item.display}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.widgetSymbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div ref={timeframeMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowTimeframeMenu(current => !current)}
                className={`${controlButtonClass} min-w-[88px] justify-between`}
              >
                <span>{getTimeframeLabel(interval)}</span>
                <span className="flex flex-col text-slate-500">
                  <ChevronUp size={10} />
                  <ChevronDown size={10} className="-mt-1" />
                </span>
              </button>

              {showTimeframeMenu && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-28 overflow-hidden rounded-2xl border border-[#222] bg-[#0f0f0f] shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                  {TIMEFRAME_OPTIONS.map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        updateCurrentSession(current => ({ ...current, timeframe: item.value }));
                        setShowTimeframeMenu(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-[#1a1a1a] ${
                        interval === item.value ? 'text-[#f59e0b]' : 'text-slate-100'
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={returnToDashboard} className={controlButtonClass}>
              <LayoutTemplate size={14} />
              <span>Backtest Dashboard</span>
            </button>

            <span className="rounded-full border border-[#222] bg-[#141414] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {config.startDate} {'->'} {config.endDate}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReplayCursor(0)} className={iconButtonClass}>
              <SkipBack size={14} />
            </button>
            <button type="button" onClick={() => setReplayCursor(current => Math.max(current - 10, 0))} className={iconButtonClass}>
              <Rewind size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(current => !current)}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-4 text-xs font-medium text-slate-100 transition-colors hover:bg-[#1a1a1a]"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button type="button" onClick={() => setReplayCursor(current => current + 10)} className={iconButtonClass}>
              <FastForward size={14} />
            </button>
            <button type="button" onClick={() => setReplayCursor(9999)} className={iconButtonClass}>
              <SkipForward size={14} />
            </button>

            <div ref={speedMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(current => !current)}
                className={`${controlButtonClass} min-w-[74px] justify-between`}
              >
                <span>{replaySpeed}x</span>
                <ChevronDown size={14} />
              </button>
              {showSpeedMenu && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-24 overflow-hidden rounded-2xl border border-[#222] bg-[#0f0f0f] shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                  {SPEED_OPTIONS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        updateCurrentSession(current => ({ ...current, speed: option }));
                        setShowSpeedMenu(false);
                      }}
                      className={`flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-[#1a1a1a] ${
                        replaySpeed === option ? 'text-[#f59e0b]' : 'text-slate-100'
                      }`}
                    >
                      {option}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className={controlButtonClass}>
              <SlidersHorizontal size={14} />
              <span>Indicators</span>
            </button>
            <button type="button" className={iconButtonClass}>
              <Camera size={14} />
            </button>
            <button
              type="button"
              onClick={() => setDarkToggle(current => !current)}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-3 text-xs font-medium text-slate-100 transition-colors hover:bg-[#1a1a1a]"
            >
              <span className={`relative h-4 w-8 rounded-full transition-colors ${darkToggle ? 'bg-[#d97706]' : 'bg-[#1f2937]'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${darkToggle ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
              {darkToggle ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-0 flex-1 bg-[#0f0f0f]">
            <div className="h-full w-full" style={{ backgroundColor: '#0f0f0f' }}>
              <div className="tradingview-widget-container h-full w-full">
                <div id={TV_CONTAINER_ID} ref={containerRef} className="h-full w-full" />
              </div>
            </div>

            {widgetError && (
              <div className="absolute left-4 top-4 z-20 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {widgetError}
              </div>
            )}

            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-[#222] bg-[#0f0f0f]/90 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Replay cursor {replayCursor}
            </div>
          </div>

          {railPanel && (
            <div className="w-80 border-l border-[#222] bg-[#0f0f0f]">
              {railPanel === 'order' && (
                <div className="h-full p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-100">Order Ticket</h2>
                    <button type="button" onClick={() => setRailPanel(null)} className={iconButtonClass}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {['Direction', 'Entry', 'Stop Loss', 'Take Profit', 'Contracts'].map(label => (
                      <label key={label} className="block">
                        <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
                        <input
                          className="h-10 w-full rounded-xl border border-[#222] bg-[#141414] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                          placeholder={label}
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => navigate('/journal')}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#d97706] px-4 text-sm font-medium text-white transition-colors hover:bg-[#b45309]"
                    >
                      Open Journal
                    </button>
                  </div>
                </div>
              )}

              {railPanel === 'goto' && (
                <div className="h-full p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-100">Go To Date</h2>
                    <button type="button" onClick={() => setRailPanel(null)} className={iconButtonClass}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-slate-500">Date</span>
                      <input
                        type="date"
                        value={jumpDate}
                        onChange={event => setJumpDate(event.target.value)}
                        className="h-10 w-full rounded-xl border border-[#222] bg-[#141414] px-3 text-sm text-slate-100 outline-none"
                      />
                    </label>
                    <p className="text-xs text-slate-500">
                      TradingView&apos;s public widget does not expose direct programmatic date jumps, so this keeps your target date handy while you inspect the chart manually.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRailPanel(null)}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#d97706] px-4 text-sm font-medium text-white transition-colors hover:bg-[#b45309]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex w-[72px] flex-col items-center border-l border-[#222] bg-[#0f0f0f] py-3">
            {[
              {
                id: 'order',
                label: 'Order',
                icon: <ShoppingCart size={16} />,
                onClick: () => setRailPanel(current => current === 'order' ? null : 'order'),
                active: railPanel === 'order',
              },
              {
                id: 'goto',
                label: 'Go to',
                icon: <ArrowUpRight size={16} />,
                onClick: () => setRailPanel(current => current === 'goto' ? null : 'goto'),
                active: railPanel === 'goto',
              },
              {
                id: 'journal',
                label: 'Journal',
                icon: <BookOpen size={16} />,
                onClick: () => navigate('/journal'),
                active: false,
              },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`mb-2 flex w-full flex-col items-center gap-1 px-2 py-3 text-[11px] transition-colors hover:bg-[#1a1a1a] ${
                  item.active ? 'bg-[rgba(245,158,11,0.10)] text-[#f59e0b]' : 'text-slate-300'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-8 items-center justify-between gap-3 border-t border-[#222] bg-[#0f0f0f] px-3 text-[11px] text-slate-200">
          <div>{formatUtcTime(clock)}</div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setUsePercentScale(current => !current)}
              className={`transition-colors hover:text-white ${usePercentScale ? 'text-[#f59e0b]' : 'text-slate-400'}`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => setAutoScale(current => !current)}
              className={`transition-colors hover:text-white ${autoScale ? 'text-[#f59e0b]' : 'text-slate-400'}`}
            >
              log/auto
            </button>
          </div>
          <div className="flex items-center gap-4 whitespace-nowrap">
            <span>Account Balance {formatCurrency(accountBalance)}</span>
            <span>Realized PnL {formatCurrency(realizedPnL)}</span>
            <span>Unrealized PnL {formatCurrency(unrealizedPnL)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
