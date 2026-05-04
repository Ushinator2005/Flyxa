import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,

  FileText,
  Image as ImageIcon,
  Maximize2,

  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import useFlyxaStore from '../store/flyxaStore.js';
import type { JournalEntry as StoreJournalEntry } from '../store/types.js';
import { pushToast } from '../store/toastStore.js';
import { useTrades } from '../hooks/useTrades.js';
import { lookupContract } from '../constants/futuresContracts.js';
import { buildScannerAssets, inferSymbolFromFileName, normalizeResolvedSymbol } from '../utils/tradeScannerPipeline.js';
import { scanChart } from '../utils/scanChart.js';
import './TradeJournal.css';

type RuleState = 'ok' | 'fail' | 'unchecked';
type EmotionState = 'neutral' | 'green' | 'amber' | 'red';
type TradeResult = 'win' | 'loss' | 'open';
type TradeDirection = 'LONG' | 'SHORT';
type DayFilter = 'all' | 'win' | 'loss' | 'untagged';

interface JournalTrade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryTime: string;
  exitTime: string;
  durationMinutes?: number | null;
  entryPrice: number;
  exitPrice: number;
  entry?: number;
  exit?: number;
  sl?: number;
  tp?: number;
  priceLevelsSource?: 'ai' | 'manual';
  priceLevelsEdited?: boolean;
  contracts: number;
  rr: number;
  pnl: number;
  result: TradeResult;
  screenshotUrl?: string;
  reflection?: {
    thesis: string;
    execution: string;
    adjustment: string;
    processGrade: number;
    followedPlan: boolean | null;
  };
}

interface JournalEntry {
  id: string;
  date: string;
  scannedImageUrl?: string;
  trades: JournalTrade[];
  screenshots: string[];
  reflection: {
    pre: string;
    post: string;
    lessons: string;
  };
  rules: Array<{ text: string; state: RuleState }>;
  psychology: {
    setupQuality: number;
    discipline: number;
    execution: number;
  };
  emotions: Array<{ label: string; state: EmotionState }>;
}

const DEFAULT_RULES = [
  'Followed daily loss limit',
  'Only traded A/B setups',
  'Respected position sizing rules',
  'No trading during lunch window',
  'Stopped after 3 consecutive losses',
];

const TAGS = [
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

function getTodayIso() {
  return new Date().toISOString().split('T')[0];
}

function getNowTime() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function addSecondsToTime(time: string, seconds?: number | null): string | null {
  if (!Number.isFinite(seconds ?? NaN) || (seconds ?? 0) < 0) return null;
  const [hText, mText] = time.split(':');
  const hours = Number(hText);
  const minutes = Number(mText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const totalMinutes = (hours * 60) + minutes + Math.round((seconds ?? 0) / 60);
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const outHours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const outMinutes = (normalized % 60).toString().padStart(2, '0');
  return `${outHours}:${outMinutes}`;
}

function minutesBetweenTimes(start: string, end: string): number | null {
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  if (!Number.isFinite(startHours) || !Number.isFinite(startMinutes) || !Number.isFinite(endHours) || !Number.isFinite(endMinutes)) {
    return null;
  }
  const startTotal = (startHours * 60) + startMinutes;
  const endTotal = (endHours * 60) + endMinutes;
  let diff = endTotal - startTotal;
  if (diff < 0) diff += 24 * 60;
  if (diff <= 0) return null;
  return diff;
}

function formatDurationLabel(minutes?: number | null): string {
  if (!Number.isFinite(minutes ?? NaN) || (minutes ?? 0) <= 0) return '--m';
  return `${Math.round(minutes ?? 0)}m`;
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(value);
}

function formatDateTitle(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseDate(value)).toUpperCase();
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });
}

