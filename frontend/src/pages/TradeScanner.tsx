import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Image as ImageIcon, Search, Trash2 } from 'lucide-react';
import ScreenshotImportModal from '../components/scanner/ScreenshotImportModal.js';
import { useTrades } from '../hooks/useTrades.js';
import { Trade } from '../types/index.js';

export type FlyxaJournalDirection = 'LONG' | 'SHORT';
export type FlyxaJournalRuleState = 'ok' | 'fail' | 'unchecked';
export type FlyxaEmotionTone = 's-g' | 's-a' | 's-r';

export interface FlyxaJournalTrade {
  id: string;
  symbol: string;
  direction: FlyxaJournalDirection;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  cents: number;
  rr: number;
  pnl: number;
  status?: 'win' | 'loss' | 'open';
  screenshotUrl?: string;
}

export interface FlyxaJournalReflection {
  pre: string;
  post: string;
  lessons: string;
}

export interface FlyxaJournalRule {
  id: string;
  label: string;
  state: FlyxaJournalRuleState;
}

export interface FlyxaJournalPsychology {
  setupQuality: number;
  setupQualityNote: string;
  discipline: number;
  disciplineNote: string;
  execution: number;
  executionNote: string;
}

export interface FlyxaJournalEmotion {
  label: string;
  tone: FlyxaEmotionTone;
}

export interface FlyxaJournalEntry {
  date: string;
  pnl: number;
  grade: string;
  trades: FlyxaJournalTrade[];
  screenshots?: string[];
  reflection: FlyxaJournalReflection;
  rules: FlyxaJournalRule[];
  psychology: FlyxaJournalPsychology;
  emotions: FlyxaJournalEmotion[];
}

export interface FlyxaJournalAccount {
  name: string;
  type: 'live' | 'eval' | 'paper';
}

export interface FlyxaJournalPageProps {
  date?: string;
  entries?: FlyxaJournalEntry[];
  account?: FlyxaJournalAccount;
  onOpenTradeScanner?: () => void;
  onDeleteTrade?: (tradeId: string) => Promise<void> | void;
}

type ReflectionTab = 'pre' | 'post' | 'lessons';
type DayFilter = 'all' | 'win' | 'loss' | 'untagged';

const DEFAULT_ACCOUNT: FlyxaJournalAccount = {
  name: 'Apex Funded',
  type: 'live',
};

const STATE_OF_MIND_TAGS = [
  'Focused',
  'Calm',
  'Patient',
  'Slightly rushed',
  'Confident',
  'Hesitant',
  'Overconfident',
  'Revenge trading',
  'FOMO',
  'In the zone',
  'Distracted',
  'Anxious',
];

const DEFAULT_RULES: FlyxaJournalRule[] = [
  { id: 'r1', label: 'Followed daily loss limit', state: 'ok' },
  { id: 'r2', label: 'Only traded A/B setups', state: 'ok' },
  { id: 'r3', label: 'Respected position sizing rules', state: 'fail' },
  { id: 'r4', label: 'No trading during lunch window', state: 'ok' },
  { id: 'r5', label: 'Stopped after 3 consecutive losses', state: 'unchecked' },
];

