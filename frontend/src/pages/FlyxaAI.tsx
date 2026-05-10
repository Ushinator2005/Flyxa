import { CSSProperties, useMemo, useState } from 'react';
import { Clock3, AlertTriangle } from 'lucide-react';
import { NavLink, useSearchParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { Trade } from '../types/index.js';

type InsightType = 'risk' | 'pattern' | 'psychology' | 'edge';
type TagTone = 'positive' | 'negative' | 'neutral';

type WeeklyStat = {
  label: string;
  value: string;
  subLabel: string;
  tone: 'positive' | 'negative' | 'neutral' | 'info';
};

type WeeklyInsight = {
  type: InsightType;
  badge: string;
  frequency: string;
  title: string;
  body: string;
  keyPhrases: string[];
  tags: Array<{ label: string; tone: TagTone }>;
  actionLabel: string;
};

type ProcessBreakdownItem = { label: string; value: number };
type ConfluenceHighlight = { label: string; trades: number; winRate: number; netPnl: number; avgPnl: number };

type WeeklyDebriefData = {
  weekRange: string;
  sessionCount: number;
  tradeCount: number;
  instruments: string[];
  stats: {
    netR: WeeklyStat;
    winRate: WeeklyStat;
    avgWinner: WeeklyStat;
    avgLoser: WeeklyStat;
    processScore: WeeklyStat;
  };
  question: string;
  insights: WeeklyInsight[];
  processBreakdown: ProcessBreakdownItem[];
  confluences: ConfluenceHighlight[];
  focusItems: string[];
  nextDebrief: { generatedOn: string; sessionsLogged: number; sessionsTarget: number };
};


const colors = {
  d0: 'var(--d0, #0e0d0d)',
  d1: 'var(--d1, #141312)',
  d2: 'var(--d2, #1a1917)',
  d3: 'var(--d3, #201f1d)',
  d4: 'var(--d4, #27251f)',
  b0: 'var(--b0, rgba(255,255,255,0.07))',
  b1: 'var(--b1, rgba(255,255,255,0.12))',
  t0: 'var(--t0, #e8e3dc)',
  t1: 'var(--t1, #8a8178)',
  t2: 'var(--t2, #5c5751)',
  acc: 'var(--acc, #f59e0b)',
  grn: 'var(--grn, #22d68a)',
  red: 'var(--red, #f05252)',
  amb: 'var(--amb, #f59e0b)',
  blu: 'var(--blu, #f59e0b)',
  mono: 'var(--mono, \'DM Mono\', ui-monospace, monospace)',
};

const insightTypeStyles: Record<InsightType, { accent: string }> = {
  risk: { accent: colors.red },
  pattern: { accent: colors.blu },
  psychology: { accent: colors.amb },
  edge: { accent: colors.grn },
};

const tinyMetaLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: colors.t2,
};

const cardBorder = `1px solid ${colors.b0}`;