function formatSignedCurrency(value: number) {
  const abs = formatCurrency(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return formatCurrency(0);
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function toR(value: number) {
  return `${value.toFixed(2)}R`;
}

function formatCurrencyFixed(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePrice(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function getTradeEntry(trade: JournalTrade): number | undefined {
  return parsePrice(trade.entry) ?? parsePrice(trade.entryPrice);
}

function getTradeExit(trade: JournalTrade): number | undefined {
  return parsePrice(trade.exit) ?? parsePrice(trade.exitPrice);
}

function computeTradePnl(trade: JournalTrade, entry?: number, exit?: number): number {
  if (entry === undefined || exit === undefined) return 0;
  const pointValue = lookupContract(trade.symbol)?.point_value ?? 1;
  const contracts = trade.contracts > 0 ? trade.contracts : 1;
  return trade.direction === 'LONG'
    ? (exit - entry) * contracts * pointValue
    : (entry - exit) * contracts * pointValue;
}

function computeTradeRr(trade: JournalTrade, entry?: number): number {
  if (entry === undefined || trade.sl === undefined || trade.tp === undefined) return 0;
  const risk = trade.direction === 'LONG' ? entry - trade.sl : trade.sl - entry;
  const reward = trade.direction === 'LONG' ? trade.tp - entry : entry - trade.tp;
  if (risk <= 0 || reward <= 0) return 0;
  return reward / risk;
}

function withTradeDerivedValues(trade: JournalTrade): JournalTrade {
  const entry = getTradeEntry(trade);
  const exit = getTradeExit(trade);
  const pnl = computeTradePnl(trade, entry, exit);
  const rr = computeTradeRr(trade, entry);
  const result: TradeResult = exit === undefined ? 'open' : pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'open';
  return {
    ...trade,
    pnl,
    rr,
    result,
  };
}

function shiftMonth(current: Date, delta: number) {
  return new Date(current.getFullYear(), current.getMonth() + delta, 1);
}

function inMonth(dateValue: string, monthValue: Date) {
  const parsed = parseDate(dateValue);
  return parsed.getFullYear() === monthValue.getFullYear() && parsed.getMonth() === monthValue.getMonth();
}

function cycleRuleState(state: RuleState): RuleState {
  if (state === 'unchecked') return 'ok';
  if (state === 'ok') return 'fail';
  return 'unchecked';
}

function cycleEmotionState(state: EmotionState): EmotionState {
  if (state === 'neutral') return 'green';
  if (state === 'green') return 'amber';
  if (state === 'amber') return 'red';
  return 'neutral';
}

function getRulesTemplate() {
  if (typeof window === 'undefined') return DEFAULT_RULES;
  try {
    const raw = window.localStorage.getItem('flyxa_checklist');
    if (!raw) return DEFAULT_RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_RULES;
    const cleaned = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return cleaned.length ? cleaned : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

function createEmptyEntry(date: string, rulesTemplate: string[]): JournalEntry {
  return {
    id: crypto.randomUUID(),
    date,
    trades: [],
    screenshots: ['', '', ''],
    reflection: {
      pre: '',
      post: '',
      lessons: '',
    },
    rules: rulesTemplate.map(text => ({ text, state: 'unchecked' })),
    psychology: {
      setupQuality: 0,
      discipline: 0,
      execution: 0,
    },
    emotions: TAGS.map(label => ({ label, state: 'neutral' })),
  };
}

function computeEntryStats(entry: JournalEntry) {
  const pnl = entry.trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const wins = entry.trades.filter(trade => trade.result === 'win').length;
  const losses = entry.trades.filter(trade => trade.result === 'loss').length;
  const tradeCount = entry.trades.length;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  const avgRR = tradeCount ? entry.trades.reduce((sum, trade) => sum + trade.rr, 0) / tradeCount : 0;
  const okCount = entry.rules.filter(rule => rule.state === 'ok').length;
  const failCount = entry.rules.filter(rule => rule.state === 'fail').length;
  const evaluatedRules = okCount + failCount;
  const rulePassPct = evaluatedRules ? (okCount / evaluatedRules) * 100 : 0;
  const discipline = entry.psychology.discipline;
  const tradesWithGrade = entry.trades.filter(t => (t.reflection?.processGrade ?? 0) > 0);
  const avgProcessGrade = tradesWithGrade.length > 0
    ? tradesWithGrade.reduce((sum, t) => sum + t.reflection!.processGrade, 0) / tradesWithGrade.length
    : null;
  const effectiveDiscipline = avgProcessGrade !== null
    ? discipline * 0.7 + avgProcessGrade * 0.3
    : discipline;
  let grade = 'C';
  if (effectiveDiscipline >= 4 && rulePassPct >= 80) grade = 'A+';
  else if (effectiveDiscipline >= 3.5 && rulePassPct >= 70) grade = 'A';
  else if (effectiveDiscipline >= 3 && rulePassPct >= 60) grade = 'B+';
  else if (effectiveDiscipline >= 2.5 && rulePassPct >= 50) grade = 'B';
  else if (effectiveDiscipline >= 2) grade = 'C+';
  return { pnl, wins, losses, tradeCount, winRate, avgRR, grade };
}

function findBestDay(entries: JournalEntry[]) {
  if (!entries.length) return null;
  let best = -Infinity;
  entries.forEach(entry => {
    const pnl = computeEntryStats(entry).pnl;
    if (pnl > best) best = pnl;
  });
  return Number.isFinite(best) ? best : null;
}

function fromLegacyRecords(value: unknown[], rulesTemplate: string[]): JournalEntry[] {
  const grouped = new Map<string, JournalEntry>();
  value.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    if (typeof record.date !== 'string') return;
    const date = record.date;
    if (!grouped.has(date)) {
      grouped.set(date, createEmptyEntry(date, rulesTemplate));
    }
    const entry = grouped.get(date);
    if (!entry) return;

    const symbol = typeof record.symbol === 'string' && record.symbol.trim() ? record.symbol.trim().toUpperCase() : 'NQ';
    const direction: TradeDirection = record.direction === 'Short' ? 'SHORT' : 'LONG';
    const entryPrice = typeof record.entry_price === 'number' ? record.entry_price : 0;
    const exitPrice = typeof record.exit_price === 'number' ? record.exit_price : entryPrice;
    const contracts = typeof record.contract_size === 'number' && record.contract_size > 0 ? record.contract_size : 1;
    const pointValue = typeof record.point_value === 'number' && record.point_value > 0
      ? record.point_value
      : (lookupContract(symbol)?.point_value ?? 1);
    const pnl = direction === 'LONG'
      ? (exitPrice - entryPrice) * pointValue * contracts
      : (entryPrice - exitPrice) * pointValue * contracts;
    const result: TradeResult = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'open';
    const rr = typeof record.sl_price === 'number' && Number.isFinite(record.sl_price) && record.sl_price !== entryPrice
      ? Math.abs((direction === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice) / Math.abs(entryPrice - record.sl_price))
      : 0;

    const trade: JournalTrade = {
      id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
      symbol,
      direction,
      entryTime: typeof record.time === 'string' ? record.time.slice(0, 5) : '09:30',
      exitTime: typeof record.time === 'string' ? record.time.slice(0, 5) : '09:45',
      durationMinutes:
        typeof record.trade_length_seconds === 'number' && Number.isFinite(record.trade_length_seconds)
          ? Math.max(1, Math.round(record.trade_length_seconds / 60))
          : null,
      entryPrice,
      exitPrice,
      entry: entryPrice > 0 ? entryPrice : undefined,
      exit: exitPrice > 0 ? exitPrice : undefined,
      sl: typeof record.sl_price === 'number' && Number.isFinite(record.sl_price) ? record.sl_price : undefined,
      tp: typeof record.tp_price === 'number' && Number.isFinite(record.tp_price) ? record.tp_price : undefined,
      priceLevelsSource: 'manual',
      priceLevelsEdited: true,
      contracts,
      rr,
      pnl,
      result,
      screenshotUrl: typeof record.screenshot === 'string' ? record.screenshot : undefined,
    };
    entry.trades.push(withTradeDerivedValues(trade));
    if (trade.screenshotUrl && !entry.scannedImageUrl) entry.scannedImageUrl = trade.screenshotUrl;
  });
  return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeEntries(value: unknown[], rulesTemplate: string[]): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const looksModern = value.every(item => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return typeof record.date === 'string' && Array.isArray(record.trades);
  });
  if (!looksModern) return fromLegacyRecords(value, rulesTemplate);

  return value
    .map(item => {
      const record = item as Record<string, unknown>;
      const date = typeof record.date === 'string' ? record.date : getTodayIso();
      const tradesRaw = Array.isArray(record.trades) ? record.trades : [];
      const trades: JournalTrade[] = tradesRaw.map(tradeRaw => {
        const trade = tradeRaw as Record<string, unknown>;
        const symbol = typeof trade.symbol === 'string' ? trade.symbol : 'NQ';
        const direction: TradeDirection = trade.direction === 'SHORT' ? 'SHORT' : 'LONG';
        const entryPrice = typeof trade.entryPrice === 'number' && trade.entryPrice > 0 ? trade.entryPrice : typeof trade.entry === 'number' && trade.entry > 0 ? trade.entry : 0;
        const exitPrice = typeof trade.exitPrice === 'number' && trade.exitPrice > 0 ? trade.exitPrice : typeof trade.exit === 'number' && trade.exit > 0 ? trade.exit : 0;
        const contracts = typeof trade.contracts === 'number' && trade.contracts > 0 ? trade.contracts : 1;
        const pnl = typeof trade.pnl === 'number' ? trade.pnl : 0;
        const result: TradeResult = trade.result === 'win' || trade.result === 'loss' || trade.result === 'open'
          ? trade.result
          : pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'open';
        const tradeRef = (() => {
          const r = trade.reflection as Record<string, unknown> | undefined;
          if (!r || typeof r !== 'object') return undefined;
          return {
            thesis: typeof r.thesis === 'string' ? r.thesis : '',
            execution: typeof r.execution === 'string' ? r.execution : '',
            adjustment: typeof r.adjustment === 'string' ? r.adjustment : '',
            processGrade: typeof r.processGrade === 'number' ? r.processGrade : 0,
            followedPlan: r.followedPlan === true || r.followedPlan === false ? r.followedPlan : null,
          };
        })();
        const normalizedTrade: JournalTrade = {
          id: typeof trade.id === 'string' ? trade.id : crypto.randomUUID(),
          symbol,
          direction,
          entryTime: typeof trade.entryTime === 'string' ? trade.entryTime : typeof trade.time === 'string' ? trade.time : '09:30',
          exitTime: typeof trade.exitTime === 'string' ? trade.exitTime : '09:45',
          durationMinutes:
            typeof trade.durationMinutes === 'number'
              ? trade.durationMinutes
              : typeof trade.duration === 'number'
                ? trade.duration
                : typeof trade.trade_length_seconds === 'number'
                  ? Math.round(trade.trade_length_seconds / 60)
                  : null,
          entryPrice,
          exitPrice,
          entry: parsePrice(trade.entry) ?? parsePrice(entryPrice),
          exit: parsePrice(trade.exit) ?? parsePrice(exitPrice),
          sl: typeof trade.sl === 'number' && Number.isFinite(trade.sl) && trade.sl > 0 ? trade.sl : undefined,
          tp: typeof trade.tp === 'number' && Number.isFinite(trade.tp) && trade.tp > 0 ? trade.tp : undefined,
          priceLevelsSource: trade.priceLevelsSource === 'ai' ? 'ai' : 'manual',
          priceLevelsEdited: trade.priceLevelsEdited === true,
          contracts,
          rr: typeof trade.rr === 'number' ? trade.rr : 0,
          pnl,
          result,
          screenshotUrl: typeof trade.screenshotUrl === 'string' ? trade.screenshotUrl : typeof trade.scannedImageUrl === 'string' ? trade.scannedImageUrl : undefined,
          reflection: tradeRef,
        };
        return withTradeDerivedValues(normalizedTrade);
      });

      const reflectionRaw = (record.reflection ?? {}) as Record<string, unknown>;
      const reflection = {
        pre: typeof reflectionRaw.pre === 'string' ? reflectionRaw.pre : '',
        post: typeof reflectionRaw.post === 'string' ? reflectionRaw.post : '',
        lessons: typeof reflectionRaw.lessons === 'string' ? reflectionRaw.lessons : '',
      };

      const rulesRaw = Array.isArray(record.rules) ? record.rules : [];
      const rules = rulesRaw.length
        ? rulesRaw.map(rule => {
          const valueRule = rule as Record<string, unknown>;
          const state: RuleState = valueRule.state === 'ok' || valueRule.state === 'fail' || valueRule.state === 'unchecked'
            ? valueRule.state
            : 'unchecked';
          return {
            text: typeof valueRule.text === 'string' ? valueRule.text : '',
            state,
          };
        }).filter(rule => rule.text)
        : rulesTemplate.map(text => ({ text, state: 'unchecked' as RuleState }));

      const psychologyRaw = (record.psychology ?? {}) as Record<string, unknown>;
      const psychology = {
        setupQuality: typeof psychologyRaw.setupQuality === 'number' ? psychologyRaw.setupQuality : 0,
        discipline: typeof psychologyRaw.discipline === 'number' ? psychologyRaw.discipline : 0,
        execution: typeof psychologyRaw.execution === 'number' ? psychologyRaw.execution : 0,
      };

      const emotionsRaw = Array.isArray(record.emotions) ? record.emotions : [];
      const emotionMap = new Map<string, EmotionState>();
      emotionsRaw.forEach(emotion => {
        const valueEmotion = emotion as Record<string, unknown>;
        if (typeof valueEmotion.label !== 'string') return;
        const state = valueEmotion.state === 'green' || valueEmotion.state === 'amber' || valueEmotion.state === 'red' || valueEmotion.state === 'neutral'
          ? valueEmotion.state
          : 'neutral';
        emotionMap.set(valueEmotion.label, state);
      });
      const emotions = TAGS.map(label => ({
        label,
        state: emotionMap.get(label) ?? 'neutral',
      }));

      const screenshotsRaw = Array.isArray(record.screenshots) ? record.screenshots : [];
      const screenshots = [0, 1, 2].map(index => typeof screenshotsRaw[index] === 'string' ? screenshotsRaw[index] : '');

      return {
        id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
        date,
        scannedImageUrl: typeof record.scannedImageUrl === 'string' ? record.scannedImageUrl : undefined,
        trades,
        screenshots,
        reflection,
        rules,
        psychology,
        emotions,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

interface PriceLevelsBlockProps {
  trade: JournalTrade;
  onMutate: (fields: Partial<JournalTrade>) => void;
}

interface ContractSizingBlockProps {
  trade: JournalTrade;
  onMutate: (fields: Partial<JournalTrade>) => void;
}

function ContractSizingBlock({ trade, onMutate }: ContractSizingBlockProps) {
  const [localContracts, setLocalContracts] = useState(String(Math.max(1, Math.round(trade.contracts || 1))));

  useEffect(() => {
    setLocalContracts(String(Math.max(1, Math.round(trade.contracts || 1))));
  }, [trade.id, trade.contracts]);

  const commitContracts = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const nextContracts = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    setLocalContracts(String(nextContracts));
    onMutate({ contracts: nextContracts });
  };

  const nudgeContracts = (delta: number) => {
    const parsed = Number.parseInt(localContracts, 10);
    const current = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    const next = Math.max(1, current + delta);
    setLocalContracts(String(next));
    onMutate({ contracts: next });
  };

  return (
    <div className="tj-size-card">
      <div className="tj-size-inline">
        <span className="tj-size-title">CONTRACT SIZING</span>
        <span className="tj-size-caption">Per trade</span>
      </div>
      <div className="tj-size-body">
        <button
          type="button"
          className="tj-size-btn"
          onClick={() => nudgeContracts(-1)}
          aria-label="Decrease contracts"
        >
          -
        </button>
        <input
          className="tj-size-input"
          type="number"
          min={1}
          step={1}
          value={localContracts}
          onChange={event => setLocalContracts(event.target.value)}
          onBlur={event => commitContracts(event.target.value)}
          aria-label="Contracts"
        />
        <button
          type="button"
          className="tj-size-btn"
          onClick={() => nudgeContracts(1)}
          aria-label="Increase contracts"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PriceLevelsBlock({ trade, onMutate }: PriceLevelsBlockProps) {
  const entry = getTradeEntry(trade);
  const exit = getTradeExit(trade);
  const [local, setLocal] = useState({
    entry: entry !== undefined ? String(entry) : '',
    exit: exit !== undefined ? String(exit) : '',
    sl: trade.sl != null ? String(trade.sl) : '',
    tp: trade.tp != null ? String(trade.tp) : '',
  });

  useEffect(() => {
    setLocal({
      entry: getTradeEntry(trade) !== undefined ? String(getTradeEntry(trade)) : '',
      exit: getTradeExit(trade) !== undefined ? String(getTradeExit(trade)) : '',
      sl: trade.sl != null ? String(trade.sl) : '',
      tp: trade.tp != null ? String(trade.tp) : '',
    });
  }, [trade.id, trade.entry, trade.entryPrice, trade.exit, trade.exitPrice, trade.sl, trade.tp]);

  const parseLocal = (value: string): number | undefined => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const entryValue = parseLocal(local.entry);
  const exitValue = parseLocal(local.exit);
  const slValue = parseLocal(local.sl);
  const tpValue = parseLocal(local.tp);

  const commit = (field: 'entry' | 'exit' | 'sl' | 'tp', value: string) => {
    const parsed = parseLocal(value);
    const nextFields: Partial<JournalTrade> = {
      priceLevelsSource: 'manual',
      priceLevelsEdited: true,
    };
    if (field === 'entry') {
      nextFields.entry = parsed;
      nextFields.entryPrice = parsed ?? 0;
    } else if (field === 'exit') {
      nextFields.exit = parsed;
      nextFields.exitPrice = parsed ?? 0;
    } else if (field === 'sl') {
      nextFields.sl = parsed;
    } else {
      nextFields.tp = parsed;
    }
    onMutate(nextFields);
  };

  const pointValue = lookupContract(trade.symbol)?.point_value ?? 1;
  const contracts = trade.contracts > 0 ? trade.contracts : 1;

  const stopDelta = entryValue !== undefined && slValue !== undefined ? Math.abs(slValue - entryValue) : null;
  const tpDelta = entryValue !== undefined && tpValue !== undefined ? Math.abs(tpValue - entryValue) : null;
  const exitDelta = entryValue !== undefined && exitValue !== undefined ? exitValue - entryValue : null;

  const netPnl = entryValue !== undefined && exitValue !== undefined
    ? trade.direction === 'LONG'
      ? (exitValue - entryValue) * contracts * pointValue
      : (entryValue - exitValue) * contracts * pointValue
    : null;

  const rr = (() => {
    if (entryValue === undefined || slValue === undefined || tpValue === undefined) return null;
    const risk = trade.direction === 'LONG' ? entryValue - slValue : slValue - entryValue;
    const reward = trade.direction === 'LONG' ? tpValue - entryValue : entryValue - tpValue;
    if (risk <= 0 || reward <= 0) return null;
    return reward / risk;
  })();

  const result = (() => {
    if (exitValue === undefined) return 'OPEN';
    if (entryValue === undefined || slValue === undefined || tpValue === undefined) return 'PARTIAL';
    if (trade.direction === 'LONG') {
      if (exitValue >= tpValue) return 'WIN';
      if (exitValue <= slValue) return 'LOSS';
      return 'PARTIAL';
    }
    if (exitValue <= tpValue) return 'WIN';
    if (exitValue >= slValue) return 'LOSS';
    return 'PARTIAL';
  })();

  const sourceText = trade.priceLevelsEdited ? 'Manually set' : trade.priceLevelsSource === 'ai' ? 'AI extracted' : 'Manually set';

  return (
    <div className="tj-pl-card">
      <div className="tj-pl-header">
        <span className="tj-pl-title">PRICE LEVELS</span>
        <span className="tj-pl-source">{sourceText}</span>
      </div>
      <div className="tj-pl-grid">
        <div className="tj-pl-cell">
          <div className="tj-pl-label">ENTRY</div>
          <input
            className="tj-pl-input entry"
            type="number"
            step="0.25"
            value={local.entry}
            onChange={event => setLocal(prev => ({ ...prev, entry: event.target.value }))}
            onBlur={event => commit('entry', event.target.value)}
            placeholder="-"
          />
          <div className="tj-pl-diff">Reference</div>
        </div>
        <div className="tj-pl-cell">
          <div className="tj-pl-label">STOP LOSS</div>
          <input
            className="tj-pl-input sl"
            type="number"
            step="0.25"
            value={local.sl}
            onChange={event => setLocal(prev => ({ ...prev, sl: event.target.value }))}
            onBlur={event => commit('sl', event.target.value)}
            placeholder="-"
          />
          <div className="tj-pl-diff neg">{stopDelta === null ? '-' : `-${stopDelta.toFixed(2)} pts`}</div>
        </div>
        <div className="tj-pl-cell">
          <div className="tj-pl-label">TAKE PROFIT</div>
          <input
            className="tj-pl-input tp"
            type="number"
            step="0.25"
            value={local.tp}
            onChange={event => setLocal(prev => ({ ...prev, tp: event.target.value }))}
            onBlur={event => commit('tp', event.target.value)}
            placeholder="-"
          />
          <div className="tj-pl-diff pos">{tpDelta === null ? '-' : `+${tpDelta.toFixed(2)} pts`}</div>
        </div>
        <div className="tj-pl-cell">
          <div className="tj-pl-label">EXIT</div>
          <input
            className="tj-pl-input exit"
            type="number"
            step="0.25"
            value={local.exit}
            onChange={event => setLocal(prev => ({ ...prev, exit: event.target.value }))}
            onBlur={event => commit('exit', event.target.value)}
            placeholder="-"
          />
          <div className={`tj-pl-diff ${exitDelta !== null && exitDelta >= 0 ? 'pos' : exitDelta !== null ? 'neg' : ''}`}>
            {exitDelta === null ? '-' : `${exitDelta >= 0 ? '+' : '-'}${Math.abs(exitDelta).toFixed(2)} pts`}
          </div>
        </div>
      </div>
      <div className="tj-pl-summary">
        <div className="tj-pl-summary-block">
          <div className="tj-pl-summary-label">NET P&amp;L</div>
          <div className={`tj-pl-summary-value ${netPnl !== null && netPnl > 0 ? 'pos' : netPnl !== null && netPnl < 0 ? 'neg' : ''}`}>
            {netPnl === null ? '-' : formatCurrencyFixed(netPnl)}
          </div>
        </div>
        <div className="tj-pl-summary-block">
          <div className="tj-pl-summary-label">R:R</div>
          <div className={`tj-pl-summary-rr ${rr !== null && rr >= 2 ? 'pos' : rr !== null && rr >= 1 ? 'amber' : rr !== null ? 'neg' : ''}`}>
            {rr === null ? '-' : `${rr.toFixed(2)}R`}
          </div>
        </div>
        <div className="tj-pl-summary-block end">
          <div className="tj-pl-summary-label">RESULT</div>
          <span className={`tj-pl-result ${result.toLowerCase()}`}>{result}</span>
        </div>
      </div>
    </div>
  );
}

interface TradeReflectionBlockProps {
  trade: JournalTrade;
  onMutate: (fields: Partial<JournalTrade>) => void;
  onRuleForce: (ruleText: string, state: RuleState) => void;
}

function TradeReflectionBlock({ trade, onMutate, onRuleForce }: TradeReflectionBlockProps) {
  const [local, setLocal] = useState({
    thesis: trade.reflection?.thesis ?? '',
    execution: trade.reflection?.execution ?? '',
    adjustment: trade.reflection?.adjustment ?? '',
  });

  useEffect(() => {
    setLocal({
      thesis: trade.reflection?.thesis ?? '',
      execution: trade.reflection?.execution ?? '',
      adjustment: trade.reflection?.adjustment ?? '',
    });
  }, [trade.id, trade.reflection?.thesis, trade.reflection?.execution, trade.reflection?.adjustment]);

  const currentRef = (): NonNullable<JournalTrade['reflection']> => ({
    thesis: local.thesis,
    execution: local.execution,
    adjustment: local.adjustment,
    processGrade: trade.reflection?.processGrade ?? 0,
    followedPlan: trade.reflection?.followedPlan ?? null,
  });

  const commitText = (field: 'thesis' | 'execution' | 'adjustment', value: string) => {
    onMutate({ reflection: { ...currentRef(), [field]: value } });
  };

  const setProcessGrade = (value: number) => {
    onMutate({ reflection: { ...currentRef(), processGrade: value } });
  };

  const setFollowedPlan = (value: boolean | null) => {
    onMutate({ reflection: { ...currentRef(), followedPlan: value } });
    if (value === false) onRuleForce('Only traded A/B setups', 'fail');
  };

  const processGrade = trade.reflection?.processGrade ?? 0;
  const followedPlan = trade.reflection?.followedPlan ?? null;

  const wordCount = `${local.thesis} ${local.execution} ${local.adjustment}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;

  const TEXTAREA_ROWS: Array<{
    key: 'thesis' | 'execution' | 'adjustment';
    title: string;
    sub: string;
    placeholder: string;
  }> = [
    {
      key: 'thesis',
      title: 'Setup Thesis',
      sub: 'What edge did you see?',
      placeholder: 'Describe the setup - what made this worth taking? What confluence did you have?',
    },
    {
      key: 'execution',
      title: 'Execution',
      sub: 'How did you execute?',
      placeholder: 'Did you enter exactly at your level? Any hesitation? Did you follow the plan?',
    },
    {
      key: 'adjustment',
      title: "What I'd do differently",
      sub: 'The adjustment',
      placeholder: 'If you took this trade again tomorrow, what single thing would you change?',
    },
  ];

  const gradeLabel = processGrade === 1 ? 'Poor'
    : processGrade === 2 ? 'Below avg'
    : processGrade === 3 ? 'Average'
    : processGrade === 4 ? 'Good'
    : processGrade === 5 ? 'Excellent'
    : '';

  return (
    <div className="tj-tr-card">
      <div className="tj-tr-header">
        <span className="tj-tr-title">TRADE REFLECTION</span>
        <span className="tj-tr-word-count">{wordCount} words</span>
      </div>
      <div className="tj-tr-grid">
        {TEXTAREA_ROWS.map(row => (
          <div key={row.key} className="tj-tr-col">
            <div className="tj-tr-col-head">
              <div className="tj-tr-col-title">{row.title}</div>
              <div className="tj-tr-col-sub">{row.sub}</div>
            </div>
            <textarea
              className="tj-tr-textarea"
              value={local[row.key]}
              onChange={e => setLocal(prev => ({ ...prev, [row.key]: e.target.value }))}
              onBlur={e => commitText(row.key, e.target.value)}
              placeholder={row.placeholder}
            />
          </div>
        ))}
      </div>
      <div className="tj-tr-process-row">
        <div className="tj-tr-process-copy">
          <div className="tj-tr-process-label">PROCESS GRADE</div>
          <div className="tj-tr-process-sub">Rate the quality of this trade, not the P&amp;L</div>
        </div>
        <div className="tj-tr-grade-buttons">
          {[1, 2, 3, 4, 5].map(v => (
            <button
              key={v}
              type="button"
              className={`tj-tr-grade-btn ${processGrade >= v ? 'active' : ''}`}
              onClick={() => setProcessGrade(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="tj-tr-grade-readout">
          <div className="tj-tr-grade-number">{processGrade > 0 ? processGrade : '-'}</div>
          <div className="tj-tr-grade-label">{gradeLabel}</div>
        </div>
      </div>
      <div className="tj-tr-plan-row">
        <div>
          <div className="tj-tr-plan-title">Followed trading plan?</div>
          <div className="tj-tr-plan-sub">Did this trade match your rules?</div>
        </div>
        <div className="tj-tr-plan-toggle">
          <button
            type="button"
            className={`tj-tr-plan-btn ${followedPlan === true ? 'yes' : ''}`}
            onClick={() => setFollowedPlan(true)}
          >YES</button>
          <button
            type="button"
            className={`tj-tr-plan-btn ${followedPlan === false ? 'no' : ''}`}
            onClick={() => setFollowedPlan(false)}
          >NO</button>
        </div>
      </div>
    </div>
  );
}

export default function TradeJournal() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { preferences } = useAppSettings();
  const { deleteTrade: deleteTradeEverywhere } = useTrades();
  const persistedEntries = useFlyxaStore(state => state.entries);
  const setEntriesInStore = useFlyxaStore(state => state.setEntries);
  const rulesTemplate = useMemo(() => getRulesTemplate(), []);
  const entries = useMemo(() => normalizeEntries(persistedEntries, rulesTemplate), [persistedEntries, rulesTemplate]);

  const [monthCursor, setMonthCursor] = useState(() => {
    const today = parseDate(getTodayIso());
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const [query, setQuery] = useState('');
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanPreviewUrl, setScanPreviewUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTradeId, setDeleteTradeId] = useState<string | null>(null);
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState(false);
  const [isScreenshotFullscreen, setIsScreenshotFullscreen] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const screenshotSlotRef = useRef<number | null>(null);
  const tabRootRef = useRef<HTMLDivElement>(null);

  const mutateEntries = useCallback((updater: (prev: JournalEntry[]) => JournalEntry[]) => {
    const current = normalizeEntries(useFlyxaStore.getState().entries as unknown[], rulesTemplate);
    const next = updater(current);
    setEntriesInStore(next as unknown as StoreJournalEntry[]);
  }, [rulesTemplate, setEntriesInStore]);

  const mutateTradeFields = useCallback((tradeId: string, fields: Partial<JournalTrade>) => {
    if (!selectedEntryId) return;
    mutateEntries(prev => prev.map(entry => {
      if (entry.id !== selectedEntryId) return entry;
      return {
        ...entry,
        trades: entry.trades.map(trade => {
          if (trade.id !== tradeId) return trade;
          return withTradeDerivedValues({ ...trade, ...fields });
        }),
      };
    }));
  }, [mutateEntries, selectedEntryId]);

  const forceEntryRule = useCallback((ruleText: string, state: RuleState) => {
    if (!selectedEntryId) return;
    mutateEntries(prev => prev.map(entry => {
      if (entry.id !== selectedEntryId) return entry;
      return { ...entry, rules: entry.rules.map(rule => rule.text === ruleText ? { ...rule, state } : rule) };
    }));
  }, [mutateEntries, selectedEntryId]);

  useEffect(() => {
    if (!entries.length) {
      setSelectedEntryId(null);
      return;
    }
    if (!selectedEntryId || !entries.some(entry => entry.id === selectedEntryId)) {
      setSelectedEntryId(entries[0].id);
    }
  }, [entries, selectedEntryId]);

  useEffect(() => {
    const date = params.get('date');
    const tradeId = params.get('tradeId');
    if (!date) return;
    const targetEntry = entries.find(entry => entry.date === date);
    if (!targetEntry) return;
    setSelectedEntryId(targetEntry.id);
    if (tradeId) setActiveTradeId(tradeId);
  }, [entries, params]);

  useEffect(() => {
    const currentSelected = entries.find(entry => entry.id === selectedEntryId) ?? null;
    if (!currentSelected || !currentSelected.trades.length) {
      setActiveTradeId(null);
      return;
    }
    if (!activeTradeId || !currentSelected.trades.some(trade => trade.id === activeTradeId)) {
      setActiveTradeId(currentSelected.trades[0].id);
    }
  }, [activeTradeId, entries, selectedEntryId]);

  const entriesInMonth = useMemo(
    () => entries.filter(entry => inMonth(entry.date, monthCursor)),
    [entries, monthCursor],
  );

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entriesInMonth
      .filter(entry => {
        const stats = computeEntryStats(entry);
        if (dayFilter === 'win' && stats.pnl <= 0) return false;
        if (dayFilter === 'loss' && stats.pnl >= 0) return false;
        if (dayFilter === 'untagged' && entry.emotions.some(emotion => emotion.state !== 'neutral')) return false;
        if (!needle) return true;
        const symbolMatch = entry.trades.some(trade => trade.symbol.toLowerCase().includes(needle));
        const noteMatch = `${entry.reflection.pre} ${entry.reflection.post} ${entry.reflection.lessons}`.toLowerCase().includes(needle);
        return symbolMatch || noteMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dayFilter, entriesInMonth, query]);

  const selectedEntry = useMemo(
    () => entries.find(entry => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const activeTrade = useMemo(() => {
    if (!selectedEntry || !selectedEntry.trades.length) return null;
    return selectedEntry.trades.find(trade => trade.id === activeTradeId) ?? selectedEntry.trades[0];
  }, [activeTradeId, selectedEntry]);

  const monthSummary = useMemo(() => {
    const dayPnL = entriesInMonth.map(entry => computeEntryStats(entry).pnl);
    const monthPnl = dayPnL.reduce((sum, pnl) => sum + pnl, 0);
    const daysTraded = entriesInMonth.filter(entry => entry.trades.length > 0).length;
    let wins = 0;
    let losses = 0;
    entriesInMonth.forEach(entry => {
      const stats = computeEntryStats(entry);
      wins += stats.wins;
      losses += stats.losses;
    });
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    const bestDay = findBestDay(entriesInMonth);
    return { monthPnl, daysTraded, winRate, bestDay };
  }, [entriesInMonth]);

  const addBlankDay = useCallback(() => {
    const date = selectedEntry?.date ?? getTodayIso();
    const existing = entries.find(entry => entry.date === date);
    if (existing) {
      setSelectedEntryId(existing.id);
      return;
    }
    const blank = createEmptyEntry(date, rulesTemplate);
    mutateEntries(prev => [blank, ...prev]);
    setSelectedEntryId(blank.id);
  }, [entries, mutateEntries, rulesTemplate, selectedEntry?.date]);

  const goToScanner = useCallback(() => {
    setShowScanner(true);
    navigate('/scanner');
  }, [navigate]);

  const addManualTrade = useCallback(() => {
    if (!selectedEntry) return;
    const basePrice = 0;
    const newTrade: JournalTrade = {
      id: crypto.randomUUID(),
      symbol: 'NQ',
      direction: 'LONG',
      entryTime: getNowTime(),
      exitTime: getNowTime(),
      durationMinutes: null,
      entryPrice: basePrice,
      exitPrice: basePrice,
      entry: undefined,
      exit: undefined,
      priceLevelsSource: 'manual',
      priceLevelsEdited: false,
      contracts: 1,
      rr: 0,
      pnl: 0,
      result: 'open',
    };
    mutateEntries(prev => prev.map(entry => entry.id === selectedEntry.id ? { ...entry, trades: [withTradeDerivedValues(newTrade), ...entry.trades] } : entry));
  }, [mutateEntries, selectedEntry]);

  const applyScannedTrade = useCallback((fileDataUrl: string, trade: JournalTrade, date: string) => {
    let nextSelectedId: string | null = null;
    mutateEntries(prev => {
      const existing = prev.find(entry => entry.id === selectedEntryId) ?? prev.find(entry => entry.date === date);
      if (existing) {
        nextSelectedId = existing.id;
        return prev.map(entry => {
          if (entry.id !== existing.id) return entry;
          const shots = [...entry.screenshots];
          if (!shots[0]) shots[0] = fileDataUrl;
          return {
            ...entry,
            scannedImageUrl: fileDataUrl,
            screenshots: shots,
            trades: [trade, ...entry.trades],
          };
        });
      }
      const created = createEmptyEntry(date, rulesTemplate);
      created.scannedImageUrl = fileDataUrl;
      created.screenshots[0] = fileDataUrl;
      created.trades = [trade];
      nextSelectedId = created.id;
      return [created, ...prev];
    });
    if (nextSelectedId) {
      setSelectedEntryId(nextSelectedId);
    }
    const scannedMonth = parseDate(date);
    setMonthCursor(new Date(scannedMonth.getFullYear(), scannedMonth.getMonth(), 1));
    setActiveTradeId(trade.id);
  }, [mutateEntries, rulesTemplate, selectedEntryId, setMonthCursor]);

  const handleScanFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setScanError('Upload an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanError('File is larger than 10MB.');
      return;
    }

    setScanError('');
    setIsScanning(true);
    const tradeDate = selectedEntry?.date ?? getTodayIso();
    const tradeTime = getNowTime();
    let scanSucceeded = false;

    try {
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      setScanPreviewUrl(fileDataUrl);

      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const colors = preferences.scannerColors;
      const context = {
        ...(scannerContext ?? {}),
        scanner_colors: {
          entryZone: { hex: colors?.entry ?? '#E67E22' },
          supplyStopZone: { hex: colors?.stopLoss ?? '#C0392B' },
          targetDemandZone: { hex: colors?.takeProfit ?? '#1A6B5A' },
        },
      };
      const extracted = await scanChart(uploadImage, tradeDate, tradeTime, focusImages, context);

      const normalizedSymbol = normalizeResolvedSymbol(extracted.symbol) ?? inferSymbolFromFileName(file.name) ?? 'NQ';
      const direction: TradeDirection = extracted.direction === 'Short' ? 'SHORT' : 'LONG';
      const scannerEntry = parsePrice(extracted.entry_price ?? undefined);
      const scannerTp = parsePrice(extracted.tp_price ?? undefined);
      const scannerSl = parsePrice(extracted.sl_price ?? undefined);
      if (scannerEntry === undefined || scannerTp === undefined || scannerSl === undefined) {
        const warningSuffix = Array.isArray(extracted.warnings) && extracted.warnings.length > 0
          ? ` ${extracted.warnings[0]}`
          : '';
        throw new Error(`Scanner could not read entry/stop/target from this chart.${warningSuffix}`);
      }
      const scannerExit = extracted.exit_reason === 'SL' ? scannerSl : extracted.exit_reason === 'TP' ? scannerTp : undefined;
      const entryPrice = scannerEntry ?? 0;
      const exitPrice = scannerExit ?? 0;
      const entryTime = typeof extracted.entry_time === 'string' ? extracted.entry_time.slice(0, 5) : tradeTime;
      const closeTime = typeof extracted.close_time === 'string'
        ? extracted.close_time.slice(0, 5)
        : addSecondsToTime(entryTime, extracted.trade_length_seconds ?? null) ?? entryTime;
      const durationFromSeconds = typeof extracted.trade_length_seconds === 'number'
        ? Math.max(1, Math.round(extracted.trade_length_seconds / 60))
        : null;
      const durationFromTimeRange = minutesBetweenTimes(entryTime, closeTime);
      const durationMinutes = durationFromSeconds ?? durationFromTimeRange;

      const trade: JournalTrade = {
        id: crypto.randomUUID(),
        symbol: normalizedSymbol,
        direction,
        entryTime,
        exitTime: closeTime,
        durationMinutes,
        entryPrice,
        exitPrice,
        entry: scannerEntry,
        exit: scannerExit,
        sl: scannerSl,
        tp: scannerTp,
        priceLevelsSource: 'ai',
        priceLevelsEdited: false,
        contracts: 1,
        rr: 0,
        pnl: 0,
        result: 'open',
        screenshotUrl: fileDataUrl,
      };

      applyScannedTrade(fileDataUrl, withTradeDerivedValues(trade), tradeDate);
      scanSucceeded = true;
      pushToast({ tone: 'green', durationMs: 3000, message: 'Trade scanned and saved' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed.';
      const lowered = message.toLowerCase();
      if (lowered.includes('503') || lowered.includes('high demand') || lowered.includes('service unavailable')) {
        setScanError('Scanner AI is temporarily busy. Please retry in 10-20 seconds.');
      } else if (lowered.includes('failed to fetch')) {
        setScanError('Could not reach the scanner service. Check that backend is running on http://localhost:3001, then scan again.');
      } else {
        setScanError(message);
      }
    } finally {
      setIsScanning(false);
      if (scanSucceeded) {
        setScanPreviewUrl('');
      }
    }
  }, [applyScannedTrade, preferences.scannerColors, selectedEntry?.date]);

  const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleScanFile(file);
  }, [handleScanFile]);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const updateReflection = useCallback((field: 'pre' | 'post' | 'lessons', value: string) => {
    if (!selectedEntry) return;
    mutateEntries(prev => prev.map(entry => {
      if (entry.id !== selectedEntry.id) return entry;
      return {
        ...entry,
        reflection: {
          ...entry.reflection,
          [field]: value,
        },
      };
    }));
  }, [mutateEntries, selectedEntry]);

  useEffect(() => {
    const root = tabRootRef.current;
    if (!root) return;

    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.tj-tab'));
    const panes = Array.from(root.querySelectorAll<HTMLElement>('.tj-pane'));
    const activate = (tabKey: string) => {
      tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabKey));
      panes.forEach(pane => pane.classList.toggle('active', pane.dataset.pane === tabKey));
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const tab = target.closest<HTMLButtonElement>('.tj-tab');
      if (!tab?.dataset.tab) return;
      activate(tab.dataset.tab);
    };

    root.addEventListener('click', onClick);
    activate('pre');
    return () => root.removeEventListener('click', onClick);
  }, [selectedEntryId]);

  const deleteEntry = useCallback(() => {
    if (!selectedEntry) return;
    mutateEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
    setDeleteEntryConfirm(false);
  }, [mutateEntries, selectedEntry]);

  const onShotPick = useCallback((index: number) => {
    screenshotSlotRef.current = index;
    screenshotInputRef.current?.click();
  }, []);

  const onShotFile = useCallback(async (file: File) => {
    if (!selectedEntry) return;
    const slot = screenshotSlotRef.current;
    if (slot === null) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read screenshot.'));
      reader.readAsDataURL(file);
    });
    mutateEntries(prev => prev.map(entry => {
      if (entry.id !== selectedEntry.id) return entry;
      const nextScreenshots = [...entry.screenshots];
      nextScreenshots[slot] = dataUrl;
      return { ...entry, screenshots: nextScreenshots };
    }));
    screenshotSlotRef.current = null;
  }, [mutateEntries, selectedEntry]);

  const primaryScreenshot = selectedEntry
    ? (selectedEntry.screenshots[0] || selectedEntry.scannedImageUrl || activeTrade?.screenshotUrl || '')
    : '';

  return (
    <div className="tj-shell">
      <input
        ref={scanInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void handleScanFile(file);
          event.target.value = '';
        }}
      />
      <input
        ref={screenshotInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void onShotFile(file);
          event.target.value = '';
        }}
      />

      <aside className="tj-day-panel">
        <div className="tj-day-header">
          <div className="tj-day-top">
            <p className="tj-month-title">{formatMonth(monthCursor)}</p>
            <span className="tj-nav-group">
              <button type="button" className="tj-nav" onClick={() => setMonthCursor(prev => shiftMonth(prev, -1))}>
                <ChevronLeft size={13} />
              </button>
              <button type="button" className="tj-nav" onClick={() => setMonthCursor(prev => shiftMonth(prev, 1))}>
                <ChevronRight size={13} />
              </button>
            </span>
          </div>

          <div className="tj-month-grid">
            <div className="tj-month-cell">
              <div className="tj-month-label">Month P&amp;L</div>
              <div className={`tj-month-value ${monthSummary.monthPnl > 0 ? 'pos' : monthSummary.monthPnl < 0 ? 'neg' : 'zero'}`}>
                {formatSignedCurrency(monthSummary.monthPnl)}
              </div>
            </div>
            <div className="tj-month-cell">
              <div className="tj-month-label">Win Rate</div>
              <div className="tj-month-value">{toPercent(monthSummary.winRate)}</div>
            </div>
            <div className="tj-month-cell">
              <div className="tj-month-label">Days Traded</div>
              <div className="tj-month-value">{monthSummary.daysTraded}</div>
            </div>
            <div className="tj-month-cell">
              <div className="tj-month-label">Best Day</div>
              <div className={`tj-month-value ${(monthSummary.bestDay ?? 0) > 0 ? 'pos' : 'zero'}`}>
                {monthSummary.bestDay === null ? '--' : formatSignedCurrency(monthSummary.bestDay)}
              </div>
            </div>
          </div>
        </div>

        <div className="tj-search-row">
          <Search size={13} color="var(--txt-3)" />
          <input
            className="tj-search-input"
            placeholder="Search entries..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>

        <div className="tj-chip-row">
          {[
            { key: 'all', label: 'All' },
            { key: 'win', label: 'Win days' },
            { key: 'loss', label: 'Loss days' },
            { key: 'untagged', label: 'Untagged' },
          ].map(chip => (
            <button
              key={chip.key}
              type="button"
              className={`tj-chip ${dayFilter === chip.key ? 'sel' : ''}`}
              onClick={() => setDayFilter(chip.key as DayFilter)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="tj-day-list">
          {visibleEntries.length ? (
            visibleEntries.map(entry => {
              const stats = computeEntryStats(entry);
              const day = parseDate(entry.date).getDate();
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`tj-day-item ${selectedEntryId === entry.id ? 'active' : ''}`}
                  onClick={() => { setSelectedEntryId(entry.id); setShowScanner(false); }}
                >
                  <div className="tj-date-col">
                    <div className="tj-day-num">{day}</div>
                    <div className="tj-weekday">{formatWeekday(entry.date)}</div>
                  </div>
                  <div className="tj-day-body">
                    <div className={`tj-day-pnl ${stats.pnl > 0 ? 'pos' : stats.pnl < 0 ? 'neg' : ''}`}>{formatSignedCurrency(stats.pnl)}</div>
                    <div className="tj-day-meta">{`${stats.wins}W | ${stats.losses}L | ${stats.tradeCount} trades`}</div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="tj-day-empty">
              <div className="tj-day-empty-box">
                <div className="tj-day-empty-icon"><FileText size={16} /></div>
                <p className="tj-day-empty-title">No entries yet</p>
                <p className="tj-day-empty-sub">Log your first trade below.</p>
                <button type="button" className="tj-day-empty-btn" onClick={goToScanner}>
                  <Plus size={11} />
                  Log Trade
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="tj-entry-panel">
        {!showScanner && selectedEntry && selectedEntry.trades.length > 0 ? (
          <>
            <div className="tj-sticky-head">
              <div>
                <p className="tj-entry-title">{formatDateTitle(selectedEntry.date)}</p>
                <p className="tj-entry-sub">
                  Apex Funded | Live | <strong>{formatSignedCurrency(computeEntryStats(selectedEntry).pnl)}</strong> | Grade {computeEntryStats(selectedEntry).grade}
                </p>
              </div>
              <div className="tj-head-actions">
                {deleteEntryConfirm ? (
                  <>
                    <span className="tj-delete-text">Delete this day?</span>
                    <button type="button" className="tj-mini-btn" onClick={() => setDeleteEntryConfirm(false)}>Cancel</button>
                    <button type="button" className="tj-mini-btn red" onClick={deleteEntry}>Delete</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="tj-btn-ghost" onClick={() => setDeleteEntryConfirm(true)}>
                      <Trash2 size={13} />
                      Delete
                    </button>
                    <button type="button" className="tj-btn-primary tj-btn-save" onClick={goToScanner}>
                      <Plus size={13} />
                      Log trade
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="tj-entry-body">
              <div className="tj-stats">
                <div className="tj-stat">
                  <div className="tj-stat-label">Net P&amp;L</div>
                  <div className={`tj-stat-value ${computeEntryStats(selectedEntry).pnl > 0 ? 'pos' : computeEntryStats(selectedEntry).pnl < 0 ? 'neg' : ''}`}>
                    {formatSignedCurrency(computeEntryStats(selectedEntry).pnl)}
                  </div>
                </div>
                <div className="tj-stat">
                  <div className="tj-stat-label">Win Rate</div>
                  <div className="tj-stat-value">{toPercent(computeEntryStats(selectedEntry).winRate)}</div>
                </div>
                <div className="tj-stat">
                  <div className="tj-stat-label">Avg R:R</div>
                  <div className="tj-stat-value">{toR(computeEntryStats(selectedEntry).avgRR)}</div>
                </div>
                <div className="tj-stat">
                  <div className="tj-stat-label">Trades</div>
                  <div className="tj-stat-value">{computeEntryStats(selectedEntry).tradeCount}</div>
                </div>
                <div className="tj-stat">
                  <div className="tj-stat-label">Trade Length</div>
                  <div className="tj-stat-value">{formatDurationLabel(activeTrade?.durationMinutes)}</div>
                </div>
                <div className="tj-stat">
                  <div className="tj-stat-label">Entry Time</div>
                  <div className="tj-stat-value">{activeTrade?.entryTime || '--:--'}</div>
                </div>
              </div>

              <div className="tj-section-head first">
                <span className="tj-section-title">Screenshot</span>
              </div>
              <button type="button" className="tj-shot tj-shot-single" onClick={() => onShotPick(0)}>
                {primaryScreenshot ? (
                  <>
                    <img src={primaryScreenshot} alt="Trade chart" />
                    <span className="tj-shot-controls">
                      <button
                        type="button"
                        className="tj-shot-control-btn"
                        onClick={event => {
                          event.stopPropagation();
                          setIsScreenshotFullscreen(true);
                        }}
                        aria-label="Open screenshot fullscreen"
                      >
                        <Maximize2 size={14} />
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={18} />
                    <span className="tj-shot-label">Add chart</span>
                  </>
                )}
              </button>

              <div className="tj-section-head">
                <span className="tj-section-title">Trades</span>
                <button type="button" className="tj-section-action" onClick={addManualTrade}>Add trade</button>
              </div>
              <div className="tj-trade-list">
                {selectedEntry.trades.map(trade => (
                  deleteTradeId === trade.id ? (
                    <div key={trade.id} className="tj-delete-row">
                      <span className="tj-delete-text">Delete this trade?</span>
                      <span className="tj-delete-actions">
                        <button type="button" className="tj-mini-btn" onClick={() => setDeleteTradeId(null)}>Cancel</button>
                        <button
                          type="button"
                          className="tj-mini-btn red"
                          onClick={() => {
                            void deleteTradeEverywhere(trade.id);
                            setDeleteTradeId(null);
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div key={trade.id} className={`tj-trade-card ${trade.result}${activeTradeId === trade.id ? ' active' : ''}`} onClick={() => setActiveTradeId(trade.id)}>
                      <span className="tj-symbol">{trade.symbol}</span>
                      <span className={`tj-tc-badge ${trade.direction === 'LONG' ? 'b-long' : 'b-short'}`}>{trade.direction === 'LONG' ? 'LONG' : 'SHORT'}</span>
                      <button type="button" className="tj-trash-btn" onClick={e => { e.stopPropagation(); setDeleteTradeId(trade.id); }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                ))}
              </div>

              {activeTrade && (
                <>
                  <div className="tj-section-head">
                    <span className="tj-section-title">Contract Sizing</span>
                  </div>
                  <ContractSizingBlock
                    trade={activeTrade}
                    onMutate={fields => mutateTradeFields(activeTrade.id, fields)}
                  />
                </>
              )}

              {activeTrade && (
                <PriceLevelsBlock
                  trade={activeTrade}
                  onMutate={fields => mutateTradeFields(activeTrade.id, fields)}
                />
              )}

              <div className="tj-section-head">
                <span className="tj-section-title">Reflection</span>
              </div>
              <div className="tj-card" ref={tabRootRef}>
                <div className="tj-tabs">
                  <button type="button" className="tj-tab" data-tab="pre">Pre-market</button>
                  <button type="button" className="tj-tab" data-tab="post">Post-session</button>
                  <button type="button" className="tj-tab" data-tab="lessons">Lessons</button>
                </div>
                <div className="tj-pane" data-pane="pre">
                  <textarea
                    className="tj-reflect"
                    value={selectedEntry.reflection.pre}
                    onChange={event => updateReflection('pre', event.target.value)}
                    placeholder="Game plan, key levels, bias, setups you're watching..."
                  />
                </div>
                <div className="tj-pane" data-pane="post">
                  <textarea
                    className="tj-reflect"
                    value={selectedEntry.reflection.post}
                    onChange={event => updateReflection('post', event.target.value)}
                    placeholder="How did the session go? What happened vs your plan?"
                  />
                </div>
                <div className="tj-pane" data-pane="lessons">
                  <textarea
                    className="tj-reflect"
                    value={selectedEntry.reflection.lessons}
                    onChange={event => updateReflection('lessons', event.target.value)}
                    placeholder="What did you learn? What would you do differently?"
                  />
                </div>
              </div>

              <div className="tj-section-head">
                <span className="tj-section-title">Rule Checklist</span>
              </div>
              <div className="tj-card">
                {selectedEntry.rules.map((rule, index) => (
                  <div
                    key={`${rule.text}-${index}`}
                    className="tj-rule-row"
                    onClick={() => {
                      mutateEntries(prev => prev.map(entry => {
                        if (entry.id !== selectedEntry.id) return entry;
                        const nextRules = [...entry.rules];
                        nextRules[index] = { ...nextRules[index], state: cycleRuleState(nextRules[index].state) };
                        return { ...entry, rules: nextRules };
                      }));
                    }}
                  >
                    <span className={`tj-rule-box ${rule.state === 'ok' ? 'ok' : rule.state === 'fail' ? 'fail' : ''}`}>
                      {rule.state === 'ok' && <Check size={10} />}
                      {rule.state === 'fail' && <X size={10} />}
                    </span>
                    <span className={`tj-rule-text ${rule.state === 'ok' ? 'ok' : rule.state === 'fail' ? 'fail' : ''}`}>{rule.text}</span>
                  </div>
                ))}
              </div>

              {activeTrade && (
                <TradeReflectionBlock
                  trade={activeTrade}
                  onMutate={fields => mutateTradeFields(activeTrade.id, fields)}
                  onRuleForce={forceEntryRule}
                />
              )}

              <div className="tj-section-head">
                <span className="tj-section-title">Psychology</span>
              </div>
              <div className="tj-psy-grid">
                {[
                  { key: 'setupQuality' as const, label: 'Setup Quality', tone: 'g' as const },
                  { key: 'discipline' as const, label: 'Discipline', tone: 'a' as const },
                  { key: 'execution' as const, label: 'Execution', tone: 'r' as const },
                ].map(card => {
                  const score = selectedEntry.psychology[card.key];
                  return (
                    <div key={card.key} className="tj-psy-card">
                      <div className="tj-psy-label">{card.label}</div>
                      <div className="tj-pips">
                        {[1, 2, 3, 4, 5].map(value => (
                          <button
                            key={value}
                            type="button"
                            className={`tj-pip ${card.tone} ${score >= value ? 'filled' : ''}`}
                            onClick={() => {
                              mutateEntries(prev => prev.map(entry => {
                                if (entry.id !== selectedEntry.id) return entry;
                                return {
                                  ...entry,
                                  psychology: {
                                    ...entry.psychology,
                                    [card.key]: value,
                                  },
                                };
                              }));
                            }}
                          />
                        ))}
                      </div>
                      <div className="tj-psy-score">{`${score}/5`}</div>
                      <div className="tj-psy-note">
                        {score >= 4 ? 'Strong today' : score >= 3 ? 'Solid with room to improve' : 'Needs tightening'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="tj-section-head">
                <span className="tj-section-title">State of Mind</span>
              </div>
              <div className="tj-tags">
                {selectedEntry.emotions.map((emotion, index) => (
                  <button
                    key={emotion.label}
                    type="button"
                    className={`tj-tag ${emotion.state === 'green' ? 's-g' : emotion.state === 'amber' ? 's-a' : emotion.state === 'red' ? 's-r' : ''}`}
                    onClick={() => {
                      mutateEntries(prev => prev.map(entry => {
                        if (entry.id !== selectedEntry.id) return entry;
                        const next = [...entry.emotions];
                        next[index] = { ...next[index], state: cycleEmotionState(next[index].state) };
                        return { ...entry, emotions: next };
                      }));
                    }}
                  >
                    {emotion.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div
            className="tj-empty-entry"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <div className="tj-empty-wrap">
              <div className={`tj-empty-card ${isDragging ? 'drag' : ''}`}>
                <span className="tj-empty-badge"><Upload size={20} /></span>
                <p className="tj-empty-title">Start your first Trade Journal entry</p>
                <p className="tj-empty-text">
                  Drop a chart to scan with Flyxa AI or create a blank day and fill entries manually.
                </p>
                {scanError && <p className="tj-empty-text tj-empty-error">{scanError}</p>}
                {isScanning && (
                  <div className="tj-scan-stage" role="status" aria-live="polite">
                    {scanPreviewUrl && (
                      <div className="tj-scan-preview">
                        <img src={scanPreviewUrl} alt="Chart being scanned" />
                        <div className="tj-scan-overlay">
                          <span className="tj-scan-overlay-label">Scanning</span>
                        </div>
                      </div>
                    )}
                    <div className="tj-scan-status">
                      <span className="tj-scan-dot" />
                      <span className="tj-scan-dot" />
                      <span className="tj-scan-dot" />
                    </div>
                    <p className="tj-empty-text">"Patience is expensive, but revenge is costlier."</p>
                  </div>
                )}
                <div className="tj-empty-actions">
                  <button type="button" className="tj-btn-primary" onClick={() => scanInputRef.current?.click()} disabled={isScanning}>
                    Upload file
                  </button>
                  <button type="button" className="tj-btn-ghost" onClick={addBlankDay} disabled={isScanning}>
                    Start blank day
                  </button>
                </div>
              </div>
              <div className="tj-empty-meta">PNG | JPG | WEBP | Max 10MB</div>
            </div>
          </div>
        )}
      </section>

      {isScreenshotFullscreen && primaryScreenshot && (
        <div
          className="tj-shot-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Trade screenshot fullscreen"
          onClick={() => setIsScreenshotFullscreen(false)}
        >
          <button
            type="button"
            className="tj-shot-modal-close"
            onClick={() => setIsScreenshotFullscreen(false)}
            aria-label="Close fullscreen screenshot"
          >
            <X size={16} />
          </button>
          <img
            src={primaryScreenshot}
            alt="Trade chart fullscreen"
            className="tj-shot-modal-image"
            onClick={event => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