const DEFAULT_ENTRIES: FlyxaJournalEntry[] = [
  {
    date: '2025-04-18',
    pnl: 620,
    grade: 'A',
    trades: [
      {
        id: 't-418-1',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '09:37',
        exitTime: '09:52',
        entryPrice: 18244.25,
        exitPrice: 18258.75,
        cents: 1450,
        rr: 2.3,
        pnl: 430,
        status: 'win',
      },
      {
        id: 't-418-2',
        symbol: 'ES',
        direction: 'LONG',
        entryTime: '10:16',
        exitTime: '10:29',
        entryPrice: 5207.5,
        exitPrice: 5211.25,
        cents: 375,
        rr: 1.4,
        pnl: 190,
        status: 'win',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Waited for reclaim at VWAP and only took continuation setups. Felt composed and patient through chop.',
      lessons: 'Sizing stayed clean today. Continue avoiding second entries in weak ranges.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 4,
      setupQualityNote: 'good A/B setups',
      discipline: 3,
      disciplineNote: 'sized up on trade 2',
      execution: 2.5,
      executionNote: 'early entry on NQ',
    },
    emotions: [
      { label: 'Focused', tone: 's-g' },
      { label: 'Calm', tone: 's-g' },
      { label: 'Slightly rushed', tone: 's-a' },
    ],
  },
  {
    date: '2025-04-17',
    pnl: 240,
    grade: 'B',
    trades: [
      {
        id: 't-417-1',
        symbol: 'ES',
        direction: 'LONG',
        entryTime: '09:45',
        exitTime: '10:01',
        entryPrice: 5204.5,
        exitPrice: 5208,
        cents: 350,
        rr: 1.1,
        pnl: 140,
        status: 'win',
      },
      {
        id: 't-417-2',
        symbol: 'NQ',
        direction: 'SHORT',
        entryTime: '10:35',
        exitTime: '10:47',
        entryPrice: 18270,
        exitPrice: 18266,
        cents: 400,
        rr: 1.2,
        pnl: 100,
        status: 'win',
      },
      {
        id: 't-417-3',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '11:12',
        exitTime: '11:24',
        entryPrice: 18280.5,
        exitPrice: 18277,
        cents: -350,
        rr: 0.6,
        pnl: -110,
        status: 'loss',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Decent process. Took one avoidable long after momentum faded.',
      lessons: 'Respect end-of-move context before pressing continuation.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 3.5,
      setupQualityNote: 'mostly clean setups',
      discipline: 3,
      disciplineNote: 'minor impulse re-entry',
      execution: 3,
      executionNote: 'entries were mostly on trigger',
    },
    emotions: [{ label: 'Patient', tone: 's-g' }],
  },
  {
    date: '2025-04-16',
    pnl: -310,
    grade: 'C',
    trades: [
      {
        id: 't-416-1',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '09:33',
        exitTime: '09:39',
        entryPrice: 18230,
        exitPrice: 18224.75,
        cents: -525,
        rr: -1,
        pnl: -210,
        status: 'loss',
      },
      {
        id: 't-416-2',
        symbol: 'ES',
        direction: 'SHORT',
        entryTime: '10:03',
        exitTime: '10:15',
        entryPrice: 5198.5,
        exitPrice: 5200.5,
        cents: -200,
        rr: -0.7,
        pnl: -100,
        status: 'loss',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Forced early entries and ignored confirmation. Emotional urgency was high.',
      lessons: 'No first 5-minute breakout trades without retest confirmation.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 2.5,
      setupQualityNote: 'B setups skipped, weak setups chased',
      discipline: 2,
      disciplineNote: 'broke size limits twice',
      execution: 2,
      executionNote: 'entries were rushed',
    },
    emotions: [
      { label: 'Revenge trading', tone: 's-r' },
      { label: 'Anxious', tone: 's-r' },
      { label: 'FOMO', tone: 's-a' },
    ],
  },
  {
    date: '2025-04-14',
    pnl: 95,
    grade: 'B',
    trades: [
      {
        id: 't-414-1',
        symbol: 'ES',
        direction: 'LONG',
        entryTime: '09:51',
        exitTime: '10:07',
        entryPrice: 5189,
        exitPrice: 5191,
        cents: 200,
        rr: 1.15,
        pnl: 95,
        status: 'win',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Single clean trade and stopped. Felt controlled.',
      lessons: 'One-trade days are fine when edge is thin.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 4,
      setupQualityNote: 'one clean setup',
      discipline: 4,
      disciplineNote: 'stopped after target',
      execution: 3.5,
      executionNote: 'execution was stable',
    },
    emotions: [{ label: 'In the zone', tone: 's-g' }],
  },
  {
    date: '2025-04-11',
    pnl: -45,
    grade: 'C',
    trades: [
      {
        id: 't-411-1',
        symbol: 'NQ',
        direction: 'SHORT',
        entryTime: '09:39',
        exitTime: '09:44',
        entryPrice: 18195,
        exitPrice: 18196,
        cents: -100,
        rr: -0.4,
        pnl: -45,
        status: 'loss',
      },
      {
        id: 't-411-2',
        symbol: 'NQ',
        direction: 'SHORT',
        entryTime: '10:02',
        exitTime: '10:18',
        entryPrice: 18188.5,
        exitPrice: 18188.5,
        cents: 0,
        rr: 0,
        pnl: 0,
        status: 'open',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Low quality day. Took entries without clear structure.',
      lessons: 'Skip open when range context is unclear.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 2.5,
      setupQualityNote: 'mixed context quality',
      discipline: 2.5,
      disciplineNote: 'hesitant exits',
      execution: 2,
      executionNote: 'late and reactive entries',
    },
    emotions: [{ label: 'Distracted', tone: 's-a' }],
  },
  {
    date: '2025-04-08',
    pnl: 480,
    grade: 'A+',
    trades: [
      {
        id: 't-408-1',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '09:48',
        exitTime: '10:06',
        entryPrice: 18145,
        exitPrice: 18156.5,
        cents: 1150,
        rr: 2.1,
        pnl: 480,
        status: 'win',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Great execution and pacing. Followed trigger exactly.',
      lessons: 'Keep prioritizing confirmation over anticipation.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 4.5,
      setupQualityNote: 'A setup right after open pullback',
      discipline: 4,
      disciplineNote: 'sized correctly and stopped trading',
      execution: 4,
      executionNote: 'clean trigger and exit',
    },
    emotions: [
      { label: 'Focused', tone: 's-g' },
      { label: 'Confident', tone: 's-g' },
    ],
  },
];

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function monthStart(value: string): Date {
  const parsed = parseIsoDate(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

function toCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });
}

function toPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

function toR(value: number): string {
  if (!Number.isFinite(value)) return '0.00R';
  return `${value.toFixed(2)}R`;
}

function formatDayTitle(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parseIsoDate(date));
}

function formatWeekdayShort(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseIsoDate(date));
}

function formatMonthLabel(monthCursor: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthCursor);
}

function getTradeOutcome(trade: FlyxaJournalTrade): 'win' | 'loss' | 'open' {
  if (trade.status) return trade.status;
  if (trade.pnl > 0) return 'win';
  if (trade.pnl < 0) return 'loss';
  return 'open';
}

function getGradeTone(grade: string): 'g' | 'a' | 'r' {
  if (grade.startsWith('A')) return 'g';
  if (grade.startsWith('B')) return 'a';
  return 'r';
}

function isSameMonth(dateValue: string, monthCursor: Date): boolean {
  const parsed = parseIsoDate(dateValue);
  return (
    parsed.getFullYear() === monthCursor.getFullYear()
    && parsed.getMonth() === monthCursor.getMonth()
  );
}

function getAccountTypeLabel(type: FlyxaJournalAccount['type']): string {
  if (type === 'live') return 'Live';
  if (type === 'eval') return 'Eval';
  return 'Paper';
}

function getPnLColor(value: number): string {
  if (value > 0) return 'var(--green)';
  if (value < 0) return 'var(--red)';
  return 'var(--amber)';
}

const JOURNAL_THEME = {
  '--bg': 'var(--app-bg)',
  '--surface-1': 'var(--app-panel)',
  '--surface-2': 'var(--app-panel-strong)',
  '--surface-3': 'rgba(255,255,255,0.08)',
  '--border': 'var(--app-border)',
  '--border-sub': 'rgba(255,255,255,0.05)',
  '--txt': 'var(--app-text)',
  '--txt-2': 'var(--app-text-muted)',
  '--txt-3': 'var(--app-text-subtle)',
  '--cobalt': '#6EA8FE',
  '--cobalt-dim': 'rgba(110,168,254,0.14)',
  '--green': '#34D399',
  '--green-dim': 'rgba(52,211,153,0.14)',
  '--amber': '#FBBF24',
  '--amber-dim': 'rgba(251,191,36,0.14)',
  '--red': '#F87171',
  '--red-dim': 'rgba(248,113,113,0.14)',
} as React.CSSProperties;

export function FlyxaJournalPage({
  date,
  entries = DEFAULT_ENTRIES,
  account = DEFAULT_ACCOUNT,
  onOpenTradeScanner,
  onDeleteTrade,
}: FlyxaJournalPageProps) {
  const [entriesState, setEntriesState] = useState<FlyxaJournalEntry[]>(entries);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);

  useEffect(() => {
    setEntriesState(entries);
  }, [entries]);

  const sortedEntries = useMemo(
    () => [...entriesState].sort((a, b) => b.date.localeCompare(a.date)),
    [entriesState]
  );

  const preferredDate = useMemo(() => {
    if (date && sortedEntries.some(entry => entry.date === date)) return date;
    return sortedEntries[0]?.date ?? new Date().toISOString().slice(0, 10);
  }, [date, sortedEntries]);

  const [monthCursor, setMonthCursor] = useState<Date>(() => monthStart(preferredDate));
  const [activeDate, setActiveDate] = useState<string>(preferredDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const [activeTab, setActiveTab] = useState<ReflectionTab>('pre');
  const [reflectionByDate, setReflectionByDate] = useState<Record<string, FlyxaJournalReflection>>(() =>
    sortedEntries.reduce<Record<string, FlyxaJournalReflection>>((acc, entry) => {
      acc[entry.date] = entry.reflection;
      return acc;
    }, {})
  );

  useEffect(() => {
    setReflectionByDate(current => {
      const next = { ...current };
      sortedEntries.forEach(entry => {
        if (!next[entry.date]) next[entry.date] = entry.reflection;
      });
      return next;
    });
  }, [sortedEntries]);

  useEffect(() => {
    if (!sortedEntries.some(entry => entry.date === activeDate)) {
      setActiveDate(preferredDate);
    }
  }, [sortedEntries, activeDate, preferredDate]);

  useEffect(() => {
    if (date && sortedEntries.some(entry => entry.date === date)) {
      setActiveDate(date);
      setMonthCursor(monthStart(date));
    }
  }, [date, sortedEntries]);

  const monthEntries = useMemo(
    () => sortedEntries.filter(entry => isSameMonth(entry.date, monthCursor)),
    [sortedEntries, monthCursor]
  );

  const dayListEntries = useMemo(() => {
    const loweredSearch = searchTerm.trim().toLowerCase();

    return monthEntries.filter(entry => {
      const tagged = entry.emotions.length > 0;
      if (dayFilter === 'win' && entry.pnl <= 0) return false;
      if (dayFilter === 'loss' && entry.pnl >= 0) return false;
      if (dayFilter === 'untagged' && tagged) return false;

      if (!loweredSearch) return true;

      const searchable = [
        formatDayTitle(entry.date),
        entry.grade,
        ...entry.trades.map(trade => trade.symbol),
      ].join(' ').toLowerCase();

      return searchable.includes(loweredSearch);
    });
  }, [monthEntries, searchTerm, dayFilter]);

  useEffect(() => {
    if (dayListEntries.length === 0) return;
    if (!dayListEntries.some(entry => entry.date === activeDate)) {
      setActiveDate(dayListEntries[0].date);
    }
  }, [dayListEntries, activeDate]);

  const activeEntry = useMemo(
    () => sortedEntries.find(entry => entry.date === activeDate) ?? sortedEntries[0] ?? null,
    [sortedEntries, activeDate]
  );

  const activeReflection = activeEntry
    ? (reflectionByDate[activeEntry.date] ?? activeEntry.reflection)
    : null;

  const monthSummary = useMemo(() => {
    const monthPnl = monthEntries.reduce((sum, entry) => sum + entry.pnl, 0);
    const monthTrades = monthEntries.flatMap(entry => entry.trades);
    const wins = monthTrades.filter(trade => getTradeOutcome(trade) === 'win').length;
    const winRate = monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0;
    const daysTraded = monthEntries.length;
    const bestDay = monthEntries.reduce((best, entry) => Math.max(best, entry.pnl), 0);

    return {
      monthPnl,
      winRate,
      daysTraded,
      bestDay,
    };
  }, [monthEntries]);

  const summaryStats = useMemo(() => {
    if (!activeEntry) {
      return [
        { label: 'P&L', value: '$0', tone: 'var(--txt)' },
        { label: 'Win Rate', value: '0.0%', tone: 'var(--txt)' },
        { label: 'Trades', value: '0', tone: 'var(--txt)' },
        { label: 'Best R', value: '0.00R', tone: 'var(--txt)' },
      ];
    }

    const outcomes = activeEntry.trades.map(getTradeOutcome);
    const wins = outcomes.filter(outcome => outcome === 'win').length;
    const winRate = activeEntry.trades.length > 0 ? (wins / activeEntry.trades.length) * 100 : 0;
    const bestR = activeEntry.trades.reduce((best, trade) => Math.max(best, trade.rr), 0);

    return [
      { label: 'P&L', value: toCurrency(activeEntry.pnl), tone: getPnLColor(activeEntry.pnl) },
      { label: 'Win Rate', value: toPercent(winRate), tone: 'var(--txt)' },
      { label: 'Trades', value: String(activeEntry.trades.length), tone: 'var(--txt)' },
      { label: 'Best R', value: toR(bestR), tone: 'var(--txt)' },
    ];
  }, [activeEntry]);

  const selectedEmotionTone = useMemo(() => {
    if (!activeEntry) return new Map<string, FlyxaEmotionTone>();
    return new Map(activeEntry.emotions.map(emotion => [emotion.label.toLowerCase(), emotion.tone]));
  }, [activeEntry]);

  const shiftMonth = (direction: -1 | 1) => {
    setMonthCursor(current => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const handleReflectionChange = (tab: ReflectionTab, value: string) => {
    if (!activeEntry) return;

    setReflectionByDate(current => ({
      ...current,
      [activeEntry.date]: {
        ...(current[activeEntry.date] ?? activeEntry.reflection),
        [tab]: value,
      },
    }));
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!activeEntry || deletingTradeId) return;

    setDeletingTradeId(tradeId);
    try {
      await onDeleteTrade?.(tradeId);
      setEntriesState(current => current.map(entry => {
        if (entry.date !== activeEntry.date) return entry;
        const nextTrades = entry.trades.filter(trade => trade.id !== tradeId);
        const nextPnl = nextTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        return {
          ...entry,
          trades: nextTrades,
          pnl: nextPnl,
        };
      }));
    } finally {
      setDeletingTradeId(null);
    }
  };

  const monthLabel = formatMonthLabel(monthCursor);

  return (
    <div style={{ ...JOURNAL_THEME, height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        .flyxa-day-scroll::-webkit-scrollbar { width: 3px; }
        .flyxa-day-scroll::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 3px; }
        .flyxa-entry-scroll::-webkit-scrollbar { width: 4px; }
        .flyxa-entry-scroll::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 4px; }
        .flyxa-search::placeholder,
        .flyxa-reflect::placeholder {
          color: var(--txt-3);
          opacity: 1;
        }
        .flyxa-day-row:hover { background: rgba(255,255,255,0.02); }
        .flyxa-chip:hover { color: var(--txt); border-color: var(--txt-3); }
        .flyxa-trade-card:hover { background: var(--surface-2); }
        .flyxa-shot-slot:hover { border-color: var(--cobalt); color: var(--cobalt); }
        .flyxa-rule-row:hover { background: rgba(255,255,255,0.02); }
        .flyxa-state-tag:hover { border-color: var(--txt-3); color: var(--txt); }
        .flyxa-btn-log-trade {
          height: 36px;
          border: 1px solid #d89000;
          border-radius: 6px;
          padding: 0 12px;
          background: #f8b318;
          color: #111111;
          font-size: 18px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .flyxa-btn-log-trade:hover { background: #ffbf2f; border-color: #e09a03; }
        .flyxa-btn-primary {
          height: 30px;
          border: 1px solid rgba(110,168,254,0.45);
          border-radius: 6px;
          padding: 0 12px;
          background: rgba(110,168,254,0.18);
          color: #dbeafe;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .flyxa-btn-primary:hover { background: rgba(110,168,254,0.28); }
        .flyxa-btn-delete {
          width: 24px;
          height: 24px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: transparent;
          color: var(--txt-3);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .flyxa-btn-delete:hover {
          color: var(--red);
          border-color: rgba(248,113,113,0.45);
          background: var(--red-dim);
        }
        .flyxa-btn-delete:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>

      <aside
        style={{
          width: 256,
          minWidth: 256,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-sub)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{monthLabel}</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                style={{
                  width: 22,
                  height: 22,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--txt-3)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={event => { event.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={event => { event.currentTarget.style.color = 'var(--txt-3)'; }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                style={{
                  width: 22,
                  height: 22,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--txt-3)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={event => { event.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={event => { event.currentTarget.style.color = 'var(--txt-3)'; }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {[
              {
                label: 'Month P&L',
                value: toCurrency(monthSummary.monthPnl),
                tone: monthSummary.monthPnl >= 0 ? 'var(--green)' : 'var(--red)',
              },
              { label: 'Win Rate', value: toPercent(monthSummary.winRate), tone: 'var(--txt)' },
              { label: 'Days Traded', value: String(monthSummary.daysTraded), tone: 'var(--txt)' },
              {
                label: 'Best Day',
                value: toCurrency(monthSummary.bestDay),
                tone: 'var(--green)',
              },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  border: '1px solid var(--border-sub)',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--txt-3)',
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: stat.tone,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-sub)', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={13} color="var(--txt-3)" />
            <input
              className="flyxa-search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search entries..."
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--txt)',
                fontSize: 12,
                outline: 'none',
                padding: 0,
              }}
            />
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-sub)', padding: '8px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'win', label: 'Win days' },
            { key: 'loss', label: 'Loss days' },
            { key: 'untagged', label: 'Untagged' },
          ].map(chip => {
            const selected = dayFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                className="flyxa-chip"
                onClick={() => setDayFilter(chip.key as DayFilter)}
                style={{
                  border: `1px solid ${selected ? 'var(--txt-3)' : 'var(--border)'}`,
                  background: selected ? 'var(--surface-3)' : 'transparent',
                  color: selected ? 'var(--txt)' : 'var(--txt-3)',
                  fontSize: 10,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flyxa-day-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {dayListEntries.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--txt-3)' }}>
              No entries in this view.
            </div>
          )}

          {dayListEntries.map(entry => {
            const active = activeEntry?.date === entry.date;
            const wins = entry.trades.filter(trade => getTradeOutcome(trade) === 'win').length;
            const losses = entry.trades.filter(trade => getTradeOutcome(trade) === 'loss').length;
            const dots = entry.trades.slice(0, 3).map(getTradeOutcome);
            const gradeTone = getGradeTone(entry.grade);
            const gradeBg = gradeTone === 'g'
              ? 'var(--green-dim)'
              : gradeTone === 'a'
                ? 'var(--amber-dim)'
                : 'var(--red-dim)';
            const gradeColor = gradeTone === 'g'
              ? 'var(--green)'
              : gradeTone === 'a'
                ? 'var(--amber)'
                : 'var(--red)';

            return (
              <button
                key={entry.date}
                type="button"
                className="flyxa-day-row"
                onClick={() => setActiveDate(entry.date)}
                style={{
                  width: '100%',
                  border: 'none',
                  borderLeft: `2px solid ${active ? 'var(--cobalt)' : 'transparent'}`,
                  background: active ? 'var(--cobalt-dim)' : 'transparent',
                  color: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 36, textAlign: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 19,
                      fontWeight: 600,
                      lineHeight: 1,
                      color: active ? 'var(--cobalt)' : 'var(--txt)',
                    }}
                  >
                    {new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(parseIsoDate(entry.date))}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: active ? 'rgba(110,168,254,0.55)' : 'var(--txt-3)',
                    }}
                  >
                    {formatWeekdayShort(entry.date)}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: getPnLColor(entry.pnl),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {toCurrency(entry.pnl)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>
                    {`${wins}W · ${losses}L · ${entry.trades.length} trades`}
                  </div>
                </div>

                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 2,
                      background: gradeBg,
                      color: gradeColor,
                    }}
                  >
                    {entry.grade}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {dots.map((dot, index) => (
                      <span
                        key={`${entry.date}-${index}`}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          background:
                            dot === 'win'
                              ? 'var(--green)'
                              : dot === 'loss'
                                ? 'var(--red)'
                                : 'var(--amber)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section style={{ flex: 1, minWidth: 0, overflowY: 'auto' }} className="flyxa-entry-scroll">
        {activeEntry && activeReflection && (
          <>
            <header
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                borderBottom: '1px solid var(--border-sub)',
                background: 'var(--bg)',
                padding: '14px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt)' }}>{formatDayTitle(activeEntry.date)}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--txt-2)' }}>
                  {account.name}
                  <span style={{ margin: '0 6px' }}>·</span>
                  {getAccountTypeLabel(account.type)}
                  <span style={{ margin: '0 6px' }}>·</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 500 }}>{toCurrency(activeEntry.pnl)}</span>
                  <span style={{ margin: '0 6px' }}>·</span>
                  {`Grade ${activeEntry.grade}`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  className="flyxa-btn-log-trade"
                  onClick={onOpenTradeScanner}
                >
                  <ArrowUpRight size={14} strokeWidth={2.5} />
                  Log Trade
                </button>
                <button type="button" className="flyxa-btn-primary">Save entry</button>
              </div>
            </header>

            <div style={{ padding: '20px 24px 40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 24 }}>
                {summaryStats.map(stat => (
                  <div
                    key={stat.label}
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt-3)' }}>
                      {stat.label}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 18,
                        fontWeight: 500,
                        color: stat.tone,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)' }}>
                    Trades
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeEntry.trades.length === 0 ? (
                    <div
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '12px 14px',
                        fontSize: 12,
                        color: 'var(--txt-3)',
                      }}
                    >
                      No trades logged for this day.
                    </div>
                  ) : activeEntry.trades.map(trade => {
                    const outcome = getTradeOutcome(trade);
                    const leftBorderColor =
                      outcome === 'win' ? 'var(--green)' : outcome === 'loss' ? 'var(--red)' : 'var(--amber)';
                    const directionBg = trade.direction === 'LONG' ? 'var(--cobalt-dim)' : 'var(--red-dim)';
                    const directionColor = trade.direction === 'LONG' ? 'var(--cobalt)' : '#FCA5A5';
                    const priceLine = `${trade.entryPrice} -> ${trade.exitPrice} · ${trade.cents} cts`;

                    return (
                      <div
                        key={trade.id}
                        className="flyxa-trade-card"
                        style={{
                          background: 'var(--surface-1)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          borderLeft: `2px solid ${leftBorderColor}`,
                          padding: '11px 14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              minWidth: 28,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 14,
                              fontWeight: 500,
                              color: 'var(--txt)',
                            }}
                          >
                            {trade.symbol}
                          </div>

                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 3,
                              background: directionBg,
                              color: directionColor,
                            }}
                          >
                            {trade.direction}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                color: 'var(--txt-2)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {`${trade.entryTime} -> ${trade.exitTime}`}
                            </div>
                            <div
                              style={{
                                marginTop: 2,
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                color: 'var(--txt-3)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {priceLine}
                            </div>
                          </div>

                          <div
                            style={{
                              minWidth: 48,
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              color: 'var(--txt-3)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {toR(trade.rr)}
                          </div>

                          <button
                            type="button"
                            className="flyxa-shot-slot"
                            style={{
                              width: 48,
                              height: 32,
                              borderRadius: 3,
                              border: '1px solid var(--border)',
                              background: 'var(--surface-2)',
                              color: 'var(--txt-3)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <ImageIcon size={13} />
                          </button>

                          <div
                            style={{
                              minWidth: 68,
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 14,
                              fontWeight: 500,
                              fontVariantNumeric: 'tabular-nums',
                              color: getPnLColor(trade.pnl),
                            }}
                          >
                            {toCurrency(trade.pnl)}
                          </div>

                          <button
                            type="button"
                            className="flyxa-btn-delete"
                            aria-label={`Delete ${trade.symbol} trade`}
                            onClick={() => { void handleDeleteTrade(trade.id); }}
                            disabled={deletingTradeId === trade.id}
                            title="Delete trade"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)' }}>
                    Screenshots
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {[0, 1, 2].map(index => {
                    const imageUrl = activeEntry.screenshots?.[index] ?? '';
                    return (
                      <button
                        key={`screen-${index}`}
                        type="button"
                        className="flyxa-shot-slot"
                        style={{
                          width: '100%',
                          aspectRatio: '16 / 9',
                          borderRadius: 5,
                          border: '1px dashed var(--border)',
                          background: 'var(--surface-1)',
                          color: 'var(--txt-3)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt={`Chart ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ display: 'grid', placeItems: 'center', gap: 4 }}>
                            <ImageIcon size={18} />
                            <span style={{ fontSize: 10 }}>Add chart</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 10 }}>
                  Reflection
                </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-sub)' }}>
                    {[
                      { key: 'pre', label: 'Pre-market' },
                      { key: 'post', label: 'Post-session' },
                      { key: 'lessons', label: 'Lessons' },
                    ].map(tab => {
                      const selected = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key as ReflectionTab)}
                          style={{
                            padding: '10px 16px',
                            fontSize: 12,
                            color: selected ? 'var(--cobalt)' : 'var(--txt-2)',
                            border: 'none',
                            borderBottom: selected ? '2px solid var(--cobalt)' : '2px solid transparent',
                            marginBottom: -1,
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: activeTab === 'pre' ? 'block' : 'none' }}>
                    <textarea
                      className="flyxa-reflect"
                      value={activeReflection.pre}
                      onChange={event => handleReflectionChange('pre', event.target.value)}
                      placeholder="Game plan, key levels, bias, setups you're watching..."
                      style={{
                        width: '100%',
                        minHeight: 108,
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: 'var(--txt)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: activeTab === 'post' ? 'block' : 'none' }}>
                    <textarea
                      className="flyxa-reflect"
                      value={activeReflection.post}
                      onChange={event => handleReflectionChange('post', event.target.value)}
                      placeholder="How did the session go? What happened vs your plan?"
                      style={{
                        width: '100%',
                        minHeight: 108,
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: 'var(--txt)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: activeTab === 'lessons' ? 'block' : 'none' }}>
                    <textarea
                      className="flyxa-reflect"
                      value={activeReflection.lessons}
                      onChange={event => handleReflectionChange('lessons', event.target.value)}
                      placeholder="What did you learn? What would you do differently?"
                      style={{
                        width: '100%',
                        minHeight: 108,
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: 'var(--txt)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 10 }}>
                  Rule Checklist
                </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {activeEntry.rules.map((rule, index) => {
                    const isLast = index === activeEntry.rules.length - 1;
                    const isOk = rule.state === 'ok';
                    const isFail = rule.state === 'fail';

                    return (
                      <div
                        key={rule.id}
                        className="flyxa-rule-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderBottom: isLast ? 'none' : '1px solid var(--border-sub)',
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            border: `1px solid ${
                              isOk ? 'var(--green)' : isFail ? 'var(--red)' : 'var(--border)'
                            }`,
                            background: isOk ? 'var(--green-dim)' : isFail ? 'var(--red-dim)' : 'transparent',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isOk && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2 5.2L4.1 7.2L8 2.8" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {isFail && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </span>

                        <span
                          style={{
                            fontSize: 12,
                            color: isOk ? 'var(--txt)' : isFail ? 'var(--red)' : 'var(--txt-2)',
                            textDecoration: isFail ? 'line-through' : 'none',
                            textDecorationColor: isFail ? 'rgba(248,113,113,0.4)' : 'transparent',
                          }}
                        >
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 10 }}>
                  Psychology
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {[
                    {
                      label: 'Setup Quality',
                      score: activeEntry.psychology.setupQuality,
                      note: activeEntry.psychology.setupQualityNote,
                      tone: 'g',
                    },
                    {
                      label: 'Discipline',
                      score: activeEntry.psychology.discipline,
                      note: activeEntry.psychology.disciplineNote,
                      tone: 'a',
                    },
                    {
                      label: 'Execution',
                      score: activeEntry.psychology.execution,
                      note: activeEntry.psychology.executionNote,
                      tone: 'r',
                    },
                  ].map(card => (
                    <div
                      key={card.label}
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--txt-3)',
                          marginBottom: 10,
                        }}
                      >
                        {card.label}
                      </div>

                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5].map(pip => {
                          const base = 'var(--surface-3)';
                          const fullColor = card.tone === 'g'
                            ? 'var(--green)'
                            : card.tone === 'a'
                              ? 'var(--amber)'
                              : 'var(--red)';

                          let background = base;
                          if (card.score >= pip) {
                            background = fullColor;
                          } else if (card.score >= pip - 0.5) {
                            background = `linear-gradient(90deg, ${fullColor} 50%, ${base} 50%)`;
                          }

                          return (
                            <span
                              key={`${card.label}-${pip}`}
                              style={{
                                flex: 1,
                                height: 3,
                                borderRadius: 2,
                                background,
                              }}
                            />
                          );
                        })}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 17,
                          fontWeight: 500,
                          color: 'var(--txt)',
                        }}
                      >
                        {`${card.score}/5`}
                      </div>

                      <div style={{ marginTop: 2, fontSize: 11, color: 'var(--txt-3)' }}>{card.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 10 }}>
                  State of Mind
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {STATE_OF_MIND_TAGS.map(tag => {
                    const tone = selectedEmotionTone.get(tag.toLowerCase());
                    const selected = Boolean(tone);

                    let border = 'var(--border)';
                    let color = 'var(--txt-2)';
                    let background = 'transparent';

                    if (selected && tone === 's-g') {
                      border = 'rgba(52,211,153,0.3)';
                      color = 'var(--green)';
                      background = 'var(--green-dim)';
                    }
                    if (selected && tone === 's-a') {
                      border = 'rgba(251,191,36,0.3)';
                      color = 'var(--amber)';
                      background = 'var(--amber-dim)';
                    }
                    if (selected && tone === 's-r') {
                      border = 'rgba(248,113,113,0.3)';
                      color = 'var(--red)';
                      background = 'var(--red-dim)';
                    }

                    return (
                      <button
                        key={tag}
                        type="button"
                        className="flyxa-state-tag"
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 3,
                          border: `1px solid ${border}`,
                          color,
                          background,
                          cursor: 'pointer',
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function TradeScanner() {
  const { createTrade, deleteTrade } = useTrades();
  const [showAdd, setShowAdd] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('date') ?? undefined;

  const handleSave = async (data: Partial<Trade>) => {
    await createTrade(data);
    setShowAdd(false);
  };

  const handleDeleteTrade = async (tradeId: string) => {
    const isSeededTrade = /^t-\d/.test(tradeId);
    if (isSeededTrade) return;
    await deleteTrade(tradeId);
  };

  return (
    <>
      <FlyxaJournalPage
        date={requestedDate}
        entries={DEFAULT_ENTRIES}
        account={DEFAULT_ACCOUNT}
        onOpenTradeScanner={() => setShowAdd(true)}
        onDeleteTrade={handleDeleteTrade}
      />
      <ScreenshotImportModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleSave}
      />
    </>
  );
}


