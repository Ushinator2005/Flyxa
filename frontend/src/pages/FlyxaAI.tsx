import { CSSProperties, useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
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
type ConfluenceHighlight = { label: string; trades: number; winRate: number; netR: number; avgR: number };

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
  history: Array<{ label: string; resultR: string; sessions: number }>;
};


const insightTypeStyles: Record<InsightType, { accent: string; badgeBg: string; badgeText: string }> = {
  risk: { accent: '#ef4444', badgeBg: 'rgba(239,68,68,0.1)', badgeText: '#ef4444' },
  pattern: { accent: '#4a9eff', badgeBg: 'rgba(74,158,255,0.1)', badgeText: '#4a9eff' },
  psychology: { accent: '#f59e0b', badgeBg: 'rgba(245,158,11,0.1)', badgeText: '#f59e0b' },
  edge: { accent: '#22c55e', badgeBg: 'rgba(34,197,94,0.1)', badgeText: '#22c55e' },
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#64748b',
};

const cardBorder = '1px solid rgba(255,255,255,0.07)';

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

function parseTradeDate(trade: Trade): Date | null {
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

function parseTradeDateTime(trade: Trade): Date | null {
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

function tradeMinutes(trade: Trade): number | null {
  if (!trade.trade_time) return null;
  const [h, m] = trade.trade_time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return (h * 60) + m;
}

function tradeSessionKey(trade: Trade) {
  const date = parseTradeDate(trade);
  return date ? date.toISOString().slice(0, 10) : '';
}

function formatWeekRange(start: Date, end: Date) {
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`;
}

function formatSignedR(value: number, digits = 1) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(digits)}R`;
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

function tradeR(trade: Trade): number {
  const riskPoints = Math.abs(trade.entry_price - trade.sl_price);
  if (riskPoints > 0) {
    const size = trade.contract_size > 0 ? trade.contract_size : 1;
    const pointValue = trade.point_value > 0 ? trade.point_value : 1;
    const riskCash = riskPoints * size * pointValue;
    if (riskCash > 0) return trade.pnl / riskCash;
  }
  if (trade.pnl > 0) return 1;
  if (trade.pnl < 0) return -1;
  return 0;
}

function summarize(trades: Trade[]) {
  const rs = trades.map(tradeR);
  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl < 0);
  const winnerRs = winners.map(tradeR);
  const loserRs = losers.map(tradeR);
  return {
    netR: rs.reduce((s, r) => s + r, 0),
    avgR: avg(rs),
    winRate: pct(winners.length, winners.length + losers.length),
    wins: winners.length,
    losses: losers.length,
    avgWinnerR: avg(winnerRs),
    avgLoserR: avg(loserRs),
    bestR: winnerRs.length ? Math.max(...winnerRs) : 0,
    worstR: loserRs.length ? Math.min(...loserRs) : 0,
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

  const plan = Math.round(pct(trades.filter(t => t.followed_plan).length, trades.length));
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
    const planOk = curr.followed_plan ? 1 : 0;
    postLossTotal += ((sizeOk + waitOk + planOk) / 3) * 100;
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
  if (tone === 'positive') return '#34d399';
  if (tone === 'negative') return '#f87171';
  if (tone === 'info') return '#4a9eff';
  return '#e2e8f0';
}

function tagStyle(tone: TagTone): CSSProperties {
  if (tone === 'positive') return { color: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' };
  if (tone === 'negative') return { color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' };
  return { color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' };
}

function breakdownColor(value: number) {
  if (value >= 75) return '#22c55e';
  if (value >= 55) return '#f59e0b';
  return '#ef4444';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderBodyWithHighlights(body: string, keyPhrases: string[]) {
  if (!keyPhrases.length) return body;
  const lookup = new Set(keyPhrases.map(k => k.toLowerCase()));
  const pattern = new RegExp(`(${keyPhrases.map(escapeRegExp).join('|')})`, 'gi');
  return body.split(pattern).map((segment, idx) => (
    <span key={`${segment}-${idx}`} style={{ color: lookup.has(segment.toLowerCase()) ? '#64748b' : '#475569' }}>
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
        netR: { label: 'Net R', value: '0.0R', subLabel: 'No trades logged this week', tone: 'neutral' },
        winRate: { label: 'Win Rate', value: '0%', subLabel: '0W / 0L', tone: 'neutral' },
        avgWinner: { label: 'Avg Winner', value: '0.0R', subLabel: 'Need trade samples', tone: 'neutral' },
        avgLoser: { label: 'Avg Loser', value: '0.0R', subLabel: 'Need trade samples', tone: 'neutral' },
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
      history: [],
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
    .sort((a, b) => a.summary.netR - b.summary.netR);
  const weakestState = rankedStates[0];
  const strongestState = rankedStates[rankedStates.length - 1];

  const sessionGroups = new Map<string, Trade[]>();
  weekly.forEach(trade => {
    const session = trade.session || 'Other';
    sessionGroups.set(session, [...(sessionGroups.get(session) ?? []), trade]);
  });
  const bestSession = Array.from(sessionGroups.entries())
    .map(([session, entries]) => ({ session, entries, summary: summarize(entries) }))
    .sort((a, b) => b.summary.netR - a.summary.netR)[0];

  const confluenceGroups = new Map<string, {
    label: string;
    trades: number;
    wins: number;
    netR: number;
  }>();
  weekly.forEach(trade => {
    const tradeConfluences = normalizeConfluences(trade.confluences);
    if (!tradeConfluences.length) return;
    const tradeConfluenceSet = new Set(tradeConfluences.map(confluence => confluence.toLowerCase()));
    const currentR = tradeR(trade);

    tradeConfluenceSet.forEach(confluenceKey => {
      const label = tradeConfluences.find(confluence => confluence.toLowerCase() === confluenceKey) ?? confluenceKey;
      const current = confluenceGroups.get(confluenceKey) ?? {
        label,
        trades: 0,
        wins: 0,
        netR: 0,
      };
      current.trades += 1;
      current.netR += currentR;
      if (trade.pnl > 0) current.wins += 1;
      confluenceGroups.set(confluenceKey, current);
    });
  });
  const confluenceLeaders: ConfluenceHighlight[] = Array.from(confluenceGroups.values())
    .map(item => ({
      ...item,
      winRate: item.trades > 0 ? pct(item.wins, item.trades) : 0,
      avgR: item.trades > 0 ? item.netR / item.trades : 0,
    }))
    .sort((a, b) => b.netR - a.netR);
  const topConfluence = confluenceLeaders[0];
  const weakestConfluence = [...confluenceLeaders]
    .filter(item => item.netR < 0)
    .sort((a, b) => a.netR - b.netR)[0];

  const weakestProcess = [...weeklyProcess.items].sort((a, b) => a.value - b.value)[0];
  const question = weakestProcess?.label === 'Entry patience'
    ? 'Which entries this week were taken too early, and what confirmation were you still waiting for?'
    : weakestProcess?.label === 'Post-loss mgmt'
      ? 'After your losing trades, where did you reset well and where did you press too quickly?'
      : weakestProcess?.label === 'Size discipline'
        ? 'Where did your size deviate from plan, and what triggered it?'
        : weakestConfluence
          ? `How can you tighten or avoid "${weakestConfluence.label}" when it has cost ${formatSignedR(weakestConfluence.netR)} this week?`
          : 'Which losing trades came from plan drift, and what rule would have prevented them?';

  const insights: WeeklyInsight[] = [
    {
      type: 'risk',
      badge: 'Risk Flag',
      frequency: earlyTrades.length ? `Seen in ${earlySessions} sessions` : 'No early-session entries this week',
      title: earlyTrades.length ? 'Open-hour entries are the main risk drag this week' : 'Open-hour risk stayed controlled this week',
      body: earlyTrades.length
        ? `You logged ${earlyTrades.length} trades before 10:00 for ${formatSignedR(earlySummary.netR)}. After 10:00, average trade improved to ${formatSignedR(lateSummary.avgR)}.`
        : 'No trades were logged before 10:00, removing your highest-risk overtrading window.',
      keyPhrases: earlyTrades.length
        ? [String(earlyTrades.length), 'before 10:00', formatSignedR(earlySummary.netR), 'After 10:00', formatSignedR(lateSummary.avgR)]
        : ['before 10:00', 'highest-risk overtrading window'],
      tags: earlyTrades.length
        ? [
            { label: `${formatSignedR(earlySummary.netR)} pre-10:00`, tone: earlySummary.netR >= 0 ? 'positive' : 'negative' },
            { label: `${earlyTrades.length} open-hour trades`, tone: 'neutral' },
            { label: `${formatSignedR(lateSummary.avgR)} avg after 10:00`, tone: lateSummary.avgR >= 0 ? 'positive' : 'negative' },
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
        ? `${topSymbolName} closed at ${formatSignedR(topSymbolSummary.netR)} with ${Math.round(topSymbolSummary.winRate)}% win rate across ${topSymbol[1].length} trades.`
        : 'Log more symbol-tagged trades to activate recurring pattern detection.',
      keyPhrases: topSymbol
        ? [topSymbolName, formatSignedR(topSymbolSummary.netR), `${Math.round(topSymbolSummary.winRate)}%`, `${topSymbol[1].length} trades`]
        : ['symbol-tagged trades', 'pattern detection'],
      tags: topSymbol
        ? [
            { label: `${formatSignedR(topSymbolSummary.netR)} on ${topSymbolName}`, tone: topSymbolSummary.netR >= 0 ? 'positive' : 'negative' },
            { label: `${Math.round(topSymbolSummary.winRate)}% win rate`, tone: topSymbolSummary.winRate >= 50 ? 'positive' : 'negative' },
          ]
        : [{ label: 'Need more samples', tone: 'neutral' }],
      actionLabel: 'Promote to pattern library ->',
    },
    {
      type: 'psychology',
      badge: 'Psychology',
      frequency: `${stateGroups.size} emotional states logged`,
      title: 'Emotional state is materially impacting your outcomes',
      body: weakestState && strongestState
        ? `"${weakestState.state}" averaged ${formatSignedR(weakestState.summary.avgR)} while "${strongestState.state}" averaged ${formatSignedR(strongestState.summary.avgR)} this week.`
        : 'Add emotional_state tags to unlock behavior-performance insights.',
      keyPhrases: weakestState && strongestState
        ? [`"${weakestState.state}"`, formatSignedR(weakestState.summary.avgR), `"${strongestState.state}"`, formatSignedR(strongestState.summary.avgR)]
        : ['emotional_state tags', 'behavior-performance insights'],
      tags: weakestState && strongestState
        ? [
            { label: `${weakestState.state}: ${formatSignedR(weakestState.summary.netR)}`, tone: weakestState.summary.netR >= 0 ? 'positive' : 'negative' },
            { label: `${strongestState.state}: ${formatSignedR(strongestState.summary.netR)}`, tone: strongestState.summary.netR >= 0 ? 'positive' : 'negative' },
          ]
        : [{ label: 'Need state tags', tone: 'neutral' }],
      actionLabel: 'Create emotional reset rule ->',
    },
    {
      type: 'edge',
      badge: 'Edge Confirmed',
      frequency: bestSession ? `${bestSession.session} led this week` : 'No clear session edge this week',
      title: bestSession ? `${bestSession.session} is your strongest edge window this week` : 'Session edge needs more data',
      body: bestSession
        ? `${bestSession.session} delivered ${formatSignedR(bestSession.summary.netR)} at ${Math.round(bestSession.summary.winRate)}% over ${bestSession.entries.length} trades.`
        : 'Keep logging session tags to reveal your strongest time-window edge.',
      keyPhrases: bestSession
        ? [bestSession.session, formatSignedR(bestSession.summary.netR), `${Math.round(bestSession.summary.winRate)}%`, `${bestSession.entries.length} trades`]
        : ['session tags', 'time-window edge'],
      tags: bestSession
        ? [
            { label: `${formatSignedR(bestSession.summary.netR)} net`, tone: bestSession.summary.netR >= 0 ? 'positive' : 'negative' },
            { label: `${Math.round(bestSession.summary.winRate)}% win rate`, tone: bestSession.summary.winRate >= 50 ? 'positive' : 'negative' },
            { label: `${bestSession.entries.length} trades`, tone: 'neutral' },
          ]
        : [{ label: 'Need session samples', tone: 'neutral' }],
      actionLabel: 'Add to pre-session brief ->',
    },
  ];

  if (topConfluence) {
    insights.push({
      type: topConfluence.netR >= 0 ? 'edge' : 'risk',
      badge: 'Confluence Signal',
      frequency: `${topConfluence.trades} trades logged with "${topConfluence.label}"`,
      title: topConfluence.netR >= 0
        ? `"${topConfluence.label}" is your highest-conviction confluence this week`
        : `"${topConfluence.label}" needs review before reuse`,
      body: `"${topConfluence.label}" returned ${formatSignedR(topConfluence.netR)} total (${formatSignedR(topConfluence.avgR)} avg) with ${Math.round(topConfluence.winRate)}% win rate.`,
      keyPhrases: [
        `"${topConfluence.label}"`,
        formatSignedR(topConfluence.netR),
        formatSignedR(topConfluence.avgR),
        `${Math.round(topConfluence.winRate)}%`,
      ],
      tags: [
        { label: `${topConfluence.trades} tagged trades`, tone: 'neutral' },
        { label: `${Math.round(topConfluence.winRate)}% win rate`, tone: topConfluence.winRate >= 50 ? 'positive' : 'negative' },
        { label: `${formatSignedR(topConfluence.netR)} net`, tone: topConfluence.netR >= 0 ? 'positive' : 'negative' },
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

  const history = Array.from({ length: 4 }, (_, idx) => {
    const start = addDays(weekStart, -7 * (idx + 1));
    const end = addDays(start, 6);
    const bucket = ordered.filter(t => inRange(t, start, end));
    const bucketSummary = summarize(bucket);
    const sessions = new Set(bucket.map(tradeSessionKey).filter(Boolean)).size;
    const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { label: `${label} debrief`, resultR: formatSignedR(bucketSummary.netR), sessions };
  });

  return {
    weekRange: formatWeekRange(weekStart, weekEnd),
    sessionCount,
    tradeCount: weekly.length,
    instruments,
    stats: {
      netR: { label: 'Net R', value: formatSignedR(weeklySummary.netR), subLabel: `vs ${formatSignedR(previousSummary.netR)} prev week`, tone: weeklySummary.netR >= 0 ? 'positive' : 'negative' },
      winRate: { label: 'Win Rate', value: `${Math.round(weeklySummary.winRate)}%`, subLabel: `${weeklySummary.wins}W / ${weeklySummary.losses}L`, tone: 'neutral' },
      avgWinner: { label: 'Avg Winner', value: formatSignedR(weeklySummary.avgWinnerR), subLabel: `Best ${formatSignedR(weeklySummary.bestR)}`, tone: weeklySummary.avgWinnerR >= 0 ? 'positive' : 'neutral' },
      avgLoser: { label: 'Avg Loser', value: formatSignedR(weeklySummary.avgLoserR), subLabel: `Worst ${formatSignedR(weeklySummary.worstR)}`, tone: weeklySummary.avgLoserR < 0 ? 'negative' : 'neutral' },
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
    history,
  };
}

export default function FlyxaAI() {
  const { trades, loading } = useTrades();
  const { filterTradesBySelectedAccount } = useAppSettings();

  const accountTrades = useMemo(
    () => filterTradesBySelectedAccount(trades),
    [filterTradesBySelectedAccount, trades]
  );
  const weeklyDebriefData = useMemo(
    () => buildData(accountTrades),
    [accountTrades]
  );

  const sessionsProgress = Math.min(100, (weeklyDebriefData.nextDebrief.sessionsLogged / weeklyDebriefData.nextDebrief.sessionsTarget) * 100);
  const processScoreNumeric = Number.parseInt(weeklyDebriefData.stats.processScore.value, 10);
  const statsColumns = [
    weeklyDebriefData.stats.netR,
    weeklyDebriefData.stats.winRate,
    weeklyDebriefData.stats.avgWinner,
    weeklyDebriefData.stats.avgLoser,
    weeklyDebriefData.stats.processScore,
  ];

  if (loading) {
    return (
      <div className="animate-fade-in -m-8 flex h-[calc(100vh-3.5rem)] items-center justify-center bg-[#060a12]">
        <LoadingSpinner size="lg" label="Analyzing your trade journal..." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in -m-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#060a12] text-[#e2e8f0]">
      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[200px_minmax(0,1fr)_220px]">
        <aside className="min-h-0 overflow-y-auto border-r border-white/10 px-3 py-4" style={{ backgroundColor: '#080d18' }}>
          <p style={sectionLabelStyle}>Flyxa AI</p>
          <nav className="mt-4 space-y-1">
            {[
              { key: 'weekly',      label: 'Weekly debrief',       to: '/flyxa-ai',                       end: true  },
              { key: 'pattern',     label: 'Pattern library',       to: '/flyxa-ai/patterns',              end: false },
              { key: 'pre-session', label: 'Pre-session brief',     to: '/flyxa-ai/pre-session',           end: false },
              { key: 'emotional',   label: 'Emotional fingerprint', to: '/flyxa-ai/emotional-fingerprint', end: false },
              { key: 'ask',         label: 'Ask Flyxa',             to: '/flyxa-ai/ask',                   end: false },
            ].map(item => (
              <NavLink key={item.key} to={item.to} end={item.end}>
                {({ isActive }) => (
                  <span
                    className="flex w-full items-center gap-2 text-sm transition-colors"
                    style={{
                      color: isActive ? '#c7d2fe' : '#94a3b8',
                      backgroundColor: isActive ? 'rgba(74,158,255,0.12)' : 'transparent',
                      borderRight: isActive ? '2px solid #4a9eff' : '2px solid transparent',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 6,
                      display: 'flex',
                    }}
                  >
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: isActive ? '#4a9eff' : '#64748b' }} />
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 border-t border-white/10 pt-4">
            <p style={sectionLabelStyle}>History</p>
            <div className="mt-3 space-y-2">
              {weeklyDebriefData.history.map(item => (
                <button key={item.label} type="button" className="w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-white/10 hover:bg-[#0d1526]">
                  <p className="text-[12px] text-[#cbd5e1]">{item.label}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span style={{ color: item.resultR.startsWith('+') ? '#34d399' : '#f87171' }}>{item.resultR}</span>
                    <span className="text-[#64748b]">{item.sessions} sessions</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-hidden border-r border-white/10" style={{ backgroundColor: '#060a12' }}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/10 px-5 py-5">
              <p style={sectionLabelStyle}>Weekly Debrief</p>
              <h1 className="mt-2 text-[22px] font-semibold text-[#e2e8f0]">{weeklyDebriefData.weekRange}</h1>
              <p className="mt-1 text-[12px] text-[#64748b]">{weeklyDebriefData.sessionCount} sessions | {weeklyDebriefData.tradeCount} trades logged</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {weeklyDebriefData.instruments.length > 0 ? weeklyDebriefData.instruments.map(instrument => (
                  <span key={instrument} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#cbd5e1]" style={{ backgroundColor: '#0d1526' }}>
                    {instrument}
                  </span>
                )) : (
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#64748b]" style={{ backgroundColor: '#0d1526' }}>
                    No instruments this week
                  </span>
                )}
              </div>
            </div>

            <section className="mx-5 mt-4 grid overflow-hidden rounded-xl" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', backgroundColor: '#0d1526', border: cardBorder }}>
              {statsColumns.map((stat, index) => (
                <div key={stat.label} className="px-3 py-3" style={{ borderRight: index < statsColumns.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                  <p style={sectionLabelStyle}>{stat.label}</p>
                  <p className="mt-1 text-[24px] font-semibold" style={{ color: statToneColor(stat.tone) }}>{stat.value}</p>
                  <p className="mt-1 text-[11px] text-[#64748b]">{stat.subLabel}</p>
                </div>
              ))}
            </section>

            <section className="mx-5 mt-4 rounded-xl border-l-[1px] px-4 py-4" style={{ backgroundColor: '#0d1526', border: cardBorder, borderLeftColor: '#4a9eff', borderLeftWidth: 4 }}>
              <div className="flex items-center gap-2">
                <HelpCircle size={14} color="#4a9eff" />
                <p style={{ ...sectionLabelStyle, color: '#4a9eff' }}>This Week&apos;s Question</p>
              </div>
              <p className="mt-2 text-[13px] italic leading-[1.65] text-[#64748b]">{weeklyDebriefData.question}</p>
              <button type="button" className="mt-3 text-[12px] font-medium text-[#4a9eff]">Respond to this -&gt;</button>
            </section>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
              <div className="space-y-3">
                {weeklyDebriefData.insights.map(insight => {
                  const style = insightTypeStyles[insight.type];
                  return (
                    <article key={insight.title} className="grid overflow-hidden rounded-xl" style={{ gridTemplateColumns: '4px minmax(0, 1fr)', backgroundColor: '#0d1526', border: cardBorder }}>
                      <div style={{ backgroundColor: style.accent }} />
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: style.badgeText, backgroundColor: style.badgeBg, border: `1px solid ${style.badgeBg.replace('0.1', '0.3')}` }}>
                            {insight.badge}
                          </span>
                          <span className="text-[11px] text-[#64748b]">{insight.frequency}</span>
                        </div>
                        <h3 className="mt-2 text-[14px] font-semibold text-[#e2e8f0]">{insight.title}</h3>
                        <p className="mt-1.5 text-[12px] leading-[1.65] text-[#475569]">{renderBodyWithHighlights(insight.body, insight.keyPhrases)}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {insight.tags.map(tag => (
                              <span key={tag.label} className="rounded-full px-2 py-[3px] text-[11px]" style={tagStyle(tag.tone)}>
                                {tag.label}
                              </span>
                            ))}
                          </div>
                          <button type="button" className="shrink-0 text-[11px] font-medium text-[#4a9eff]">{insight.actionLabel}</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto px-3 py-4" style={{ backgroundColor: '#080d18' }}>
          <section className="rounded-xl px-3.5 py-3" style={{ backgroundColor: '#0d1526', border: cardBorder }}>
            <p style={sectionLabelStyle}>Process Score</p>
            <p className="mt-2 text-[30px] font-semibold text-[#e2e8f0]">{weeklyDebriefData.stats.processScore.value}</p>
            <p className="text-[11px] text-[#64748b]">{weeklyDebriefData.stats.processScore.subLabel}</p>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full" style={{ width: `${processScoreNumeric}%`, backgroundColor: '#4a9eff' }} />
            </div>
            <div className="mt-4 space-y-2.5">
              {weeklyDebriefData.processBreakdown.map(item => {
                const color = breakdownColor(item.value);
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-[#94a3b8]">{item.label}</span>
                      <span style={{ color }}>{item.value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full" style={{ width: `${item.value}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-3 rounded-xl px-3.5 py-3" style={{ backgroundColor: '#0d1526', border: '1px solid #4a9eff' }}>
            <p style={sectionLabelStyle}>This Week&apos;s Focus</p>
            <p className="mt-1 text-[12px] font-semibold text-[#4a9eff]">3 things to action</p>
            <div className="mt-2.5 space-y-2">
              {weeklyDebriefData.focusItems.map(item => (
                <div key={item} className="flex items-start gap-2 text-[12px] leading-[1.5] text-[#94a3b8]">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#4a9eff]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 rounded-xl px-3.5 py-3" style={{ backgroundColor: '#0d1526', border: cardBorder }}>
            <p style={sectionLabelStyle}>Confluences</p>
            <p className="mt-1 text-[12px] text-[#94a3b8]">Top outcomes this week</p>
            <div className="mt-2.5 space-y-2">
              {weeklyDebriefData.confluences.length > 0 ? weeklyDebriefData.confluences.map(item => (
                <div key={item.label} className="rounded-md border border-white/10 bg-[#0a101d] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] text-[#e2e8f0]">{item.label}</p>
                    <span className={`text-[11px] font-medium ${item.netR >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatSignedR(item.netR)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748b]">{item.trades} trades | {Math.round(item.winRate)}% win | {formatSignedR(item.avgR)} avg</p>
                </div>
              )) : (
                <p className="text-[11px] text-[#64748b]">No confluence tags logged this week.</p>
              )}
            </div>
          </section>

          <section className="mt-3 rounded-xl px-3.5 py-3" style={{ backgroundColor: '#0d1526', border: cardBorder }}>
            <p style={sectionLabelStyle}>Next Debrief</p>
            <p className="mt-2 text-[12px] text-[#94a3b8]">Generates {weeklyDebriefData.nextDebrief.generatedOn}</p>
            <p className="mt-2 text-[11px] text-[#64748b]">{weeklyDebriefData.nextDebrief.sessionsLogged} of {weeklyDebriefData.nextDebrief.sessionsTarget} sessions</p>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-[#4a9eff]" style={{ width: `${sessionsProgress}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-[#64748b]">{Math.max(0, weeklyDebriefData.nextDebrief.sessionsTarget - weeklyDebriefData.nextDebrief.sessionsLogged)} remaining</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
