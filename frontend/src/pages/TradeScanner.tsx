import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Image as ImageIcon, Search, Trash2 } from 'lucide-react';
import TradeForm from '../components/scanner/TradeForm.js';
import { buildScannerAssets } from '../components/scanner/ScreenshotImportModal.js';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { lookupContract } from '../constants/futuresContracts.js';
import { aiApi } from '../services/api.js';
import { Trade } from '../types/index.js';
import { formatRiskRewardRatio } from '../utils/riskReward.js';

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
  tradesById?: Record<string, Trade>;
  initialTradeId?: string;
  forceImportPrompt?: boolean;
  onDeleteTrade?: (tradeId: string) => Promise<void> | void;
  onUpdateTrade?: (tradeId: string, data: Partial<Trade>) => Promise<void> | void;
  onImportFirstTradeImage?: (file: File) => void;
  isImportingFirstTrade?: boolean;
  firstTradeImportError?: string | null;
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
  return formatRiskRewardRatio(value, {
    includeSign: true,
    placeholder: '0 RR',
  });
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

const SCAN_SYMBOL_MAP: Record<string, string> = {
  NQM26: 'NQ', NQH26: 'NQ', NQU26: 'NQ', NQZ26: 'NQ',
  ESM26: 'ES', ESH26: 'ES', ESU26: 'ES', ESZ26: 'ES',
  MNQM26: 'MNQ', MNQH26: 'MNQ', MNQU26: 'MNQ', MNQZ26: 'MNQ',
  MESM26: 'MES', MESH26: 'MES', MESU26: 'MES', MESZ26: 'MES',
};

const INTERNAL_SCAN_WARNINGS = new Set([
  'Exact price-label review failed, so price levels relied on the broader chart reads.',
  'Exit verification failed — relying on manual chart read.',
  'Exit verification failed, so the final answer relied on the manual chart read.',
  'Stop/target sanity check failed, so the final answer relied on the broader exit review.',
  'Header symbol/timeframe read failed, so identity relied on the broader chart reads.',
  'Primary chart extraction failed, so the scanner fell back to the human-style review pass.',
  'Human-style review failed, so the scanner relied on the primary extraction pass.',
  'Final consensus review failed, so the result relied on the primary extraction passes.',
  'Sanity check failed — relying on exit verification result.',
]);

type ScannerExtraction = Awaited<ReturnType<typeof aiApi.scanChart>>;