function avg(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function pct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

function parseTradeDate(trade?: Partial<Trade> | null): Date | null {
  if (!trade) return null;
  if (trade.trade_date) {
    const parsed = new Date(`${trade.trade_date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (trade.created_at) {
    const parsed = new Date(trade.created_at);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }
  return null;
}

function parseTradeDateTime(trade?: Partial<Trade> | null): Date | null {
  if (!trade) return null;
  if (trade.trade_date) {
    const time = trade.trade_time?.length === 5 ? `${trade.trade_time}:00` : (trade.trade_time || '00:00:00');
    const parsed = new Date(`${trade.trade_date}T${time}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (trade.created_at) {
    const parsed = new Date(trade.created_at);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function tradeMinutes(trade?: Partial<Trade> | null): number | null {
  if (!trade) return null;
  if (!trade.trade_time) return null;
  const [h, m] = trade.trade_time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h * 60) + m;
}

function tradeSessionKey(trade?: Partial<Trade> | null) {
  const date = parseTradeDate(trade);
  return date ? date.toISOString().slice(0, 10) : '';
}

function formatWeekRange(start: Date, end: Date) {
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

function formatSignedCompactCurrency(value: number) {
  const compact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(value)).replace('K', 'k');
  return `${value >= 0 ? '+' : '-'}${compact}`;
}

function normalizeConfluences(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const deduped = new Set<string>();
  const normalized: string[] = [];

  for (const entry of rawValues) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (deduped.has(key)) continue;
    deduped.add(key);
    normalized.push(cleaned);
  }

  return normalized;
}

function tradeR(trade?: Partial<Trade> | null): number {
  if (!trade) return 0;
  const entryPrice = Number(trade.entry_price ?? 0);
  const stopPrice = Number(trade.sl_price ?? 0);
  const pnl = Number(trade.pnl ?? 0);
  const riskPoints = Math.abs(entryPrice - stopPrice);
  if (riskPoints > 0) {
    const contractSize = Number(trade.contract_size ?? 0);
    const pointVal = Number(trade.point_value ?? 0);
    const size = contractSize > 0 ? contractSize : 1;
    const pointValue = pointVal > 0 ? pointVal : 1;
    const riskCash = riskPoints * size * pointValue;
    if (riskCash > 0) return pnl / riskCash;
  }
  if (pnl > 0) return 1;
  if (pnl < 0) return -1;
  return 0;
}

function summarize(trades: Trade[]) {
  const rs = trades.map(tradeR);
  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl < 0);
  const winnerRs = winners.map(tradeR);
  const loserRs = losers.map(tradeR);
  const pnls = trades.map(trade => Number(trade.pnl ?? 0));
  const winnerPnls = winners.map(trade => Number(trade.pnl ?? 0));
  const loserPnls = losers.map(trade => Number(trade.pnl ?? 0));
  return {
    netR: rs.reduce((s, r) => s + r, 0),
    netPnl: trades.reduce((sum, trade) => sum + Number(trade.pnl ?? 0), 0),
    avgPnl: avg(pnls),
    avgR: avg(rs),
    winRate: pct(winners.length, winners.length + losers.length),
    wins: winners.length,
    losses: losers.length,
    avgWinnerR: avg(winnerRs),
    avgLoserR: avg(loserRs),
    avgWinnerPnl: avg(winnerPnls),
    avgLoserPnl: avg(loserPnls),
    bestR: winnerRs.length ? Math.max(...winnerRs) : 0,
    worstR: loserRs.length ? Math.min(...loserRs) : 0,
    bestPnl: winnerPnls.length ? Math.max(...winnerPnls) : 0,
    worstPnl: loserPnls.length ? Math.min(...loserPnls) : 0,
  };
}

function processBreakdown(trades: Trade[]) {
  if (!trades.length) {
    return {
      items: [
        { label: 'Plan adherence', value: 0 },
        { label: 'Size discipline', value: 0 },
        { label: 'Entry patience', value: 0 },
        { label: 'Post-loss mgmt', value: 0 },
      ],
      score: 0,
    };
  }

  const tradesWithPlanLogged = trades.filter(t => typeof t.followed_plan === 'boolean');
  const plan = tradesWithPlanLogged.length
    ? Math.round(pct(tradesWithPlanLogged.filter(t => t.followed_plan === true).length, tradesWithPlanLogged.length))
    : 0;
  const sizes = trades.map(t => Math.max(1, t.contract_size));
  const sortedSizes = [...sizes].sort((a, b) => a - b);
  const mid = Math.floor(sortedSizes.length / 2);
  const median = sortedSizes.length % 2 === 0 ? (sortedSizes[mid - 1] + sortedSizes[mid]) / 2 : sortedSizes[mid];
  const deviation = avg(sizes.map(s => Math.abs(s - median) / Math.max(1, median)));
  const size = Math.round(Math.max(0, Math.min(100, 100 - (deviation * 100))));

  const early = trades.filter(t => {
    const minutes = tradeMinutes(t);
    return minutes !== null && minutes < 600;
  }).length;
  const patience = Math.round(Math.max(0, Math.min(100, 100 - pct(early, trades.length))));

  const ordered = [...trades].sort((a, b) => (parseTradeDateTime(a)?.getTime() ?? 0) - (parseTradeDateTime(b)?.getTime() ?? 0));
  let opportunities = 0;
  let postLossTotal = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    if (prev.pnl >= 0) continue;
    opportunities += 1;
    const minsBetween = ((parseTradeDateTime(curr)?.getTime() ?? 0) - (parseTradeDateTime(prev)?.getTime() ?? 0)) / (1000 * 60);
    const sizeOk = curr.contract_size <= prev.contract_size ? 1 : 0;
    const waitOk = minsBetween >= 15 ? 1 : 0;
    const checks = [sizeOk, waitOk];
    if (typeof curr.followed_plan === 'boolean') {
      checks.push(curr.followed_plan ? 1 : 0);
    }
    postLossTotal += (avg(checks) * 100);
  }
  const postLoss = opportunities ? Math.round(postLossTotal / opportunities) : 70;
  const score = Math.round((plan * 0.35) + (size * 0.2) + (patience * 0.25) + (postLoss * 0.2));

  return {
    items: [
      { label: 'Plan adherence', value: plan },
      { label: 'Size discipline', value: size },
      { label: 'Entry patience', value: patience },
      { label: 'Post-loss mgmt', value: postLoss },
    ],
    score,
  };
}

function statToneColor(tone: WeeklyStat['tone']) {
  if (tone === 'positive') return colors.grn;
  if (tone === 'negative') return colors.red;
  if (tone === 'info') return colors.amb;
  return colors.t0;
}

function tagStyle(_tone: TagTone): CSSProperties {
  return {
    color: colors.t1,
    backgroundColor: colors.d3,
    border: `1px solid ${colors.b0}`,
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 10.5,
    lineHeight: 1.3,
    fontFamily: colors.mono,
  };
}

function breakdownColor(value: number) {
  if (value >= 80) return colors.grn;
  if (value >= 40) return colors.amb;
  return colors.red;
}

function gradeColor(grade: string) {
  if (grade === 'A') return colors.grn;
  if (grade === 'B') return '#60a5fa';
  if (grade === 'C') return colors.amb;
  return colors.red;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderBodyWithHighlights(body: string, keyPhrases: string[]) {
  if (!keyPhrases.length) return body;
  const lookup = new Set(keyPhrases.map(k => k.toLowerCase()));
  const pattern = new RegExp(`(${keyPhrases.map(escapeRegExp).join('|')})`, 'gi');
  return body.split(pattern).map((segment, idx) => (
    <span key={`${segment}-${idx}`} style={{ color: lookup.has(segment.toLowerCase()) ? colors.t0 : colors.t1 }}>
      {segment}
    </span>
  ));
}


function buildData(trades: Trade[]): WeeklyDebriefData {
  if (!trades.length) {
    return {
      weekRange: formatWeekRange(addDays(new Date(), -6), new Date()),
      sessionCount: 0,
      tradeCount: 0,
      instruments: [],
      stats: {
        netR: { label: 'Net PL', value: '$0.00', subLabel: 'No trades logged this week', tone: 'neutral' },
        winRate: { label: 'Win Rate', value: '0%', subLabel: '0W / 0L', tone: 'neutral' },
        avgWinner: { label: 'Avg Winner', value: '$0.00', subLabel: 'Need trade samples', tone: 'neutral' },
        avgLoser: { label: 'Avg Loser', value: '$0.00', subLabel: 'Need trade samples', tone: 'neutral' },
        processScore: { label: 'Process Score', value: '0/100', subLabel: 'Builds from journal behavior', tone: 'info' },
      },
      question: 'What single setup will you execute with discipline this week?',
      insights: [{
        type: 'risk',
        badge: 'Risk Flag',
        frequency: 'Waiting for trade data',
        title: 'No weekly risk signal yet',
        body: 'Add trades in the journal and Flyxa will generate this debrief from your execution data.',
        keyPhrases: ['journal', 'execution data'],
        tags: [{ label: 'No trades this week', tone: 'neutral' }],
        actionLabel: 'Add your first trade ->',
      }],
      processBreakdown: [
        { label: 'Plan adherence', value: 0 },
        { label: 'Size discipline', value: 0 },
        { label: 'Entry patience', value: 0 },
        { label: 'Post-loss mgmt', value: 0 },
      ],
      confluences: [],
      focusItems: [
        'Log every trade with setup, emotional state, and followed_plan status.',
        'Use consistent position sizing so process scoring can stabilize.',
        'Capture post-loss behavior with notes for deeper AI feedback.',
      ],
      nextDebrief: {
        generatedOn: addDays(new Date(), 1).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
        sessionsLogged: 0,
        sessionsTarget: 5,
      },
    };
  }

  const ordered = [...trades].sort((a, b) => (parseTradeDateTime(a)?.getTime() ?? 0) - (parseTradeDateTime(b)?.getTime() ?? 0));
  const anchor = parseTradeDate(ordered[ordered.length - 1]) ?? new Date();
  const weekEnd = addDays(anchor, 0);
  const weekStart = addDays(weekEnd, -6);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);
  const rollingStart = addDays(weekEnd, -29);
  const inRange = (trade: Trade, start: Date, end: Date) => {
    const date = parseTradeDate(trade);
    return Boolean(date && date.getTime() >= start.getTime() && date.getTime() <= end.getTime());
  };

  const weekly = ordered.filter(t => inRange(t, weekStart, weekEnd));
  const previous = ordered.filter(t => inRange(t, prevStart, prevEnd));
  const rolling = ordered.filter(t => inRange(t, rollingStart, weekEnd));
  const weeklySummary = summarize(weekly);
  const previousSummary = summarize(previous);
  const weeklyProcess = processBreakdown(weekly);
  const rollingProcess = processBreakdown(rolling);
  const processDiff = weeklyProcess.score - rollingProcess.score;
  const sessionCount = new Set(weekly.map(tradeSessionKey).filter(Boolean)).size;

  const instruments = Array.from(weekly.reduce((map, trade) => {
    const symbol = trade.symbol?.trim() || 'N/A';
    map.set(symbol, (map.get(symbol) ?? 0) + 1);
    return map;
  }, new Map<string, number>()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([symbol]) => symbol);

  const earlyTrades = weekly.filter(t => {
    const minutes = tradeMinutes(t);
    return minutes !== null && minutes < 600;
  });
  const lateTrades = weekly.filter(t => {
    const minutes = tradeMinutes(t);
    return minutes !== null && minutes >= 600;
  });
  const earlySummary = summarize(earlyTrades);
  const lateSummary = summarize(lateTrades);
  const earlySessions = new Set(earlyTrades.map(tradeSessionKey).filter(Boolean)).size;

  const symbolGroups = new Map<string, Trade[]>();
  weekly.forEach(trade => {
    const symbol = trade.symbol?.trim() || 'Unknown';
    symbolGroups.set(symbol, [...(symbolGroups.get(symbol) ?? []), trade]);
  });
  const topSymbol = Array.from(symbolGroups.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  const topSymbolName = topSymbol?.[0] ?? 'N/A';
  const topSymbolSummary = topSymbol ? summarize(topSymbol[1]) : summarize([]);

  const stateGroups = new Map<string, Trade[]>();
  weekly.forEach(trade => {
    const state = trade.emotional_state || 'Unspecified';
    stateGroups.set(state, [...(stateGroups.get(state) ?? []), trade]);
  });
  const rankedStates = Array.from(stateGroups.entries())
    .map(([state, entries]) => ({ state, summary: summarize(entries) }))
    .sort((a, b) => a.summary.netPnl - b.summary.netPnl);
  const meaningfulStates = rankedStates.filter(s => (s.state as string) !== 'Unspecified');
  const hasEnoughPsychData = meaningfulStates.length >= 2;
  const psychWeakest = meaningfulStates[0];
  const psychStrongest = meaningfulStates[meaningfulStates.length - 1];

  const sessionGroups = new Map<string, Trade[]>();
  weekly.forEach(trade => {
    const session = trade.session || 'Other';
    sessionGroups.set(session, [...(sessionGroups.get(session) ?? []), trade]);
  });
  const bestSession = Array.from(sessionGroups.entries())
    .map(([session, entries]) => ({ session, entries, summary: summarize(entries) }))
    .sort((a, b) => b.summary.netPnl - a.summary.netPnl)[0];

  const confluenceGroups = new Map<string, {
    label: string;
    trades: number;
    wins: number;
    netPnl: number;
  }>();
  weekly.forEach(trade => {
    const tradeConfluences = normalizeConfluences(trade.confluences);
    if (!tradeConfluences.length) return;
    const tradeConfluenceSet = new Set(tradeConfluences.map(confluence => confluence.toLowerCase()));
    const currentPnl = Number(trade.pnl ?? 0);

    tradeConfluenceSet.forEach(confluenceKey => {
      const label = tradeConfluences.find(confluence => confluence.toLowerCase() === confluenceKey) ?? confluenceKey;
      const current = confluenceGroups.get(confluenceKey) ?? {
        label,
        trades: 0,
        wins: 0,
        netPnl: 0,
      };
      current.trades += 1;
      current.netPnl += currentPnl;
      if (trade.pnl > 0) current.wins += 1;
      confluenceGroups.set(confluenceKey, current);
    });
  });
  const confluenceLeaders: ConfluenceHighlight[] = Array.from(confluenceGroups.values())
    .map(item => ({
      ...item,
      winRate: item.trades > 0 ? pct(item.wins, item.trades) : 0,
      avgPnl: item.trades > 0 ? item.netPnl / item.trades : 0,
    }))
    .sort((a, b) => b.netPnl - a.netPnl);
  const topConfluence = confluenceLeaders[0];
  const weakestConfluence = [...confluenceLeaders]
    .filter(item => item.netPnl < 0)
    .sort((a, b) => a.netPnl - b.netPnl)[0];

  const weakestProcess = [...weeklyProcess.items].sort((a, b) => a.value - b.value)[0];
  const question = weakestProcess?.label === 'Entry patience'
    ? 'Which entries this week were taken too early, and what confirmation were you still waiting for?'
    : weakestProcess?.label === 'Post-loss mgmt'
      ? 'After your losing trades, where did you reset well and where did you press too quickly?'
      : weakestProcess?.label === 'Size discipline'
        ? 'Where did your size deviate from plan, and what triggered it?'
        : weakestConfluence
          ? `How can you tighten or avoid "${weakestConfluence.label}" when it has cost ${formatSignedCurrency(weakestConfluence.netPnl)} this week?`
          : 'Which losing trades came from plan drift, and what rule would have prevented them?';

  const insights: WeeklyInsight[] = [
    {
      type: (() => {
        if (!earlyTrades.length) return 'edge' as const;
        if (earlySummary.netPnl < 0) return 'risk' as const;
        const hasLate = lateTrades.length > 0;
        if (hasLate && earlySummary.avgPnl < lateSummary.avgPnl) return 'risk' as const;
        return 'pattern' as const;
      })(),
      badge: (() => {
        if (!earlyTrades.length) return 'Open Hour';
        if (earlySummary.netPnl < 0) return 'Risk Flag';
        if (lateTrades.length > 0 && earlySummary.avgPnl >= lateSummary.avgPnl) return 'Session Note';
        return 'Risk Flag';
      })(),
      frequency: earlyTrades.length ? `${earlyTrades.length} trades before 10:00 · ${earlySessions} sessions` : 'No early-session entries this week',
      title: (() => {
        if (!earlyTrades.length) return 'Open-hour risk stayed controlled this week';
        if (earlySummary.netPnl < 0) return 'Pre-10:00 entries are bleeding your P&L — stop trading the open';
        if (lateTrades.length > 0 && earlySummary.avgPnl > lateSummary.avgPnl) return 'Your pre-10:00 edge outperformed late session — worth monitoring';
        if (lateTrades.length > 0 && earlySummary.avgPnl < lateSummary.avgPnl) return 'Open-hour entries are underperforming your late-session edge';
        return `${earlyTrades.length} open-hour entries — no clear session drag detected`;
      })(),
      body: (() => {
        if (!earlyTrades.length) return 'No trades were logged before 10:00, removing your highest-risk overtrading window.';
        const earlyAvg = earlySummary.avgPnl;
        const lateAvg = lateSummary.avgPnl;
        const hasLate = lateTrades.length > 0;
        if (earlySummary.netPnl < 0) {
          return `${earlyTrades.length} trades before 10:00 cost you ${formatSignedCurrency(Math.abs(earlySummary.netPnl))}${hasLate ? `, while your after-10:00 avg was ${formatSignedCurrency(lateAvg)}. The open is clearly your weakest window — stop entering until 10:00.` : '. No after-10:00 trades to compare.'}`;
        }
        if (!hasLate) {
          return `All ${earlyTrades.length} of your trades were before 10:00, totalling ${formatSignedCurrency(earlySummary.netPnl)} (${formatSignedCurrency(earlyAvg)}/trade avg). No late-session trades to compare against.`;
        }
        if (earlyAvg >= lateAvg) {
          return `Pre-10:00 avg was ${formatSignedCurrency(earlyAvg)} vs ${formatSignedCurrency(lateAvg)} after 10:00 — your early entries actually outperformed this week. That's unusual. Confirm whether these were genuinely high-quality setups or lucky noise before making this a habit.`;
        }
        return `${earlyTrades.length} trades before 10:00 averaged ${formatSignedCurrency(earlyAvg)}, underperforming your after-10:00 avg of ${formatSignedCurrency(lateAvg)}. Your edge is stronger later in the session — delay first entries.`;
      })(),
      keyPhrases: earlyTrades.length
        ? [String(earlyTrades.length), 'before 10:00', formatSignedCurrency(earlySummary.netPnl), formatSignedCurrency(earlySummary.avgPnl)]
        : ['before 10:00', 'highest-risk overtrading window'],
      tags: earlyTrades.length
        ? [
            { label: `${formatSignedCurrency(earlySummary.netPnl)} pre-10:00`, tone: earlySummary.netPnl >= 0 ? 'positive' : 'negative' },
            { label: `${earlyTrades.length} open-hour trades`, tone: 'neutral' },
            ...(lateTrades.length > 0 ? [{ label: `${formatSignedCurrency(lateSummary.avgPnl)} avg after 10:00`, tone: lateSummary.avgPnl > 0 ? 'positive' as const : lateSummary.avgPnl < 0 ? 'negative' as const : 'neutral' as const }] : []),
          ]
        : [
            { label: '0 pre-10:00 trades', tone: 'positive' },
            { label: 'Risk window controlled', tone: 'neutral' },
          ],
      actionLabel: 'Add to pre-session rules ->',
    },
    {
      type: 'pattern',
      badge: 'Recurring Pattern',
      frequency: topSymbol ? `${topSymbolName} appeared in ${topSymbol[1].length} trades` : 'Not enough symbol data',
      title: topSymbol ? `${topSymbolName} is your dominant recurring instrument this week` : 'No recurring symbol pattern detected',
      body: topSymbol
        ? (() => {
            const netPnl = topSymbolSummary.netPnl;
            const count = topSymbol[1].length;
            const wr = Math.round(topSymbolSummary.winRate);
            const avgPnl = netPnl / Math.max(1, count);
            const isBreakeven = Math.abs(netPnl) < 25 && count >= 2;
            const pnlPhrase = isBreakeven
              ? `essentially breakeven at ${formatSignedCurrency(netPnl)} total — no edge showing across ${count} trade${count !== 1 ? 's' : ''}`
              : `returned ${formatSignedCurrency(netPnl)} net across ${count} trade${count !== 1 ? 's' : ''} (${formatSignedCurrency(avgPnl)}/trade avg)`;
            const addendum = wr < 45 && netPnl < 0
              ? ` This instrument is costing you — either the setup has broken down or your execution is off. Consider pausing ${topSymbolName} until the edge is validated.`
              : wr >= 60 && netPnl > 50
                ? ` Edge is confirming on ${topSymbolName}. Keep conditions tight and risk consistent.`
                : '';
            return `${topSymbolName}: ${wr}% win rate, ${pnlPhrase}.${addendum}`;
          })()
        : 'Log more symbol-tagged trades to activate recurring pattern detection.',
      keyPhrases: topSymbol
        ? [topSymbolName, formatSignedCurrency(topSymbolSummary.netPnl), `${Math.round(topSymbolSummary.winRate)}%`, `${topSymbol[1].length} trades`]
        : ['symbol-tagged trades', 'pattern detection'],
      tags: topSymbol
        ? [
            { label: `${formatSignedCurrency(topSymbolSummary.netPnl)} on ${topSymbolName}`, tone: topSymbolSummary.netPnl >= 0 ? 'positive' : 'negative' },
            { label: `${Math.round(topSymbolSummary.winRate)}% win rate`, tone: topSymbolSummary.winRate >= 50 ? 'positive' : 'negative' },
          ]
        : [{ label: 'Need more samples', tone: 'neutral' }],
      actionLabel: 'Promote to pattern library ->',
    },
    {
      type: 'psychology',
      badge: 'Psychology',
      frequency: hasEnoughPsychData
        ? `${meaningfulStates.length} emotional states logged`
        : meaningfulStates.length === 1
          ? '1 state — need more variety'
          : 'No emotional states tagged',
      title: hasEnoughPsychData && psychWeakest && psychStrongest
        ? `"${psychWeakest.state}" is your biggest performance liability this week`
        : 'Emotional data too thin — you are flying blind',
      body: (() => {
        if (meaningfulStates.length === 0) {
          return 'You logged zero emotional states this week. Flyxa cannot tell you if your mood is costing you money without this data. Tag every single trade honestly — this is non-negotiable for real AI feedback.';
        }
        if (!hasEnoughPsychData) {
          return `You only logged one emotional state ("${meaningfulStates[0]?.state}") across all your trades this week. Log different states honestly so Flyxa can find the patterns that are costing you real money.`;
        }
        if (!psychWeakest || !psychStrongest) return 'Add emotional_state tags to unlock behavior-performance insights.';
        const gap = Math.abs(psychStrongest.summary.avgPnl - psychWeakest.summary.avgPnl);
        const hardStop = gap > 30
          ? ` That ${formatSignedCurrency(gap)} gap per trade is not noise — you should not be entering trades when you feel "${psychWeakest.state}".`
          : ` Track this over more sessions to confirm if "${psychWeakest.state}" needs a hard no-trade rule.`;
        return `"${psychWeakest.state}" averaged ${formatSignedCurrency(psychWeakest.summary.avgPnl)} vs "${psychStrongest.state}" at ${formatSignedCurrency(psychStrongest.summary.avgPnl)} this week.${hardStop}`;
      })(),
      keyPhrases: hasEnoughPsychData && psychWeakest && psychStrongest
        ? [`"${psychWeakest.state}"`, formatSignedCurrency(psychWeakest.summary.avgPnl), `"${psychStrongest.state}"`, formatSignedCurrency(psychStrongest.summary.avgPnl)]
        : ['emotional states', 'tag every trade'],
      tags: hasEnoughPsychData && psychWeakest && psychStrongest
        ? [
            { label: `${psychWeakest.state}: ${formatSignedCurrency(psychWeakest.summary.netPnl)}`, tone: psychWeakest.summary.netPnl >= 0 ? 'positive' : 'negative' },
            { label: `${psychStrongest.state}: ${formatSignedCurrency(psychStrongest.summary.netPnl)}`, tone: psychStrongest.summary.netPnl >= 0 ? 'positive' : 'negative' },
          ]
        : [{ label: meaningfulStates.length === 0 ? 'No states logged' : 'Need 2+ distinct states', tone: 'neutral' }],
      actionLabel: 'Create emotional reset rule ->',
    },
    {
      type: 'edge',
      badge: 'Edge Confirmed',
      frequency: bestSession ? `${bestSession.session} led this week` : 'No clear session edge this week',
      title: bestSession ? `${bestSession.session} is your strongest edge window this week` : 'Session edge needs more data',
      body: bestSession
        ? `${bestSession.session} delivered ${formatSignedCurrency(bestSession.summary.netPnl)} at ${Math.round(bestSession.summary.winRate)}% over ${bestSession.entries.length} trades.`
        : 'Keep logging session tags to reveal your strongest time-window edge.',
      keyPhrases: bestSession
        ? [bestSession.session, formatSignedCurrency(bestSession.summary.netPnl), `${Math.round(bestSession.summary.winRate)}%`, `${bestSession.entries.length} trades`]
        : ['session tags', 'time-window edge'],
      tags: bestSession
        ? [
            { label: `${formatSignedCurrency(bestSession.summary.netPnl)} net`, tone: bestSession.summary.netPnl >= 0 ? 'positive' : 'negative' },
            { label: `${Math.round(bestSession.summary.winRate)}% win rate`, tone: bestSession.summary.winRate >= 50 ? 'positive' : 'negative' },
            { label: `${bestSession.entries.length} trades`, tone: 'neutral' },
          ]
        : [{ label: 'Need session samples', tone: 'neutral' }],
      actionLabel: 'Add to pre-session brief ->',
    },
  ];

  if (topConfluence) {
    insights.push({
      type: topConfluence.netPnl >= 0 ? 'edge' : 'risk',
      badge: 'Confluence Signal',
      frequency: `${topConfluence.trades} trades logged with "${topConfluence.label}"`,
      title: topConfluence.netPnl >= 0
        ? `"${topConfluence.label}" is your highest-conviction confluence this week`
        : `"${topConfluence.label}" needs review before reuse`,
      body: `"${topConfluence.label}" returned ${formatSignedCurrency(topConfluence.netPnl)} total (${formatSignedCurrency(topConfluence.avgPnl)} avg) with ${Math.round(topConfluence.winRate)}% win rate.`,
      keyPhrases: [
        `"${topConfluence.label}"`,
        formatSignedCurrency(topConfluence.netPnl),
        formatSignedCurrency(topConfluence.avgPnl),
        `${Math.round(topConfluence.winRate)}%`,
      ],
      tags: [
        { label: `${topConfluence.trades} tagged trades`, tone: 'neutral' },
        { label: `${Math.round(topConfluence.winRate)}% win rate`, tone: topConfluence.winRate >= 50 ? 'positive' : 'negative' },
        { label: `${formatSignedCurrency(topConfluence.netPnl)} net`, tone: topConfluence.netPnl >= 0 ? 'positive' : 'negative' },
      ],
      actionLabel: 'Refine this confluence checklist ->',
    });
  }

  const focusItems: string[] = [];
  const byLabel = new Map(weeklyProcess.items.map(item => [item.label, item.value]));
  if ((byLabel.get('Entry patience') ?? 0) < 70) focusItems.push('Delay first entry until setup structure is confirmed after 10:00.');
  if ((byLabel.get('Post-loss mgmt') ?? 0) < 65) focusItems.push('After a loss, wait 15 minutes and reduce size on the next trade.');
  if ((byLabel.get('Plan adherence') ?? 0) < 75) focusItems.push('Run a quick plan checklist before each entry to prevent drift.');
  if ((byLabel.get('Size discipline') ?? 0) < 75) focusItems.push('Keep contract size near baseline to reduce variance spikes.');
  if (weakestConfluence) focusItems.push(`Reduce low-quality "${weakestConfluence.label}" entries until the setup is validated again.`);
  while (focusItems.length < 3) focusItems.push('Keep journaling every trade with notes and emotional context for sharper AI signals.');

  const nextSunday = (() => {
    const day = weekEnd.getDay();
    const days = ((7 - day) % 7) || 7;
    return addDays(weekEnd, days);
  })();

  return {
    weekRange: formatWeekRange(weekStart, weekEnd),
    sessionCount,
    tradeCount: weekly.length,
    instruments,
    stats: {
      netR: { label: 'Net PL', value: formatSignedCurrency(weeklySummary.netPnl), subLabel: `vs ${formatSignedCurrency(previousSummary.netPnl)} prev week`, tone: weeklySummary.netPnl >= 0 ? 'positive' : 'negative' },
      winRate: { label: 'Win Rate', value: `${Math.round(weeklySummary.winRate)}%`, subLabel: `${weeklySummary.wins}W / ${weeklySummary.losses}L`, tone: 'neutral' },
      avgWinner: { label: 'Avg Winner', value: formatSignedCurrency(weeklySummary.avgWinnerPnl), subLabel: `Best ${formatSignedCurrency(weeklySummary.bestPnl)}`, tone: weeklySummary.avgWinnerPnl >= 0 ? 'positive' : 'neutral' },
      avgLoser: { label: 'Avg Loser', value: formatSignedCurrency(weeklySummary.avgLoserPnl), subLabel: `Worst ${formatSignedCurrency(weeklySummary.worstPnl)}`, tone: weeklySummary.avgLoserPnl < 0 ? 'negative' : 'neutral' },
      processScore: { label: 'Process Score', value: `${weeklyProcess.score}/100`, subLabel: `${processDiff >= 0 ? '+' : ''}${processDiff} vs 30-day avg`, tone: 'info' },
    },
    question,
    insights,
    processBreakdown: weeklyProcess.items,
    confluences: confluenceLeaders.slice(0, 4),
    focusItems: focusItems.slice(0, 3),
    nextDebrief: {
      generatedOn: nextSunday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
      sessionsLogged: sessionCount,
      sessionsTarget: 5,
    },
  };
}

export default function FlyxaAI() {
  const { trades, loading } = useTrades();
  const { filterTradesBySelectedAccount } = useAppSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [respondOpen, setRespondOpen] = useState(false);
  const [respondText, setRespondText] = useState('');

  const accountTrades = useMemo(
    () => filterTradesBySelectedAccount(trades),
    [filterTradesBySelectedAccount, trades]
  );
  const safeAccountTrades = useMemo(
    () => accountTrades.filter((trade): trade is Trade => Boolean(trade)),
    [accountTrades]
  );
  const weeklyDebriefData = useMemo(
    () => buildData(safeAccountTrades),
    [safeAccountTrades]
  );
  const focusedTradeId = searchParams.get('tradeId');
  const focusedTrade = useMemo(
    () => (focusedTradeId ? safeAccountTrades.find(trade => trade.id === focusedTradeId) ?? null : null),
    [focusedTradeId, safeAccountTrades]
  );
  const focusedTradePnl = useMemo(
    () => (focusedTrade ? Number(focusedTrade.pnl ?? 0) : null),
    [focusedTrade]
  );
  const focusedTradeConfluences = useMemo(
    () => normalizeConfluences(focusedTrade?.confluences),
    [focusedTrade]
  );

  const sessionsProgress = Math.min(100, (weeklyDebriefData.nextDebrief.sessionsLogged / weeklyDebriefData.nextDebrief.sessionsTarget) * 100);
  const processScoreNumeric = Number.parseInt(weeklyDebriefData.stats.processScore.value, 10);
  const boundedScore = Math.max(0, Math.min(100, Number.isFinite(processScoreNumeric) ? processScoreNumeric : 0));
  const dedupedFocusItems = Array.from(new Set(weeklyDebriefData.focusItems));
  const remainingSessions = Math.max(0, weeklyDebriefData.nextDebrief.sessionsTarget - weeklyDebriefData.nextDebrief.sessionsLogged);

  const themeVars = {
    '--d0': '#0e0d0d',
    '--d1': '#141312',
    '--d2': '#1a1917',
    '--d3': '#201f1d',
    '--d4': '#27251f',
    '--b0': 'rgba(255,255,255,0.07)',
    '--b1': 'rgba(255,255,255,0.12)',
    '--t0': '#e8e3dc',
    '--t1': '#8a8178',
    '--t2': '#5c5751',
    '--acc': '#f59e0b',
    '--grn': '#22d68a',
    '--red': '#f05252',
    '--amb': '#f59e0b',
    '--blu': '#f59e0b',
    '--mono': '\'DM Mono\', ui-monospace, monospace',
  } as CSSProperties;

  const weeklyWindow = useMemo(() => {
    const ordered = [...safeAccountTrades].sort((a, b) => (parseTradeDateTime(a)?.getTime() ?? 0) - (parseTradeDateTime(b)?.getTime() ?? 0));
    const anchor = parseTradeDate(ordered[ordered.length - 1]) ?? new Date();
    const weekEnd = addDays(anchor, 0);
    const weekStart = addDays(weekEnd, -6);
    const prevStart = addDays(weekStart, -7);
    const prevEnd = addDays(weekStart, -1);

    const inRange = (trade: Trade, start: Date, end: Date) => {
      const date = parseTradeDate(trade);
      return Boolean(date && date.getTime() >= start.getTime() && date.getTime() <= end.getTime());
    };

    const weeklyTrades = ordered.filter(trade => inRange(trade, weekStart, weekEnd));
    const previousTrades = ordered.filter(trade => inRange(trade, prevStart, prevEnd));
    return { weeklyTrades, previousTrades };
  }, [safeAccountTrades]);

  const previousWeekPnl = useMemo(
    () => summarize(weeklyWindow.previousTrades).netPnl,
    [weeklyWindow.previousTrades]
  );

  const dataCompleteness = useMemo(() => {
    const wt = weeklyWindow.weeklyTrades;
    if (!wt.length) return null;
    const withEmotion = wt.filter(t => t.emotional_state && (t.emotional_state as string) !== 'Unspecified').length;
    const withPlan = wt.filter(t => typeof t.followed_plan === 'boolean').length;
    const withNotes = wt.filter(t => t.post_trade_notes?.trim()).length;
    return {
      total: wt.length,
      emotionPct: Math.round((withEmotion / wt.length) * 100),
      planPct: Math.round((withPlan / wt.length) * 100),
      notesPct: Math.round((withNotes / wt.length) * 100),
    };
  }, [weeklyWindow.weeklyTrades]);
  const netRNumeric = Number.parseFloat(weeklyDebriefData.stats.netR.value.replace(/[^\d.+-]/g, '')) || 0;
  const weakestProcess = useMemo(
    () => [...weeklyDebriefData.processBreakdown].sort((a, b) => a.value - b.value)[0],
    [weeklyDebriefData.processBreakdown]
  );
  const violationsByWeakestMetric = Math.max(
    0,
    Math.round((weeklyWindow.weeklyTrades.length * (100 - (weakestProcess?.value ?? 0))) / 100)
  );
  const violationType = weakestProcess?.label === 'Entry patience'
    ? 'Entry timing'
    : weakestProcess?.label === 'Post-loss mgmt'
      ? 'Post-loss impulse'
      : weakestProcess?.label === 'Size discipline'
        ? 'Sizing drift'
        : 'Plan drift';

  const statCells = [
    weeklyDebriefData.stats.winRate,
    weeklyDebriefData.stats.avgWinner,
    weeklyDebriefData.stats.avgLoser,
    weeklyDebriefData.stats.processScore,
    {
      label: 'Rule Violations',
      value: String(violationsByWeakestMetric),
      subLabel: violationType,
      tone: 'negative' as const,
    },
  ];

  const displayedInsights = weeklyDebriefData.insights.slice(0, 4);

  const sparkline = useMemo(() => {
    const width = 168;
    const height = 42;
    const padX = 6;
    const padTop = 4;
    const padBottom = 6;
    const chartHeight = height - padTop - padBottom;
    const pnls = weeklyWindow.weeklyTrades.map(trade => Number(trade.pnl ?? 0));
    const cumulative: number[] = [0];
    pnls.forEach(pnl => cumulative.push((cumulative[cumulative.length - 1] ?? 0) + pnl));
    const min = Math.min(0, ...cumulative);
    const max = Math.max(0, ...cumulative);
    const dynamicPad = Math.max(20, Math.abs(max - min) * 0.15);
    const scaleMin = min - dynamicPad;
    const scaleMax = max + dynamicPad;
    const range = Math.max(1, scaleMax - scaleMin);
    const xAt = (step: number) => padX + ((step / Math.max(1, cumulative.length - 1)) * (width - (padX * 2)));
    const yAt = (value: number) => padTop + (((scaleMax - value) / range) * chartHeight);
    const baselineY = yAt(0);

    let linePath = `M ${xAt(0)} ${yAt(cumulative[0])}`;
    let areaPath = `M ${xAt(0)} ${baselineY} L ${xAt(0)} ${yAt(cumulative[0])}`;
    for (let index = 1; index < cumulative.length; index += 1) {
      linePath += ` L ${xAt(index)} ${yAt(cumulative[index])}`;
      areaPath += ` L ${xAt(index)} ${yAt(cumulative[index])}`;
    }
    areaPath += ` L ${xAt(cumulative.length - 1)} ${baselineY} Z`;

    const endX = xAt(cumulative.length - 1);
    const endY = yAt(cumulative[cumulative.length - 1] ?? 0);
    const endValue = cumulative[cumulative.length - 1] ?? 0;
    const isNearRightEdge = endX > width - 20;
    const isNearLeftEdge = endX < 20;

    return {
      width,
      height,
      baselineY,
      linePath,
      areaPath,
      endDot: {
        x: endX,
        y: endY,
        labelX: isNearRightEdge ? endX - 4 : isNearLeftEdge ? endX + 4 : endX,
        textAnchor: isNearRightEdge ? 'end' as const : isNearLeftEdge ? 'start' as const : 'middle' as const,
        label: formatSignedCompactCurrency(endValue),
      },
    };
  }, [weeklyWindow.weeklyTrades]);

  const bestTrade = useMemo(() => {
    if (!weeklyWindow.weeklyTrades.length) return null;
    const ranked = weeklyWindow.weeklyTrades
      .map(trade => ({ trade, pnl: Number(trade.pnl ?? 0) }))
      .sort((a, b) => b.pnl - a.pnl);
    const top = ranked[0];
    if (!top) return null;

    const parsed = parseTradeDateTime(top.trade);
    const dateLabel = parsed
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : (top.trade.trade_date || '--');

    return {
      symbol: top.trade.symbol || 'N/A',
      direction: top.trade.direction,
      resultPnl: formatSignedCurrency(top.pnl),
      session: top.trade.session || 'Other',
      time: top.trade.trade_time || '--:--',
      date: dateLabel,
      note: top.trade.pre_trade_notes?.trim() || 'Clean execution aligned with your process plan.',
      journal: top.trade.post_trade_notes?.trim() || 'Journal note not captured for this trade yet.',
    };
  }, [weeklyWindow.weeklyTrades]);

  const sessionBreakdownRows = useMemo(() => {
    const labels = ['London', 'New York', 'Asia'] as const;
    const rows = labels.map(label => {
      const tradesForSession = weeklyWindow.weeklyTrades.filter(trade => trade.session === label);
      const netPnl = tradesForSession.reduce((sum, trade) => sum + Number(trade.pnl ?? 0), 0);
      const scored = tradesForSession.filter(trade => trade.pnl !== 0);
      const wins = scored.filter(trade => trade.pnl > 0).length;
      const winRate = scored.length ? Math.round((wins / scored.length) * 100) : 0;
      return { label, netPnl, winRate, trades: tradesForSession.length };
    });
    const maxAbs = Math.max(1, ...rows.map(row => Math.abs(row.netPnl)));
    return rows.map(row => ({ ...row, barWidth: row.trades ? Math.max(8, (Math.abs(row.netPnl) / maxAbs) * 100) : 0 }));
  }, [weeklyWindow.weeklyTrades]);

  const weekGrade = boundedScore >= 90 ? 'A' : boundedScore >= 75 ? 'B' : boundedScore >= 60 ? 'C' : 'D';
  const nextGrade = weekGrade === 'A' ? null : weekGrade === 'B' ? 'A' : weekGrade === 'C' ? 'B' : 'C';
  const nextThreshold = weekGrade === 'A' ? null : weekGrade === 'B' ? 90 : weekGrade === 'C' ? 75 : 60;
  const gradeHint = nextThreshold === null
    ? 'You are in the top band. Maintain consistency across all four process metrics.'
    : `${weakestProcess?.label ?? 'Execution quality'} is the fastest lever. Raise it by about ${Math.max(1, nextThreshold - boundedScore)} points to reach grade ${nextGrade}.`;

  const actionItems = useMemo(() => {
    const items: string[] = [];
    if (weakestProcess?.label === 'Entry patience') items.push('Delay first entries until your setup confirms after the open instead of anticipating the move.');
    if (weakestProcess?.label === 'Post-loss mgmt') items.push('After any loss, enforce a 15-minute reset and drop one size tier before the next entry.');
    if (weakestProcess?.label === 'Size discipline') items.push('Keep position size fixed to baseline this week and block discretionary size increases.');
    if (weakestProcess?.label === 'Plan adherence') items.push('Run a pre-entry checklist and skip any trade that misses even one planned condition.');
    const riskInsight = displayedInsights.find(insight => insight.type === 'risk');
    if (riskInsight) items.push(`Convert "${riskInsight.title}" into a hard no-trade rule when that condition appears.`);
    const edgeInsight = displayedInsights.find(insight => insight.type === 'edge');
    if (edgeInsight) items.push(`Prioritize the ${edgeInsight.badge.toLowerCase()} context first and keep risk fixed while it is working.`);
    dedupedFocusItems.forEach(item => items.push(item));
    return Array.from(new Set(items)).slice(0, 3);
  }, [dedupedFocusItems, displayedInsights, weakestProcess?.label]);

  if (loading) {
    return (
      <div className="animate-fade-in flex h-[calc(100vh-3.5rem)] items-center justify-center rounded-2xl" style={{ ...themeVars, backgroundColor: colors.d0 }}>
        <LoadingSpinner size="lg" label="Analyzing your trade journal..." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in h-[calc(100vh-3.5rem)] overflow-hidden rounded-2xl" style={{ ...themeVars, backgroundColor: colors.d0, color: colors.t0 }}>
      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[178px_minmax(0,1fr)_252px]">
        <aside className="min-h-0 overflow-y-auto border-r px-2 py-4" style={{ backgroundColor: colors.d1, borderColor: colors.b0 }}>
          <div className="px-2">
            <p className="text-[14px] font-bold tracking-[0.1em]" style={{ color: colors.t0 }}>FLYXA</p>
            <p className="mt-0.5 text-[9.5px]" style={{ color: colors.t2 }}>Trading Intelligence</p>
          </div>

          <nav className="mt-4 space-y-0.5">
            {[
              { key: 'weekly', label: 'Weekly debrief', to: '/flyxa-ai', end: true },
              { key: 'pattern', label: 'Pattern library', to: '/flyxa-ai/patterns', end: false },
              { key: 'pre-session', label: 'Pre-session brief', to: '/flyxa-ai/pre-session', end: false },
              { key: 'emotional', label: 'Emotional fingerprint', to: '/flyxa-ai/emotional-fingerprint', end: false },
              { key: 'ask', label: 'Ask Flyxa', to: '/flyxa-ai', end: false },
            ].map(item => (
              <NavLink key={item.key} to={item.to} end={item.end}>
                {({ isActive }) => (
                  <span
                    className="block border-l-2 px-2.5 py-2 text-[12.5px] transition-colors hover:bg-white/[0.04]"
                    style={{
                      borderLeftColor: isActive ? colors.acc : 'transparent',
                      backgroundColor: isActive ? 'rgba(0,212,168,0.07)' : 'transparent',
                      color: isActive ? colors.acc : colors.t1,
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

        </aside>

        <main className="min-h-0 overflow-hidden" style={{ backgroundColor: colors.d0 }}>
          <div className="flex h-full min-h-0 flex-col">
            <section className="border-b px-6 py-5" style={{ borderColor: colors.b0 }}>
              <div className="flex items-end justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[9.5px] uppercase tracking-[0.12em]" style={{ color: colors.t2 }}>Weekly debrief</p>
                  <h1 className="mt-2 text-[24px] font-bold tracking-[-0.02em]" style={{ color: colors.t0 }}>
                    {weeklyDebriefData.weekRange}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[12px]" style={{ color: colors.t2 }}>
                      {weeklyDebriefData.sessionCount} sessions &middot; {weeklyDebriefData.tradeCount} trades
                    </span>
                    <span
                      className="rounded-[4px] border px-2 py-[2px] text-[10.5px]"
                      style={{ borderColor: colors.b1, backgroundColor: colors.d3, color: colors.t1, fontFamily: colors.mono }}
                    >
                      {weeklyDebriefData.instruments[0] ?? 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-end gap-4">
                  <svg width={sparkline.width} height={sparkline.height} viewBox={`0 0 ${sparkline.width} ${sparkline.height}`} className="shrink-0">
                    <line x1={6} y1={sparkline.baselineY} x2={sparkline.width - 6} y2={sparkline.baselineY} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                    <path d={sparkline.areaPath} fill={netRNumeric >= 0 ? 'rgba(34,214,138,0.07)' : 'rgba(255,95,95,0.09)'} />
                    <path d={sparkline.linePath} fill="none" stroke={netRNumeric >= 0 ? colors.grn : colors.red} strokeWidth="1.5" />
                    {weeklyWindow.weeklyTrades.length > 0 && (
                      <g>
                        <circle cx={sparkline.endDot.x} cy={sparkline.endDot.y} r={3} fill={netRNumeric >= 0 ? colors.grn : colors.red} />
                        <text x={sparkline.endDot.labelX} y={sparkline.endDot.y - 6} textAnchor={sparkline.endDot.textAnchor} fontSize="9" style={{ fill: netRNumeric >= 0 ? colors.grn : colors.red, fontFamily: colors.mono }}>
                          {sparkline.endDot.label}
                        </text>
                      </g>
                    )}
                  </svg>
                  <div className="pb-0.5">
                    <p className="text-[9.5px] uppercase tracking-[0.12em]" style={{ color: colors.t2 }}>Net PL</p>
                    <p className="mt-0.5 text-[36px] font-bold leading-none tracking-[-0.03em]" style={{ color: netRNumeric >= 0 ? colors.grn : colors.red, fontFamily: colors.mono }}>
                      {weeklyDebriefData.stats.netR.value}
                    </p>
                    <p className="mt-1 text-[10.5px]" style={{ color: colors.t2 }}>
                      vs {formatSignedCurrency(previousWeekPnl)} prev week
                    </p>
                  </div>
                </div>
              </div>
              {focusedTradeId && (
                <div className="mt-4 rounded-[8px] border px-4 py-3" style={{ borderColor: colors.b1, backgroundColor: colors.d2 }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[9.5px] uppercase tracking-[0.12em]" style={{ color: colors.t2 }}>Trade Deep Dive</p>
                      <p className="mt-1 text-[13px] font-semibold" style={{ color: colors.t0 }}>
                        {focusedTrade ? `${focusedTrade.symbol || 'N/A'} ${focusedTrade.direction || ''} · ${focusedTrade.trade_date || 'Unknown date'} ${focusedTrade.trade_time || ''}` : 'Trade not found in this account'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete('tradeId');
                        setSearchParams(next);
                      }}
                      className="text-[11px] underline-offset-2 hover:underline"
                      style={{ color: colors.acc }}
                    >
                      Clear focus
                    </button>
                  </div>
                  {focusedTrade ? (
                    <div className="mt-2 grid gap-2 text-[11.5px] leading-relaxed" style={{ color: colors.t1 }}>
                      <p>
                        Result: <span style={{ color: focusedTradePnl !== null && focusedTradePnl >= 0 ? colors.grn : colors.red, fontFamily: colors.mono }}>{focusedTradePnl !== null ? formatSignedCurrency(focusedTradePnl) : '$0.00'}</span>
                        {' '}({focusedTrade.pnl > 0 ? 'win' : focusedTrade.pnl < 0 ? 'loss' : 'flat'}) · P&L <span style={{ fontFamily: colors.mono }}>{formatCurrency(Number(focusedTrade.pnl || 0))}</span>
                      </p>
                      <p>
                        Plan adherence: <span style={{ color: typeof focusedTrade.followed_plan !== 'boolean' ? colors.t2 : (focusedTrade.followed_plan ? colors.grn : colors.red) }}>
                          {typeof focusedTrade.followed_plan !== 'boolean'
                            ? 'Not logged'
                            : (focusedTrade.followed_plan ? 'Followed plan' : 'Plan drift flagged')}
                        </span>
                        {' '}· Emotion: <span style={{ color: colors.t0 }}>{focusedTrade.emotional_state || 'Not logged'}</span>
                      </p>
                      <p>
                        Confluences: <span style={{ color: colors.t0 }}>{focusedTradeConfluences.length ? focusedTradeConfluences.join(', ') : 'None tagged'}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11.5px]" style={{ color: colors.t1 }}>
                      This trade ID was passed from journal, but it is not available in the currently selected account filter.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="border-t" style={{ borderColor: colors.b0 }}>
              <div className="grid grid-cols-5 gap-px" style={{ backgroundColor: colors.b0 }}>
                {statCells.map(stat => (
                  <div key={stat.label} className="px-[15px] py-[13px]" style={{ backgroundColor: colors.d1 }}>
                    <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: colors.t2 }}>{stat.label}</p>
                    <p className="mt-1 text-[16px] font-bold" style={{ color: statToneColor(stat.tone), fontFamily: colors.mono }}>
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[10px]" style={{ color: colors.t2 }}>{stat.subLabel}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="min-h-0 flex-1 overflow-y-auto border-t px-5 py-4" style={{ borderColor: colors.b0 }}>
              <section>
                <div className="flex items-center gap-3 rounded-[8px] px-[14px] py-3" style={{ backgroundColor: colors.d2, border: cardBorder }}>
                  <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border" style={{ backgroundColor: 'rgba(0,212,168,0.08)', borderColor: 'rgba(0,212,168,0.18)' }}>
                    <Clock3 size={13} color={colors.acc} />
                  </div>
                  <p className="flex-1 text-[12.5px] leading-relaxed" style={{ color: colors.t1 }}>{weeklyDebriefData.question}</p>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer text-[11.5px]"
                    style={{ color: colors.acc }}
                    onClick={() => setRespondOpen(prev => !prev)}
                  >
                    {respondOpen ? 'Cancel' : 'Respond →'}
                  </button>
                </div>
                {respondOpen && (
                  <div className="mt-2">
                    <textarea
                      className="w-full resize-none rounded-[6px] text-[12px] leading-relaxed"
                      style={{
                        backgroundColor: colors.d3,
                        border: `1px solid ${colors.b1}`,
                        color: colors.t0,
                        padding: '10px 12px',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                        minHeight: 76,
                      }}
                      placeholder="Write your honest answer here..."
                      value={respondText}
                      onChange={e => setRespondText(e.target.value)}
                    />
                    {respondText.trim() && (
                      <div className="mt-1.5 flex justify-end">
                        <button
                          type="button"
                          className="rounded-[4px] px-3 py-1 text-[11px]"
                          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: colors.acc, border: '1px solid rgba(245,158,11,0.3)' }}
                          onClick={() => { setRespondOpen(false); setRespondText(''); }}
                        >
                          Save reflection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {dataCompleteness && (dataCompleteness.emotionPct < 80 || dataCompleteness.planPct < 80) && (
                <div className="mt-3 flex items-start gap-2.5 rounded-[8px] border px-[14px] py-3" style={{ borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.06)' }}>
                  <AlertTriangle size={13} color={colors.amb} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p className="min-w-0 flex-1 text-[12px] leading-relaxed" style={{ color: colors.amb }}>
                    Debrief accuracy limited —{dataCompleteness.emotionPct < 80 && ` emotion tagged on ${dataCompleteness.emotionPct}% of trades`}{dataCompleteness.emotionPct < 80 && dataCompleteness.planPct < 80 && ','}{dataCompleteness.planPct < 80 && ` plan logged on ${dataCompleteness.planPct}%`}. Fill in the gaps for real AI insights.
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] whitespace-nowrap"
                    style={{ color: colors.amb }}
                    onClick={() => navigate('/journal')}
                  >
                    Fill gaps →
                  </button>
                </div>
              )}

              <section className="mt-4">
                <p style={tinyMetaLabelStyle}>AI insights &middot; {displayedInsights.length} found this week</p>
                <div className="mt-2 space-y-2">
                  {displayedInsights.map(insight => {
                    const style = insightTypeStyles[insight.type];
                    return (
                      <article key={insight.title} className="overflow-hidden rounded-[8px] border transition-colors hover:[border-color:var(--b1)]" style={{ borderColor: colors.b0 }}>
                        <div className="h-[2px]" style={{ backgroundColor: style.accent }} />
                        <div className="px-[14px] py-3" style={{ backgroundColor: colors.d2 }}>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="rounded-[4px] px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.05em]"
                              style={{ color: style.accent, backgroundColor: `color-mix(in srgb, ${style.accent} 10%, transparent)` }}
                            >
                              {insight.badge}
                            </span>
                            <span className="text-[10.5px]" style={{ color: colors.t2 }}>
                              {insight.frequency}
                            </span>
                          </div>
                          <h3 className="mb-1 mt-1 text-[14px] font-semibold leading-snug" style={{ color: colors.t0 }}>{insight.title}</h3>
                          <p className="mb-2 text-[12px] leading-relaxed" style={{ color: colors.t1 }}>
                            {renderBodyWithHighlights(insight.body, insight.keyPhrases)}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {insight.tags.map(tag => (
                                <span key={tag.label} style={tagStyle(tag.tone)}>
                                  {tag.label}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="shrink-0 cursor-pointer text-[11px] opacity-75 transition-opacity hover:opacity-100 flex items-center gap-0.5"
                              style={{ color: colors.acc }}
                              onClick={() => {
                                const label = insight.actionLabel.toLowerCase();
                                if (label.includes('pre-session')) navigate('/flyxa-ai/pre-session');
                                else if (label.includes('pattern library') || label.includes('confluence')) navigate('/flyxa-ai/patterns');
                                else if (label.includes('emotional') || label.includes('emotion')) navigate('/flyxa-ai/emotional-fingerprint');
                                else navigate('/journal');
                              }}
                            >
                              {insight.actionLabel}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {bestTrade && (
                <section className="mt-4 rounded-[8px] px-[14px] py-3" style={{ backgroundColor: colors.d2, border: cardBorder }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-[4px] px-2 py-[2px] text-[10px] font-semibold" style={{ color: colors.amb, backgroundColor: 'rgba(245,166,35,0.12)' }}>
                      &#9733; Top performer
                    </span>
                    <span className="text-[10.5px]" style={{ color: colors.t2 }}>
                      {bestTrade.date} &middot; {bestTrade.session} &middot; {bestTrade.time}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-bold" style={{ color: colors.t0, fontFamily: colors.mono }}>{bestTrade.symbol}</p>
                      <p className="text-[11px]" style={{ color: colors.t2 }}>{bestTrade.direction}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-bold" style={{ color: colors.grn, fontFamily: colors.mono }}>{bestTrade.resultPnl}</p>
                      <p className="text-[11px]" style={{ color: colors.t2 }}>{bestTrade.note}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-[11.5px] italic leading-snug" style={{ color: colors.t1 }}>{bestTrade.journal}</p>
                </section>
              )}
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l px-4 py-[18px]" style={{ backgroundColor: colors.d1, borderColor: colors.b0 }}>
          <section className="rounded-[8px] px-[14px] py-[14px]" style={{ backgroundColor: colors.d2, border: cardBorder }}>
            <div className="flex items-center gap-[14px]">
              <p className="text-[52px] font-bold leading-none" style={{ color: gradeColor(weekGrade), fontFamily: colors.mono }}>{weekGrade}</p>
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.12em]" style={{ color: colors.t2 }}>Process score</p>
                <p className="mt-1 text-[14px] font-bold" style={{ color: colors.t0, fontFamily: colors.mono }}>{boundedScore}/100</p>
                <p className="mt-1 text-[11px] leading-snug" style={{ color: colors.t1 }}>{gradeHint}</p>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[8px] px-[14px] py-3" style={{ backgroundColor: colors.d2, border: cardBorder }}>
            <p style={tinyMetaLabelStyle}>Process breakdown</p>
            <div className="mt-2.5 space-y-2.5">
              {weeklyDebriefData.processBreakdown.map(item => {
                const color = breakdownColor(item.value);
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11.5px]" style={{ color: colors.t1 }}>{item.label}</span>
                      <span className="text-[11.5px] font-bold" style={{ color, fontFamily: colors.mono }}>{item.value}%</span>
                    </div>
                    <div className="h-[2px] rounded-[2px]" style={{ backgroundColor: colors.d4 }}>
                      <div className="h-[2px] rounded-[2px]" style={{ width: `${item.value}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-4 rounded-[8px] px-[14px] py-3" style={{ backgroundColor: colors.d2, border: cardBorder }}>
            <p style={tinyMetaLabelStyle}>Session breakdown</p>
            <div className="mt-2.5 space-y-2.5">
              {sessionBreakdownRows.map(row => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="w-14 text-[11.5px]" style={{ color: colors.t1 }}>{row.label}</span>
                    <div className="h-[3px] flex-1 rounded-[2px]" style={{ backgroundColor: colors.d4 }}>
                      <div
                        className="h-[3px] rounded-[2px]"
                        style={{ width: `${row.barWidth}%`, backgroundColor: row.netPnl > 0 ? colors.grn : row.netPnl < 0 ? colors.red : colors.t2 }}
                      />
                    </div>
                    <span className="w-16 text-right text-[11px]" style={{ color: row.netPnl > 0 ? colors.grn : row.netPnl < 0 ? colors.red : colors.t2, fontFamily: colors.mono }}>
                      {row.trades ? formatSignedCompactCurrency(row.netPnl) : '--'}
                    </span>
                    <span className="w-8 text-right text-[10px]" style={{ color: colors.t2 }}>
                      {row.trades ? `${row.winRate}%` : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[8px] px-[14px] py-3" style={{ backgroundColor: colors.d2, border: cardBorder }}>
            <p style={tinyMetaLabelStyle}>3 things to action</p>
            <div className="mt-2.5 space-y-2.5">
              {actionItems.map((item, index) => (
                <div key={`${index}-${item}`} className="flex items-start gap-2">
                  <span className="w-5 text-[10px] font-bold opacity-65" style={{ color: colors.acc, fontFamily: colors.mono }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: colors.t1 }}>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[8px] px-[14px] py-3" style={{ backgroundColor: colors.d2, border: cardBorder }}>
            <p className="text-[12.5px] font-semibold" style={{ color: colors.t0 }}>Next debrief</p>
            <p className="mt-1 text-[11px]" style={{ color: colors.t2 }}>{weeklyDebriefData.nextDebrief.generatedOn}</p>
            <div className="mt-2 h-[2px] rounded-[2px]" style={{ backgroundColor: colors.d4 }}>
              <div className="h-[2px] rounded-[2px]" style={{ width: `${sessionsProgress}%`, backgroundColor: colors.acc }} />
            </div>
            <p className="mt-2 text-[10.5px]" style={{ color: colors.t2 }}>
              {remainingSessions} sessions remaining
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