function filterScanWarnings(warnings: string[] | undefined): string[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.filter(msg => !INTERNAL_SCAN_WARNINGS.has(msg));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toScanTime(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function resolveScanSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (!upper || ['UNKNOWN', 'UNKWN', 'N/A', 'NA', 'NONE', 'NULL'].includes(upper)) return null;
  return SCAN_SYMBOL_MAP[upper] ?? upper;
}

function inferSymbolFromFileName(fileName: string): string | null {
  const upper = fileName.toUpperCase();
  const match = upper.match(/(?:^|[^A-Z0-9])(MNQ|MES|NQ|ES|MYM|YM|M2K|RTY|CL|MCL|GC|MGC|SI|SIL|6E)(?=[^A-Z0-9]|$)/);
  return match ? match[1] : null;
}

function resolveExitReason(extracted: {
  exit_reason?: 'TP' | 'SL' | null;
  pnl_result?: 'Win' | 'Loss' | null;
}): 'TP' | 'SL' | null {
  if (extracted.exit_reason === 'TP' || extracted.exit_reason === 'SL') return extracted.exit_reason;
  if (extracted.pnl_result === 'Win') return 'TP';
  if (extracted.pnl_result === 'Loss') return 'SL';
  return null;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNowTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      if (typeof event.target?.result === 'string') {
        resolve(event.target.result);
        return;
      }
      reject(new Error('Failed to read image file'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function buildTradePatchFromScan(options: {
  extracted: ScannerExtraction;
  fileName: string;
  baseTrade?: Partial<Trade>;
  fallbackDate: string;
  fallbackTime: string;
  accountId?: string;
  screenshotDataUrl?: string;
}): {
  patch: Partial<Trade>;
  aiFields: Set<string>;
  warnings: string[];
  evidence: string;
} {
  const { extracted, fileName, baseTrade, fallbackDate, fallbackTime, accountId, screenshotDataUrl } = options;
  const aiFields = new Set<string>();
  const patch: Partial<Trade> = {
    ...(baseTrade ?? {}),
    accountId: accountId ?? baseTrade?.accountId ?? baseTrade?.account_id,
    trade_date: baseTrade?.trade_date || fallbackDate,
    trade_time: baseTrade?.trade_time || fallbackTime,
    contract_size: Math.max(1, Number(baseTrade?.contract_size ?? 1)),
  };

  if (screenshotDataUrl) {
    patch.screenshot_url = screenshotDataUrl;
  }

  const extractedSymbol = resolveScanSymbol(extracted.symbol);
  const symbol = extractedSymbol ?? inferSymbolFromFileName(fileName) ?? patch.symbol ?? null;
  if (symbol) {
    patch.symbol = symbol;
    if (extractedSymbol) {
      aiFields.add('symbol');
    }
    const contract = lookupContract(symbol);
    if (contract) {
      patch.point_value = contract.point_value;
    }
  }

  if (extracted.direction) {
    patch.direction = extracted.direction;
    aiFields.add('direction');
  }
  if (isFiniteNumber(extracted.entry_price)) {
    patch.entry_price = Number(extracted.entry_price);
    aiFields.add('entry_price');
  }
  if (isFiniteNumber(extracted.sl_price)) {
    patch.sl_price = Number(extracted.sl_price);
    aiFields.add('sl_price');
  }
  if (isFiniteNumber(extracted.tp_price)) {
    patch.tp_price = Number(extracted.tp_price);
    aiFields.add('tp_price');
  }

  const resolvedExitReason = resolveExitReason(extracted);
  if (resolvedExitReason) {
    patch.exit_reason = resolvedExitReason;
    patch.exit_price = resolvedExitReason === 'TP'
      ? Number(extracted.tp_price ?? patch.tp_price ?? 0)
      : Number(extracted.sl_price ?? patch.sl_price ?? 0);
    aiFields.add('exit_reason');
  }

  const extractedTime = toScanTime(extracted.entry_time);
  if (extractedTime) {
    patch.trade_time = extractedTime;
    aiFields.add('trade_time');
  }

  if (isFiniteNumber(extracted.trade_length_seconds)) {
    patch.trade_length_seconds = Number(extracted.trade_length_seconds);
    aiFields.add('trade_length_seconds');
  }
  if (isFiniteNumber(extracted.candle_count)) {
    patch.candle_count = Number(extracted.candle_count);
  }
  if (isFiniteNumber(extracted.timeframe_minutes)) {
    patch.timeframe_minutes = Number(extracted.timeframe_minutes);
  }

  return {
    patch,
    aiFields,
    warnings: filterScanWarnings(extracted.warnings),
    evidence: extracted.first_touch_evidence ?? '',
  };
}

function toJournalDirection(direction: Trade['direction']): FlyxaJournalDirection {
  return direction === 'Short' ? 'SHORT' : 'LONG';
}

function toClockTime(value: string | undefined): string {
  if (!value) return '00:00';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '00:00';
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addSecondsToTime(time: string, seconds: number | undefined): string {
  const [hours, minutes] = toClockTime(time).split(':').map(Number);
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds as number)) : 0;
  const total = ((hours * 3600) + (minutes * 60) + safeSeconds) % 86400;
  const outHours = Math.floor(total / 3600);
  const outMinutes = Math.floor((total % 3600) / 60);
  return `${String(outHours).padStart(2, '0')}:${String(outMinutes).padStart(2, '0')}`;
}

function getTradeStatus(trade: Trade): FlyxaJournalTrade['status'] {
  if (trade.exit_reason === 'TP') return 'win';
  if (trade.exit_reason === 'SL') return 'loss';
  return 'open';
}

function getTradeR(trade: Trade): number {
  const risk = Math.abs(trade.entry_price - trade.sl_price);
  if (!Number.isFinite(risk) || risk <= 0) return 0;
  const reward = trade.direction === 'Long'
    ? trade.exit_price - trade.entry_price
    : trade.entry_price - trade.exit_price;
  return Number((reward / risk).toFixed(2));
}

function getDayGrade(totalPnl: number, winRate: number): string {
  if (totalPnl > 0 && winRate >= 70) return 'A';
  if (totalPnl > 0 && winRate >= 50) return 'B';
  if (totalPnl >= 0) return 'B-';
  if (winRate >= 50) return 'C';
  return 'D';
}

function getEmotionLabel(state: Trade['emotional_state'] | undefined): string {
  if (!state) return 'Focused';
  if (state === 'Revenge Trading') return 'Revenge trading';
  return state;
}

function getEmotionTone(state: Trade['emotional_state'] | undefined): FlyxaEmotionTone {
  if (state === 'Calm' || state === 'Confident') return 's-g';
  if (state === 'FOMO' || state === 'Overconfident') return 's-a';
  return 's-r';
}

function toJournalEntries(trades: Trade[]): FlyxaJournalEntry[] {
  if (trades.length === 0) return [];

  const byDate = new Map<string, Trade[]>();
  trades.forEach(trade => {
    const fallbackDate = typeof trade.created_at === 'string'
      ? trade.created_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(trade.trade_date) ? trade.trade_date : fallbackDate;
    const existing = byDate.get(dateKey);
    if (existing) {
      existing.push(trade);
    } else {
      byDate.set(dateKey, [trade]);
    }
  });

  const entries: FlyxaJournalEntry[] = [];
  byDate.forEach((dayTradesRaw, dateKey) => {
    const dayTrades = [...dayTradesRaw].sort((a, b) => toClockTime(a.trade_time).localeCompare(toClockTime(b.trade_time)));

    const mappedTrades: FlyxaJournalTrade[] = dayTrades.map(trade => {
      const entryTime = toClockTime(trade.trade_time);
      const exitTime = addSecondsToTime(entryTime, trade.trade_length_seconds);
      const signedMove = trade.direction === 'Long'
        ? trade.exit_price - trade.entry_price
        : trade.entry_price - trade.exit_price;

      return {
        id: trade.id,
        symbol: trade.symbol,
        direction: toJournalDirection(trade.direction),
        entryTime,
        exitTime,
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        cents: Math.round(signedMove * 100),
        rr: getTradeR(trade),
        pnl: trade.pnl,
        status: getTradeStatus(trade),
        screenshotUrl: trade.screenshot_url,
      };
    });

    const dayPnl = mappedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const wins = mappedTrades.filter(trade => trade.status === 'win').length;
    const winRate = mappedTrades.length > 0 ? (wins / mappedTrades.length) * 100 : 0;
    const grade = getDayGrade(dayPnl, winRate);

    const screenshots = dayTrades
      .map(trade => trade.screenshot_url?.trim() ?? '')
      .filter(url => url.length > 0)
      .slice(0, 3);

    const firstPre = dayTrades
      .map(trade => trade.pre_trade_notes?.trim() ?? '')
      .find(note => note.length > 0);
    const firstPost = dayTrades
      .map(trade => trade.post_trade_notes?.trim() ?? '')
      .find(note => note.length > 0);

    const confidenceValues = dayTrades
      .map(trade => trade.confidence_level)
      .filter((value): value is number => Number.isFinite(value));
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 7;
    const avgScore5 = Number(Math.min(5, Math.max(1, avgConfidence / 2)).toFixed(1));
    const followedPlanCount = dayTrades.filter(trade => Boolean(trade.followed_plan)).length;
    const followedPlanRatio = dayTrades.length > 0 ? followedPlanCount / dayTrades.length : 0;
    const disciplineScore = Number((1 + (followedPlanRatio * 4)).toFixed(1));
    const executionScore = Number((1 + ((winRate / 100) * 4)).toFixed(1));

    const emotionByLabel = new Map<string, FlyxaEmotionTone>();
    dayTrades.forEach(trade => {
      const label = getEmotionLabel(trade.emotional_state);
      if (!emotionByLabel.has(label)) {
        emotionByLabel.set(label, getEmotionTone(trade.emotional_state));
      }
    });

    entries.push({
      date: dateKey,
      pnl: dayPnl,
      grade,
      trades: mappedTrades,
      screenshots,
      reflection: {
        pre: firstPre ?? 'Game plan, key levels, bias, setups you are watching...',
        post: firstPost ?? 'Session complete. Log your process review and execution quality.',
        lessons: dayPnl >= 0
          ? 'Execution held up. Keep repeating your highest-quality setups.'
          : 'Protect capital first. Tighten selection and avoid low-quality entries.',
      },
      rules: [
        {
          id: `plan-${dateKey}`,
          label: 'Followed daily game plan',
          state: followedPlanRatio >= 0.8 ? 'ok' : followedPlanRatio <= 0.3 ? 'fail' : 'unchecked',
        },
        { id: `setups-${dateKey}`, label: 'Only traded A/B setups', state: 'unchecked' },
        { id: `risk-${dateKey}`, label: 'Respected position sizing rules', state: 'unchecked' },
      ],
      psychology: {
        setupQuality: avgScore5,
        setupQualityNote: `${dayTrades.length} trade${dayTrades.length === 1 ? '' : 's'} reviewed`,
        discipline: disciplineScore,
        disciplineNote: `${followedPlanCount}/${dayTrades.length} followed plan`,
        execution: executionScore,
        executionNote: `${wins}/${dayTrades.length} reached target`,
      },
      emotions: Array.from(emotionByLabel.entries()).map(([label, tone]) => ({ label, tone })),
    });
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
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
  tradesById = {},
  initialTradeId,
  forceImportPrompt = false,
  onDeleteTrade,
  onUpdateTrade,
  onImportFirstTradeImage,
  isImportingFirstTrade = false,
  firstTradeImportError = null,
}: FlyxaJournalPageProps) {
  const [entriesState, setEntriesState] = useState<FlyxaJournalEntry[]>(entries);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);
  const [firstTradeDropActive, setFirstTradeDropActive] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<Partial<Trade> | null>(null);
  const [editorImagePreview, setEditorImagePreview] = useState<string | null>(null);
  const [editorAiFields, setEditorAiFields] = useState<Set<string>>(new Set());
  const [editorWarnings, setEditorWarnings] = useState<string[]>([]);
  const [editorScanEvidence, setEditorScanEvidence] = useState('');
  const [editorScanError, setEditorScanError] = useState('');
  const [editorScanning, setEditorScanning] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDropActive, setEditorDropActive] = useState(false);
  const [showImportPrompt, setShowImportPrompt] = useState(forceImportPrompt);
  const firstTradeFileInputRef = useRef<HTMLInputElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntriesState(entries);
  }, [entries]);

  useEffect(() => {
    setShowImportPrompt(forceImportPrompt);
  }, [forceImportPrompt]);

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
  const shouldShowImportPrompt = showImportPrompt || !activeEntry;

  useEffect(() => {
    if (!forceImportPrompt && activeEntry && !isImportingFirstTrade && showImportPrompt) {
      setShowImportPrompt(false);
    }
  }, [activeEntry, forceImportPrompt, isImportingFirstTrade, showImportPrompt]);

  useEffect(() => {
    if (!activeEntry || activeEntry.trades.length === 0) {
      setSelectedTradeId(null);
      return;
    }

    if (initialTradeId && activeEntry.trades.some(trade => trade.id === initialTradeId)) {
      setSelectedTradeId(initialTradeId);
      return;
    }

    if (!selectedTradeId || !activeEntry.trades.some(trade => trade.id === selectedTradeId)) {
      setSelectedTradeId(activeEntry.trades[0].id);
    }
  }, [activeEntry, initialTradeId, selectedTradeId]);

  const selectedTrade = useMemo(() => {
    if (!selectedTradeId) return null;
    return tradesById[selectedTradeId] ?? null;
  }, [selectedTradeId, tradesById]);

  useEffect(() => {
    if (!selectedTrade) {
      setEditorDraft(null);
      setEditorImagePreview(null);
      setEditorAiFields(new Set());
      setEditorWarnings([]);
      setEditorScanEvidence('');
      setEditorScanError('');
      return;
    }

    setEditorDraft(selectedTrade);
    setEditorImagePreview(selectedTrade.screenshot_url ?? null);
    setEditorAiFields(new Set());
    setEditorWarnings([]);
    setEditorScanEvidence('');
    setEditorScanError('');
  }, [selectedTrade]);

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
        { label: 'Best R:R', value: '0 RR', tone: 'var(--txt)' },
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
      { label: 'Best R:R', value: toR(bestR), tone: 'var(--txt)' },
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
      setEntriesState(current => current
        .map(entry => {
          if (entry.date !== activeEntry.date) return entry;
          const nextTrades = entry.trades.filter(trade => trade.id !== tradeId);
          const nextPnl = nextTrades.reduce((sum, trade) => sum + trade.pnl, 0);
          return {
            ...entry,
            trades: nextTrades,
            pnl: nextPnl,
          };
        })
        .filter(entry => entry.trades.length > 0));
    } finally {
      setDeletingTradeId(null);
    }
  };

  const handleFirstTradeDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setFirstTradeDropActive(false);
    if (isImportingFirstTrade) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImportFirstTradeImage?.(file);
    }
  };

  const handleFirstTradeInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isImportingFirstTrade) {
      event.currentTarget.value = '';
      return;
    }
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    onImportFirstTradeImage?.(file);
  };

  const openFirstTradeFilePicker = () => {
    firstTradeFileInputRef.current?.click();
  };

  const openEditorFilePicker = () => {
    editorFileInputRef.current?.click();
  };

  const resetEditorState = () => {
    if (!selectedTrade) return;
    setEditorDraft(selectedTrade);
    setEditorImagePreview(selectedTrade.screenshot_url ?? null);
    setEditorAiFields(new Set());
    setEditorWarnings([]);
    setEditorScanEvidence('');
    setEditorScanError('');
  };

  const handleEditorScan = async (file: File) => {
    if (!selectedTradeId || editorScanning) {
      return;
    }

    setEditorDropActive(false);
    setEditorScanError('');
    setEditorWarnings([]);
    setEditorScanning(true);
    try {
      const screenshotDataUrl = await toDataUrl(file);
      const baseTrade = editorDraft ?? selectedTrade ?? {};
      const scanDate = baseTrade.trade_date || getTodayDate();
      const scanTime = toScanTime(baseTrade.trade_time) || getNowTime();
      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const extracted = await aiApi.scanChart(
        uploadImage,
        scanDate,
        scanTime,
        focusImages,
        scannerContext ?? undefined
      );
      const mapped = buildTradePatchFromScan({
        extracted,
        fileName: file.name,
        baseTrade,
        fallbackDate: scanDate,
        fallbackTime: scanTime,
        screenshotDataUrl,
      });

      setEditorImagePreview(screenshotDataUrl);
      setEditorDraft(mapped.patch);
      setEditorAiFields(mapped.aiFields);
      setEditorWarnings(mapped.warnings);
      setEditorScanEvidence(mapped.evidence);
    } catch (error) {
      setEditorScanError(error instanceof Error ? error.message : 'Failed to analyse trade screenshot.');
    } finally {
      setEditorScanning(false);
    }
  };

  const handleEditorDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setEditorDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void handleEditorScan(file);
    }
  };

  const handleEditorInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    void handleEditorScan(file);
  };

  const handleSaveTradeEditor = async (data: Partial<Trade>) => {
    if (!selectedTradeId) {
      return;
    }

    setEditorScanError('');
    setEditorSaving(true);
    try {
      await onUpdateTrade?.(selectedTradeId, {
        ...data,
        screenshot_url: editorImagePreview ?? data.screenshot_url,
      });
      setEditorAiFields(new Set());
    } catch (error) {
      setEditorScanError(error instanceof Error ? error.message : 'Failed to save trade.');
    } finally {
      setEditorSaving(false);
    }
  };

  const monthLabel = formatMonthLabel(monthCursor);
  const showGlobalAnalysisPill = isImportingFirstTrade || editorScanning;

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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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

      {showGlobalAnalysisPill && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            right: 18,
            zIndex: 120,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid rgba(251,146,60,0.6)',
            background: 'rgba(7,10,18,0.94)',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '2px solid #f59e0b',
              borderTopColor: 'transparent',
              display: 'inline-block',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Flyxa is analysing your trade
        </div>
      )}

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
        <input
          ref={firstTradeFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFirstTradeInputChange}
        />
        <input
          ref={editorFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleEditorInputChange}
        />
        {activeEntry && activeReflection && !shouldShowImportPrompt && (
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
                  onClick={() => setShowImportPrompt(true)}
                  disabled={!onImportFirstTradeImage || isImportingFirstTrade}
                  style={{
                    opacity: onImportFirstTradeImage && !isImportingFirstTrade ? 1 : 0.5,
                    cursor: onImportFirstTradeImage && !isImportingFirstTrade ? 'pointer' : 'not-allowed',
                  }}
                >
                  <ArrowUpRight size={14} strokeWidth={2.5} />
                  Log Trade
                </button>
                <button
                  type="button"
                  className="flyxa-btn-primary"
                  onClick={() => {
                    if (!selectedTradeId || !editorDraft || editorSaving) {
                      return;
                    }
                    void handleSaveTradeEditor(editorDraft);
                  }}
                  disabled={!selectedTradeId || !editorDraft || editorSaving}
                  style={{
                    opacity: !selectedTradeId || !editorDraft || editorSaving ? 0.6 : 1,
                    cursor: !selectedTradeId || !editorDraft || editorSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editorSaving ? 'Saving…' : 'Save entry'}
                </button>
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
                        position: 'relative',
                        background: 'var(--surface-1)',
                        border: firstTradeDropActive
                          ? '1px dashed rgba(59,130,246,0.6)'
                          : '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '24px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'border-color 0.16s, background 0.16s',
                        backgroundColor: firstTradeDropActive ? 'rgba(59,130,246,0.08)' : 'var(--surface-1)',
                      }}
                      onDragOver={event => {
                        if (isImportingFirstTrade) return;
                        event.preventDefault();
                        setFirstTradeDropActive(true);
                      }}
                      onDragLeave={() => setFirstTradeDropActive(false)}
                      onDrop={handleFirstTradeDrop}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          border: firstTradeDropActive
                            ? '1px solid rgba(59,130,246,0.6)'
                            : '1px solid rgba(245,158,11,0.35)',
                          background: firstTradeDropActive
                            ? 'rgba(59,130,246,0.16)'
                            : 'rgba(245,158,11,0.12)',
                          display: 'grid',
                          placeItems: 'center',
                          color: firstTradeDropActive ? '#60a5fa' : 'var(--amber)',
                        }}
                      >
                        <ArrowUpRight size={16} strokeWidth={2.3} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                        {firstTradeDropActive ? 'Drop your trade screenshot to analyse' : 'No trades logged for this day'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt-3)', textAlign: 'center', maxWidth: 460 }}>
                        {firstTradeDropActive
                          ? 'Flyxa will analyse your chart and save this trade in the background.'
                          : 'Drag and drop your trade image here, or select a file to analyse and add it to your journal.'}
                      </div>
                      {firstTradeImportError && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#fca5a5',
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(248,113,113,0.35)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            maxWidth: 540,
                          }}
                        >
                          {firstTradeImportError}
                        </div>
                      )}
                      <button
                        type="button"
                        className="flyxa-btn-primary"
                        onClick={openFirstTradeFilePicker}
                        disabled={!onImportFirstTradeImage || isImportingFirstTrade}
                        style={{
                          opacity: onImportFirstTradeImage && !isImportingFirstTrade ? 1 : 0.5,
                          cursor: onImportFirstTradeImage && !isImportingFirstTrade ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Select File
                      </button>
                    </div>
                  ) : activeEntry.trades.map(trade => {
                    const outcome = getTradeOutcome(trade);
                    const selected = trade.id === selectedTradeId;
                    const leftBorderColor =
                      outcome === 'win' ? 'var(--green)' : outcome === 'loss' ? 'var(--red)' : 'var(--amber)';
                    const directionBg = trade.direction === 'LONG' ? 'var(--cobalt-dim)' : 'var(--red-dim)';
                    const directionColor = trade.direction === 'LONG' ? 'var(--cobalt)' : '#FCA5A5';
                    const priceLine = `${trade.entryPrice} -> ${trade.exitPrice} · ${trade.cents} cts`;

                    return (
                      <div
                        key={trade.id}
                        className="flyxa-trade-card"
                        onClick={() => setSelectedTradeId(trade.id)}
                        style={{
                          background: 'var(--surface-1)',
                          border: selected
                            ? '1px solid rgba(110,168,254,0.55)'
                            : '1px solid var(--border)',
                          borderRadius: 6,
                          borderLeft: `2px solid ${leftBorderColor}`,
                          padding: '11px 14px',
                          cursor: 'pointer',
                          boxShadow: selected ? '0 0 0 1px rgba(110,168,254,0.2)' : 'none',
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
                            onClick={event => { event.stopPropagation(); }}
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
                            onClick={event => {
                              event.stopPropagation();
                              void handleDeleteTrade(trade.id);
                            }}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, alignItems: 'start', marginBottom: 24 }}>

                {/* LEFT: Chart Scanner + day-level reflection sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {selectedTrade && editorDraft && (
                    <div
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt-3)' }}>
                            Chart Scanner
                          </div>
                          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                            Import screenshot
                          </div>
                          <div style={{ marginTop: 3, fontSize: 11, color: 'var(--txt-3)' }}>
                            Analyze this chart and auto-fill entry, exit, SL, TP, and duration.
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          border: editorDropActive
                            ? '1px dashed rgba(59,130,246,0.6)'
                            : '1px dashed var(--border)',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: 'var(--surface-2)',
                          minHeight: 210,
                          display: 'grid',
                          placeItems: 'center',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                        onClick={openEditorFilePicker}
                        onDragOver={event => {
                          event.preventDefault();
                          if (!editorScanning) {
                            setEditorDropActive(true);
                          }
                        }}
                        onDragLeave={() => setEditorDropActive(false)}
                        onDrop={handleEditorDrop}
                      >
                        {editorImagePreview ? (
                          <img
                            src={editorImagePreview}
                            alt="Trade screenshot preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ display: 'grid', placeItems: 'center', gap: 5, color: 'var(--txt-3)' }}>
                            <ImageIcon size={18} />
                            <span style={{ fontSize: 11 }}>Drop chart or click to upload</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="flyxa-btn-primary"
                          onClick={openEditorFilePicker}
                          disabled={editorScanning}
                          style={{ height: 34 }}
                        >
                          Import File
                        </button>
                        <button
                          type="button"
                          className="flyxa-btn-primary"
                          onClick={resetEditorState}
                          disabled={editorScanning}
                          style={{ height: 34 }}
                        >
                          Reset Draft
                        </button>
                      </div>

                      {editorScanEvidence && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#bfdbfe',
                            background: 'rgba(59,130,246,0.12)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: 6,
                            padding: '8px 10px',
                          }}
                        >
                          {editorScanEvidence}
                        </div>
                      )}

                      {editorWarnings.length > 0 && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#fcd34d',
                            background: 'rgba(250,204,21,0.1)',
                            border: '1px solid rgba(250,204,21,0.3)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            display: 'grid',
                            gap: 4,
                          }}
                        >
                          {editorWarnings.map(warning => (
                            <span key={warning}>{warning}</span>
                          ))}
                        </div>
                      )}

                      {editorScanError && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#fca5a5',
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(248,113,113,0.35)',
                            borderRadius: 6,
                            padding: '8px 10px',
                          }}
                        >
                          {editorScanError}
                        </div>
                      )}
                    </div>

                  )}

                  {/* Reflection */}
                  <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 8 }}>
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

                  {/* Rule Checklist */}
                  <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 8 }}>
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

                  {/* Psychology */}
                  <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 8 }}>
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

                  {/* State of Mind */}
                  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 10 }}>
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

                {/* RIGHT: TradeForm */}
                {selectedTrade && editorDraft && (
                  <div
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <TradeForm
                      initialData={editorDraft}
                      aiFields={editorAiFields}
                      tradeDate={editorDraft.trade_date ?? ''}
                      tradeTime={editorDraft.trade_time ?? ''}
                      onSubmit={data => { void handleSaveTradeEditor(data); }}
                      onDraftChange={setEditorDraft}
                      onCancel={resetEditorState}
                      isLoading={editorSaving}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {shouldShowImportPrompt && (
          <div
            style={{
              minHeight: '100%',
              padding: '32px 24px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 760,
                minHeight: 320,
                borderRadius: 10,
                border: firstTradeDropActive
                  ? '1px dashed rgba(59,130,246,0.65)'
                  : '1px dashed rgba(245,158,11,0.35)',
                background: firstTradeDropActive
                  ? 'linear-gradient(180deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))'
                  : 'linear-gradient(180deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: '28px 24px',
                textAlign: 'center',
                transition: 'border-color 0.16s, background 0.16s',
              }}
              onDragOver={event => {
                if (isImportingFirstTrade) return;
                event.preventDefault();
                setFirstTradeDropActive(true);
              }}
              onDragLeave={() => setFirstTradeDropActive(false)}
              onDrop={handleFirstTradeDrop}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  border: firstTradeDropActive
                    ? '1px solid rgba(59,130,246,0.55)'
                    : '1px solid rgba(245,158,11,0.4)',
                  background: firstTradeDropActive
                    ? 'rgba(59,130,246,0.2)'
                    : 'rgba(245,158,11,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                  color: firstTradeDropActive ? '#60a5fa' : 'var(--amber)',
                }}
              >
                <ArrowUpRight size={20} strokeWidth={2.4} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)' }}>
                {firstTradeDropActive ? 'Drop your trade screenshot to analyse' : 'Drag and drop to analyse a trade'}
              </div>
              <div style={{ maxWidth: 520, fontSize: 13, color: 'var(--txt-3)', lineHeight: 1.65 }}>
                {firstTradeDropActive
                  ? 'We will analyse this in the background and populate your first journal trade.'
                  : 'Your trade journal is empty. Drag and drop a trade screenshot here, or select a file to analyse.'}
              </div>
              {firstTradeImportError && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#fca5a5',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(248,113,113,0.35)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    maxWidth: 540,
                  }}
                >
                  {firstTradeImportError}
                </div>
              )}
              <button
                type="button"
                className="flyxa-btn-primary"
                onClick={openFirstTradeFilePicker}
                disabled={!onImportFirstTradeImage || isImportingFirstTrade}
                style={{
                  opacity: onImportFirstTradeImage && !isImportingFirstTrade ? 1 : 0.5,
                  cursor: onImportFirstTradeImage && !isImportingFirstTrade ? 'pointer' : 'not-allowed',
                }}
              >
                Select File
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function TradeScanner() {
  const { trades, createTrade, updateTrade, deleteTrade } = useTrades();
  const { getDefaultTradeAccountId } = useAppSettings();
  const navigate = useNavigate();
  const [isImportingFirstTrade, setIsImportingFirstTrade] = useState(false);
  const [firstTradeImportError, setFirstTradeImportError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('date') ?? undefined;
  const requestedTradeId = searchParams.get('tradeId') ?? undefined;
  const importMode = searchParams.get('import') === '1';
  const journalEntries = useMemo(() => toJournalEntries(trades), [trades]);
  const tradesById = useMemo(
    () => Object.fromEntries(trades.map(trade => [trade.id, trade])),
    [trades]
  );

  const handleDeleteTrade = async (tradeId: string) => {
    await deleteTrade(tradeId);
  };

  const handleUpdateTrade = async (tradeId: string, data: Partial<Trade>) => {
    await updateTrade(tradeId, data);
  };

  const handleImportFirstTradeImage = async (file: File) => {
    if (isImportingFirstTrade) {
      return;
    }

    setFirstTradeImportError(null);
    setIsImportingFirstTrade(true);
    try {
      const scanDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? '') ? (requestedDate as string) : getTodayDate();
      const scanTime = getNowTime();
      const screenshotDataUrl = await toDataUrl(file);
      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const extracted = await aiApi.scanChart(
        uploadImage,
        scanDate,
        scanTime,
        focusImages,
        scannerContext ?? undefined
      );

      const mapped = buildTradePatchFromScan({
        extracted,
        fileName: file.name,
        fallbackDate: scanDate,
        fallbackTime: scanTime,
        accountId: getDefaultTradeAccountId(),
        screenshotDataUrl,
      });

      const symbol = mapped.patch.symbol;
      const direction = mapped.patch.direction;
      const entryPrice = mapped.patch.entry_price;
      const slPrice = mapped.patch.sl_price;
      const tpPrice = mapped.patch.tp_price;
      const exitReason = mapped.patch.exit_reason;

      if (!symbol || !direction || !isFiniteNumber(entryPrice) || !isFiniteNumber(slPrice) || !isFiniteNumber(tpPrice) || !exitReason || (exitReason !== 'TP' && exitReason !== 'SL')) {
        throw new Error('Could not extract enough trade details from this screenshot. Try a clearer chart image.');
      }

      const pointValue = lookupContract(symbol)?.point_value ?? 1;
      const tradeTime = toScanTime(mapped.patch.trade_time) || scanTime;
      const mappedTrade: Partial<Trade> = {
        ...mapped.patch,
        accountId: getDefaultTradeAccountId(),
        symbol,
        direction,
        entry_price: Number(entryPrice),
        sl_price: Number(slPrice),
        tp_price: Number(tpPrice),
        exit_reason: exitReason as 'TP' | 'SL',
        exit_price: exitReason === 'TP' ? Number(tpPrice) : Number(slPrice),
        contract_size: 1,
        point_value: pointValue,
        trade_date: scanDate,
        trade_time: tradeTime,
        trade_length_seconds: isFiniteNumber(mapped.patch.trade_length_seconds) ? Number(mapped.patch.trade_length_seconds) : 0,
        candle_count: isFiniteNumber(mapped.patch.candle_count) ? Number(mapped.patch.candle_count) : 0,
        timeframe_minutes: isFiniteNumber(mapped.patch.timeframe_minutes) ? Number(mapped.patch.timeframe_minutes) : 1,
        emotional_state: 'Calm',
        confidence_level: 7,
        pre_trade_notes: '',
        post_trade_notes: '',
        confluences: [],
        followed_plan: true,
        screenshot_url: mapped.patch.screenshot_url ?? screenshotDataUrl,
      };

      const createdTrade = await createTrade(mappedTrade);
      if (importMode) {
        navigate(`/scanner?date=${encodeURIComponent(scanDate)}&tradeId=${encodeURIComponent(createdTrade.id)}`, { replace: true });
      }
    } catch (error) {
      setFirstTradeImportError(error instanceof Error ? error.message : 'Failed to analyse trade screenshot.');
    } finally {
      setIsImportingFirstTrade(false);
    }
  };

  return (
    <FlyxaJournalPage
      date={requestedDate}
      entries={journalEntries}
      account={DEFAULT_ACCOUNT}
      tradesById={tradesById}
      initialTradeId={requestedTradeId}
      forceImportPrompt={importMode}
      onImportFirstTradeImage={handleImportFirstTradeImage}
      isImportingFirstTrade={isImportingFirstTrade}
      firstTradeImportError={firstTradeImportError}
      onDeleteTrade={handleDeleteTrade}
      onUpdateTrade={handleUpdateTrade}
    />
  );
}

