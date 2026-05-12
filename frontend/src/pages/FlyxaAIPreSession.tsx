import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FlyxaNav from '../components/flyxa/FlyxaNav.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { useRisk } from '../contexts/RiskContext.js';
import { useTrades } from '../hooks/useTrades.js';
import { RiskSettings, Trade } from '../types/index.js';
import { PatternItem } from './FlyxaAIPatterns.js';
import useFlyxaStore from '../store/flyxaStore.js';

type BiasValue = 'Bull' | 'Bear' | 'Neutral';
type BiasState = Record<'ES' | 'NQ', BiasValue>;
type ChecklistState = Record<string, boolean>;

type ChecklistItem = {
  id: string;
  label: string;
  source?: string;
  autoFromEmotion?: boolean;
};

type SessionPlanRow = {
  id: string;
  source: 'Primary focus' | 'Avoid today' | 'Hard stop';
  rule: string;
};

const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;

const C = {
  d0: '#0e0d0d', d1: '#141312', d2: '#1a1917', d3: '#201f1d', d4: '#27251f',
  b0: 'rgba(255,255,255,0.07)', b1: 'rgba(255,255,255,0.12)',
  t0: '#e8e3dc', t1: '#8a8178', t2: '#5c5751',
  acc: '#f59e0b', grn: '#22d68a', red: '#f05252',
};

const SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: 9.5, fontWeight: 500, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: C.t2,
};
const CARD_BORDER = `1px solid ${C.b0}`;


const emotions = ['Frustrated', 'Anxious', 'Neutral', 'Focused', 'Confident'] as const;
const biasOptions: BiasValue[] = ['Bull', 'Bear', 'Neutral'];

const mentalChecklistItems: ChecklistItem[] = [
  { id: 'mental-sleep', label: 'Slept at least 6 hours' },
  { id: 'mental-emotion', label: 'Pre-open emotion logged', autoFromEmotion: true },
  { id: 'mental-recover', label: 'Not trading to recover yesterday' },
  { id: 'mental-distractions', label: 'No distractions for next 3 hours' },
];

const baseTechnicalChecklistItems: ChecklistItem[] = [
  { id: 'technical-overnight-levels', label: 'Reviewed overnight levels' },
  { id: 'technical-platform-ready', label: 'Platform connected + charts set' },
];


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

function formatSignedR(value: number, digits = 1) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(digits)}R`;
}

function formatCurrency(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function parseRiskSettingsFromStorage(): Partial<RiskSettings> {
  if (typeof window === 'undefined') return {};
  const keys = ['risk.settings', 'tw_risk_settings', 'riskSettings', 'tw-risk-settings'];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed !== 'object' || parsed === null) continue;
      return {
        daily_loss_limit: Number(parsed.daily_loss_limit),
        max_trades_per_day: Number(parsed.max_trades_per_day),
        max_contracts_per_trade: Number(parsed.max_contracts_per_trade),
        account_size: Number(parsed.account_size),
        risk_percentage: Number(parsed.risk_percentage),
      };
    } catch {
      // Ignore malformed risk settings cache.
    }
  }
  return {};
}

function getEtParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    weekday: byType.weekday ?? 'Mon',
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

function formatDuration(minutes: number) {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getRthTiming(now: Date) {
  const et = getEtParts(now);
  const weekdayIndexMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayIndex = weekdayIndexMap[et.weekday] ?? 1;
  const isWeekday = dayIndex >= 1 && dayIndex <= 5;
  const currentMinutes = (et.hour * 60) + et.minute;
  const marketOpenNow = isWeekday && currentMinutes >= MARKET_OPEN_MINUTES && currentMinutes < MARKET_CLOSE_MINUTES;

  let minutesUntilOpen = 0;
  if (marketOpenNow) {
    minutesUntilOpen = 0;
  } else if (isWeekday && currentMinutes < MARKET_OPEN_MINUTES) {
    minutesUntilOpen = MARKET_OPEN_MINUTES - currentMinutes;
  } else {
    let daysAhead = 1;
    let nextDayIndex = (dayIndex + 1) % 7;
    while (nextDayIndex === 0 || nextDayIndex === 6) {
      daysAhead += 1;
      nextDayIndex = (nextDayIndex + 1) % 7;
    }
    const minutesToMidnight = (24 * 60) - currentMinutes;
    minutesUntilOpen = minutesToMidnight + ((daysAhead - 1) * 24 * 60) + MARKET_OPEN_MINUTES;
  }

  return {
    marketOpenToday: isWeekday,
    marketOpenNow,
    minutesUntilOpen,
  };
}

function etDateLabel(now: Date) {
  return now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function confidenceSorted(patterns: PatternItem[]) {
  return [...patterns].sort((a, b) => b.confidence - a.confidence);
}

function buildPatternInstruction(pattern: PatternItem, mode: 'watch' | 'protect') {
  if (mode === 'watch') {
    return `If ${pattern.title.toLowerCase()} shows up in ${pattern.session}, reduce one size tier and wait for full confirmation before entry.`;
  }
  return `Lean into ${pattern.title.toLowerCase()} during ${pattern.session} on ${pattern.instrument}, and keep execution exactly to your confirmed model.`;
}

function sourceBadgeStyle(source: SessionPlanRow['source']): CSSProperties {
  if (source === 'Primary focus') return { color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' };
  if (source === 'Avoid today') return { color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' };
  return { color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' };
}

function customCheckbox(checked: boolean) {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] border"
      style={{
        borderColor: checked ? '#22c55e' : 'rgba(255,255,255,0.2)',
        backgroundColor: checked ? '#22c55e' : 'transparent',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 5.1L4.1 7.2L8 3.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export default function FlyxaAIPreSession() {
  const navigate = useNavigate();
  const { trades, loading } = useTrades();
  const { filterTradesBySelectedAccount } = useAppSettings();
  const { settings } = useRisk();

  const storedPreSession = useFlyxaStore(state => state.preSession);
  const setPreSessionAction = useFlyxaStore(state => state.setPreSession);

  const [now, setNow] = useState(() => new Date());
  const [emotion, setEmotion] = useState<string>(() => (storedPreSession?.emotion ?? ''));
  const [note, setNote] = useState<string>(() => (storedPreSession?.note ?? ''));
  const [bias, setBias] = useState<BiasState>(() => (storedPreSession?.bias as BiasState ?? { ES: 'Neutral', NQ: 'Neutral' }));
  const [checklistState, setChecklistState] = useState<ChecklistState>(() => (storedPreSession?.checklistState as ChecklistState ?? {}));
  const [storedRiskSettings] = useState(() => parseRiskSettingsFromStorage());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const accountTrades = useMemo(
    () => filterTradesBySelectedAccount(trades),
    [filterTradesBySelectedAccount, trades]
  );

  const lastSession = useMemo(() => {
    const grouped = accountTrades.reduce<Map<string, Trade[]>>((map, trade) => {
      const date = parseTradeDate(trade);
      if (!date) return map;
      const key = date.toISOString().slice(0, 10);
      map.set(key, [...(map.get(key) || []), trade]);
      return map;
    }, new Map());

    const latestDate = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))[0];
    if (!latestDate) return null;
    const latestTrades = grouped.get(latestDate) || [];
    const netR = latestTrades.reduce((sum, trade) => sum + tradeR(trade), 0);
    return {
      date: latestDate,
      tradeCount: latestTrades.length,
      netR,
    };
  }, [accountTrades]);

  const recentBehavior = useMemo(() => {
    const recentTrades = [...accountTrades]
      .sort((a, b) => {
        const aDate = parseTradeDate(a)?.getTime() ?? 0;
        const bDate = parseTradeDate(b)?.getTime() ?? 0;
        return bDate - aDate;
      })
      .slice(0, 20);
    const planLogged = recentTrades.filter(trade => typeof trade.followed_plan === 'boolean');
    const planAdherence = planLogged.length > 0
      ? Math.round((planLogged.filter(trade => trade.followed_plan === true).length / planLogged.length) * 100)
      : null;
    const revengeTagged = recentTrades.filter(trade => (trade.emotional_state ?? '').toLowerCase().includes('revenge')).length;
    const emotionTagged = recentTrades.filter(trade => Boolean(trade.emotional_state?.trim())).length;

    return {
      sampleSize: recentTrades.length,
      planLogged: planLogged.length,
      planAdherence,
      revengeTagged,
      emotionTagged,
    };
  }, [accountTrades]);

  const riskLimits = useMemo(() => {
    const dailyLoss = Number.isFinite(settings?.daily_loss_limit) ? settings?.daily_loss_limit : storedRiskSettings.daily_loss_limit;
    const maxTrades = Number.isFinite(settings?.max_trades_per_day) ? settings?.max_trades_per_day : storedRiskSettings.max_trades_per_day;
    const maxContracts = Number.isFinite(settings?.max_contracts_per_trade) ? settings?.max_contracts_per_trade : storedRiskSettings.max_contracts_per_trade;
    const accountSize = Number.isFinite(settings?.account_size) ? settings?.account_size : storedRiskSettings.account_size;
    const riskPct = Number.isFinite(settings?.risk_percentage) ? settings?.risk_percentage : storedRiskSettings.risk_percentage;

    const dailyLossValue = dailyLoss && dailyLoss > 0 ? dailyLoss : 500;
    const maxTradesValue = maxTrades && maxTrades > 0 ? maxTrades : 10;
    const maxContractsValue = maxContracts && maxContracts > 0 ? maxContracts : 2;
    const accountSizeValue = accountSize && accountSize > 0 ? accountSize : 10000;
    const riskPctValue = riskPct && riskPct > 0 ? riskPct : 1;
    const riskPerTrade = (accountSizeValue * riskPctValue) / 100;
    const target = Math.max(riskPerTrade * 3, dailyLossValue * 0.6);

    return {
      maxDailyLoss: dailyLossValue,
      maxTrades: maxTradesValue,
      riskPerTrade,
      target,
      maxContracts: maxContractsValue,
      riskPct: riskPctValue,
    };
  }, [settings, storedRiskSettings]);

  const activePatterns = useMemo(
    () => [] as PatternItem[],
    []
  );
  const activeRiskPatterns = useMemo(
    () => confidenceSorted(activePatterns.filter(pattern => pattern.type === 'Risk' && pattern.status === 'Active')),
    [activePatterns]
  );
  const confirmedEdgePatterns = useMemo(
    () => confidenceSorted(activePatterns.filter(pattern => pattern.type === 'Edge' && pattern.status === 'Confirmed')),
    [activePatterns]
  );

  const technicalChecklistItems = useMemo<ChecklistItem[]>(
    () => [
      ...baseTechnicalChecklistItems,
      ...(recentBehavior.planAdherence !== null && recentBehavior.planAdherence < 80
        ? [{
            id: 'technical-plan-adherence',
            label: 'Every entry must clear your full trade plan before execution',
            source: `${recentBehavior.planAdherence}% recent plan adherence`,
          }]
        : []),
      ...activePatterns.map(pattern => ({
        id: `technical-pattern-${pattern.id}`,
        label: pattern.type === 'Risk' ? `Guard against: ${pattern.title}` : `Execute when seen: ${pattern.title}`,
        source: pattern.title,
      })),
    ],
    [activePatterns, recentBehavior.planAdherence]
  );

  const mentalChecklistWithAdaptiveItems = useMemo<ChecklistItem[]>(
    () => [
      ...mentalChecklistItems,
      ...(recentBehavior.revengeTagged > 0
        ? [{
            id: 'mental-revenge-reset',
            label: 'If frustration spikes, take a five-minute reset before re-entry',
            source: `${recentBehavior.revengeTagged} recent revenge-tagged trade${recentBehavior.revengeTagged === 1 ? '' : 's'}`,
          }]
        : []),
      ...(lastSession && lastSession.netR < 0
        ? [{
            id: 'mental-first-loss-pause',
            label: 'After the first red trade, pause before placing the next order',
            source: `Last session ${formatSignedR(lastSession.netR)}`,
          }]
        : []),
    ],
    [lastSession, recentBehavior.revengeTagged]
  );

  const sessionPlan = useMemo<SessionPlanRow[]>(() => {
    const topEdge = confirmedEdgePatterns[0];
    const topRisk = activeRiskPatterns[0];
    const recentPlanDrag = recentBehavior.planAdherence !== null && recentBehavior.planAdherence < 80;
    const recentEmotionDrag = recentBehavior.revengeTagged > 0;
    return [
      {
        id: 'focus',
        source: 'Primary focus',
        rule: topEdge
          ? `Prioritize ${topEdge.session} setups in ${topEdge.instrument}; this is your highest-confidence edge window today.`
          : 'Prioritize your cleanest A+ continuation setup window and skip marginal entries.',
      },
      {
        id: 'avoid',
        source: 'Avoid today',
        rule: topRisk
          ? `Avoid ${topRisk.title.toLowerCase()} by pausing after the first loss and requiring full checklist confirmation.`
          : recentEmotionDrag
            ? 'Do not chase recovery trades. If frustration shows up, step away before taking another setup.'
            : recentPlanDrag
              ? 'Do not take trades that skip your plan confirmation; recent execution drift says this matters today.'
              : 'Avoid unplanned entries and keep the session narrow enough to protect your best execution.',
      },
      {
        id: 'hard-stop',
        source: 'Hard stop',
        rule: `Walk away for the day at ${formatCurrency(-riskLimits.maxDailyLoss)} or after ${riskLimits.maxTrades} trades, whichever comes first.`,
      },
    ];
  }, [activeRiskPatterns, confirmedEdgePatterns, recentBehavior.planAdherence, recentBehavior.revengeTagged, riskLimits.maxDailyLoss, riskLimits.maxTrades]);

  const rthTiming = useMemo(() => getRthTiming(now), [now]);
  const greeting = now.getHours() < 12 ? 'Good morning' : 'Good afternoon';
  const subtitle = `${etDateLabel(now)} | ${
    rthTiming.marketOpenNow ? 'RTH open now' : `RTH opens in ${formatDuration(rthTiming.minutesUntilOpen)}`
  }`;
  const emotionLogged = emotion.trim().length > 0;

  const checklistTotals = useMemo(() => {
    const rows = [...mentalChecklistWithAdaptiveItems, ...technicalChecklistItems];
    const completed = rows.filter(item => (
      item.autoFromEmotion ? emotionLogged : Boolean(checklistState[item.id])
    )).length;
    return {
      completed,
      total: rows.length,
      pct: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 100,
    };
  }, [checklistState, emotionLogged, mentalChecklistWithAdaptiveItems, technicalChecklistItems]);

  const readiness = useMemo(() => {
    let score = 100;
    const reasons: string[] = [];

    if (!emotionLogged) {
      score -= 18;
      reasons.push('Emotion not logged yet.');
    }
    if (emotion === 'Frustrated') {
      score -= 24;
      reasons.push('Frustration is elevated before the open.');
    } else if (emotion === 'Anxious') {
      score -= 14;
      reasons.push('Anxiety is present; tighter entry discipline is warranted.');
    }
    if (checklistTotals.pct < 70) {
      score -= 28;
      reasons.push(`Only ${checklistTotals.completed}/${checklistTotals.total} readiness checks are complete.`);
    } else if (checklistTotals.pct < 100) {
      score -= 12;
      reasons.push(`Readiness checklist is ${checklistTotals.pct}% complete.`);
    }
    if (recentBehavior.planAdherence !== null && recentBehavior.planAdherence < 80) {
      score -= 12;
      reasons.push(`Recent plan adherence is ${recentBehavior.planAdherence}%.`);
    }
    if (recentBehavior.revengeTagged > 0) {
      score -= 14;
      reasons.push('Recent revenge-tagged behavior deserves an explicit reset rule.');
    }
    if (lastSession && lastSession.netR < -1) {
      score -= 10;
      reasons.push(`Last session closed at ${formatSignedR(lastSession.netR)}.`);
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    const status = normalizedScore >= 82 ? 'Ready' : normalizedScore >= 58 ? 'Caution' : 'Stand Down';
    const summary = status === 'Ready'
      ? 'You have a clear plan and enough preparation to trade selectively.'
      : status === 'Caution'
        ? 'The plan is usable, but one or two risk conditions deserve attention before sizing up.'
        : 'Pause before the session. Reduce pressure, finish the checks, and protect capital first.';

    return {
      status,
      score: normalizedScore,
      summary,
      reasons: reasons.slice(0, 3),
    } as const;
  }, [checklistTotals.completed, checklistTotals.pct, checklistTotals.total, emotion, emotionLogged, lastSession, recentBehavior.planAdherence, recentBehavior.revengeTagged]);

  const persistPreSession = (updates: Partial<{ emotion: string; note: string; bias: BiasState; checklistState: ChecklistState; startedAt: string | null }>) => {
    setPreSessionAction({
      emotion: updates.emotion ?? emotion,
      note: updates.note ?? note,
      bias: updates.bias ?? bias,
      checklistState: updates.checklistState ?? checklistState,
      startedAt: updates.startedAt ?? storedPreSession?.startedAt ?? null,
      readiness,
      sessionPlan,
      commitment: storedPreSession?.commitment,
    });
  };

  const setEmotionAndPersist = (nextEmotion: string) => {
    setEmotion(nextEmotion);
    persistPreSession({ emotion: nextEmotion });
  };

  const setNoteAndPersist = (nextNote: string) => {
    setNote(nextNote);
    persistPreSession({ note: nextNote });
  };

  const setBiasAndPersist = (instrument: keyof BiasState, value: BiasValue) => {
    setBias(current => {
      const next = { ...current, [instrument]: value };
      persistPreSession({ bias: next });
      return next;
    });
  };

  const toggleChecklist = (item: ChecklistItem) => {
    if (item.autoFromEmotion) return;
    setChecklistState(current => {
      const next = { ...current, [item.id]: !current[item.id] };
      persistPreSession({ checklistState: next });
      return next;
    });
  };

  const startSession = () => {
    const committedAt = new Date().toISOString();
    setPreSessionAction({
      emotion,
      note,
      bias,
      checklistState,
      startedAt: committedAt,
      readiness,
      sessionPlan,
      commitment: {
        committedAt,
        emotion,
        note,
        bias,
        checklistState,
        readiness,
        sessionPlan,
      },
    });
    navigate('/');
  };

  if (loading) {
    return (
      <div className="animate-fade-in flex h-[calc(100vh-3.5rem)] items-center justify-center rounded-2xl" style={{ backgroundColor: C.d0 }}>
        <LoadingSpinner size="lg" label="Preparing your pre-session brief..." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in h-[calc(100vh-3.5rem)] overflow-hidden rounded-2xl" style={{ backgroundColor: C.d0, color: C.t0 }}>
      <div className="grid h-full grid-cols-[178px_minmax(0,1fr)] overflow-hidden">
        <FlyxaNav />

        <main className="min-h-0 overflow-hidden" style={{ backgroundColor: C.d0 }}>
          <div className="flex h-full min-h-0 flex-col">
            <section className="border-b px-6 py-5" style={{ borderColor: C.b0 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9.5px] uppercase tracking-[0.12em]" style={{ color: C.t2 }}>Flyxa AI</p>
                  <h1 className="mt-2 text-[24px] font-bold tracking-[-0.02em]" style={{ color: C.t0 }}>{greeting}</h1>
                  <p className="mt-1 text-[12px]" style={{ color: C.t2 }}>{subtitle}</p>
                </div>
                <div className="rounded-[8px] px-3 py-2 text-right" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p className="flex items-center justify-end gap-2 text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rthTiming.marketOpenToday ? C.grn : C.t2 }} />
                    <span style={{ color: rthTiming.marketOpenToday ? C.grn : C.t1 }}>
                      {rthTiming.marketOpenToday ? 'Market open today' : 'Market closed'}
                    </span>
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: C.t1 }}>
                    {lastSession
                      ? `Last session ${formatSignedR(lastSession.netR)} (${lastSession.tradeCount} trades)`
                      : 'Last session result unavailable'}
                  </p>
                </div>
              </div>
            </section>

            <section className="border-b px-5 py-4" style={{ borderColor: C.b0, backgroundColor: C.d1 }}>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <div
                  className="rounded-[8px] border px-4 py-3"
                  style={{
                    borderColor: readiness.status === 'Ready'
                      ? 'rgba(34,214,138,0.28)'
                      : readiness.status === 'Caution'
                        ? 'rgba(245,158,11,0.28)'
                        : 'rgba(240,82,82,0.28)',
                    backgroundColor: readiness.status === 'Ready'
                      ? 'rgba(34,214,138,0.08)'
                      : readiness.status === 'Caution'
                        ? 'rgba(245,158,11,0.08)'
                        : 'rgba(240,82,82,0.08)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p style={SECTION_LABEL_STYLE}>Readiness verdict</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="rounded-[4px] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                          style={{
                            color: readiness.status === 'Ready' ? C.grn : readiness.status === 'Caution' ? C.acc : C.red,
                            backgroundColor: readiness.status === 'Ready'
                              ? 'rgba(34,214,138,0.12)'
                              : readiness.status === 'Caution'
                                ? 'rgba(245,158,11,0.12)'
                                : 'rgba(240,82,82,0.12)',
                            border: `1px solid ${readiness.status === 'Ready'
                              ? 'rgba(34,214,138,0.28)'
                              : readiness.status === 'Caution'
                                ? 'rgba(245,158,11,0.28)'
                                : 'rgba(240,82,82,0.28)'}`,
                          }}
                        >
                          {readiness.status}
                        </span>
                        <span className="font-mono text-[14px] font-semibold" style={{ color: C.t0 }}>{readiness.score}/100</span>
                      </div>
                    </div>
                    <p className="max-w-[520px] text-[12px] leading-[1.6]" style={{ color: C.t1 }}>
                      {readiness.summary}
                    </p>
                  </div>
                  {readiness.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {readiness.reasons.map(reason => (
                        <span key={reason} className="rounded-[4px] border px-2 py-1 text-[10.5px]" style={{ borderColor: C.b0, color: C.t1, backgroundColor: C.d3 }}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[8px] border px-4 py-3" style={{ borderColor: C.b0, backgroundColor: C.d2 }}>
                  <p style={SECTION_LABEL_STYLE}>Behavior scan</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-[6px] border px-2.5 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="font-mono text-[13px] font-semibold" style={{ color: recentBehavior.planAdherence !== null && recentBehavior.planAdherence < 80 ? C.acc : C.t0 }}>
                        {recentBehavior.planAdherence === null ? '—' : `${recentBehavior.planAdherence}%`}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: C.t2 }}>Plan adherence</p>
                    </div>
                    <div className="rounded-[6px] border px-2.5 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="font-mono text-[13px] font-semibold" style={{ color: recentBehavior.revengeTagged > 0 ? C.red : C.t0 }}>
                        {recentBehavior.revengeTagged}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: C.t2 }}>Revenge tags</p>
                    </div>
                    <div className="rounded-[6px] border px-2.5 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="font-mono text-[13px] font-semibold" style={{ color: C.t0 }}>
                        {checklistTotals.completed}/{checklistTotals.total}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: C.t2 }}>Checks done</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <section className="rounded-[8px] p-4" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL_STYLE}>How are you feeling?</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                    {emotions.map(item => {
                      const selected = emotion === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setEmotionAndPersist(item)}
                          className="rounded-[6px] border px-2 py-2 text-center text-[12px] font-medium"
                          style={{
                            borderColor: selected ? C.acc : C.b0,
                            backgroundColor: selected ? 'rgba(245,158,11,0.10)' : C.d3,
                            color: selected ? C.acc : C.t0,
                          }}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-3 block text-[11px]" style={{ color: C.t2 }} htmlFor="presession-note">Anything on your mind before the open?</label>
                  <textarea
                    id="presession-note"
                    value={note}
                    onChange={event => setNoteAndPersist(event.target.value)}
                    className="mt-2 h-24 w-full resize-none rounded-[6px] border px-3 py-2 text-[12px] outline-none"
                    style={{ borderColor: C.b0, backgroundColor: C.d3, color: C.t0 }}
                    placeholder="Quick pre-open note..."
                  />
                </section>

                <section className="rounded-[8px] p-4" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL_STYLE}>Today&apos;s risk limits</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-[6px] border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="text-[12px] font-semibold" style={{ color: C.red }}>{formatCurrency(-riskLimits.maxDailyLoss)}</p>
                      <p className="mt-1 text-[11px]" style={{ color: C.t2 }}>Max daily loss</p>
                    </div>
                    <div className="rounded-[6px] border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="text-[12px] font-semibold" style={{ color: C.t0 }}>{riskLimits.maxTrades}</p>
                      <p className="mt-1 text-[11px]" style={{ color: C.t2 }}>Max trades</p>
                    </div>
                    <div className="rounded-[6px] border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="text-[12px] font-semibold" style={{ color: C.t0 }}>{formatCurrency(riskLimits.riskPerTrade)} ({riskLimits.riskPct.toFixed(1)}%)</p>
                      <p className="mt-1 text-[11px]" style={{ color: C.t2 }}>Risk per trade</p>
                    </div>
                    <div className="rounded-[6px] border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="text-[12px] font-semibold" style={{ color: C.grn }}>{formatCurrency(riskLimits.target)}</p>
                      <p className="mt-1 text-[11px]" style={{ color: C.t2 }}>Session target</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[8px] p-4" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL_STYLE}>Flyxa pattern watch</p>
                  <div className="mt-3 space-y-2">
                    {activeRiskPatterns.map(pattern => (
                      <article key={`watch-${pattern.id}`} className="grid overflow-hidden rounded-[8px]" style={{ gridTemplateColumns: '4px minmax(0,1fr)', border: `1px solid ${C.red}30` }}>
                        <div style={{ backgroundColor: C.red }} />
                        <div className="px-3 py-2" style={{ backgroundColor: C.d3 }}>
                          <p className="text-[12px] font-semibold" style={{ color: C.red }}>Watch: {pattern.title}</p>
                          <p className="mt-1 text-[11px] leading-[1.6]" style={{ color: C.t1 }}>{buildPatternInstruction(pattern, 'watch')}</p>
                        </div>
                      </article>
                    ))}
                    {confirmedEdgePatterns.map(pattern => (
                      <article key={`protect-${pattern.id}`} className="grid overflow-hidden rounded-[8px]" style={{ gridTemplateColumns: '4px minmax(0,1fr)', border: `1px solid ${C.grn}30` }}>
                        <div style={{ backgroundColor: C.grn }} />
                        <div className="px-3 py-2" style={{ backgroundColor: C.d3 }}>
                          <p className="text-[12px] font-semibold" style={{ color: C.grn }}>Protect: {pattern.title}</p>
                          <p className="mt-1 text-[11px] leading-[1.6]" style={{ color: C.t1 }}>{buildPatternInstruction(pattern, 'protect')}</p>
                        </div>
                      </article>
                    ))}
                    {activeRiskPatterns.length === 0 && (
                      <div className="rounded-[8px] border px-3 py-2" style={{ borderColor: `${C.grn}30`, backgroundColor: `rgba(34,214,138,0.07)` }}>
                        <p className="text-[12px] font-semibold" style={{ color: C.grn }}>No active risk flags today</p>
                        <p className="mt-1 text-[11px]" style={{ color: C.t1 }}>Keep your process tight and continue executing your highest-confidence setups.</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[8px] p-4" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL_STYLE}>Market context</p>
                  <div className="mt-3 space-y-3">
                    {(['ES', 'NQ'] as const).map(instrument => (
                      <div key={instrument}>
                        <p className="text-[11px]" style={{ color: C.t2 }}>{instrument} bias</p>
                        <div className="mt-1 flex gap-2">
                          {biasOptions.map(option => {
                            const selected = bias[instrument] === option;
                            return (
                              <button
                                key={`${instrument}-${option}`}
                                type="button"
                                onClick={() => setBiasAndPersist(instrument, option)}
                                className="rounded-[4px] border px-3 py-1 text-[11px]"
                                style={{
                                  borderColor: selected ? C.acc : C.b0,
                                  backgroundColor: selected ? 'rgba(245,158,11,0.10)' : C.d3,
                                  color: selected ? C.acc : C.t1,
                                }}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-[6px] border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                      <p className="text-[11px]" style={{ color: C.t2 }}>News today</p>
                      <p className="mt-1 text-[12px]" style={{ color: C.t0 }}>No major news</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[8px] p-4 xl:col-span-2" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL_STYLE}>Pre-session checklist</p>
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: C.t1 }}>Mental checks</p>
                      <div className="mt-2 space-y-2">
                        {mentalChecklistWithAdaptiveItems.map(item => {
                          const checked = item.autoFromEmotion ? emotionLogged : Boolean(checklistState[item.id]);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleChecklist(item)}
                              className="flex w-full items-start gap-2 rounded-[6px] border px-2.5 py-2 text-left"
                              style={{ borderColor: C.b0, backgroundColor: C.d3 }}
                            >
                              {customCheckbox(checked)}
                              <div>
                                <p className="text-[12px]" style={{ color: C.t0 }}>{item.label}</p>
                                {item.autoFromEmotion && <p className="text-[10px]" style={{ color: C.t2 }}>Auto-linked to emotion log</p>}
                                {item.source && <p className="text-[10px]" style={{ color: C.t2 }}>{item.source}</p>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: C.t1 }}>Technical checks</p>
                      <div className="mt-2 space-y-2">
                        {technicalChecklistItems.map(item => {
                          const checked = Boolean(checklistState[item.id]);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleChecklist(item)}
                              className="flex w-full items-start gap-2 rounded-[6px] border px-2.5 py-2 text-left"
                              style={{ borderColor: C.b0, backgroundColor: C.d3 }}
                            >
                              {customCheckbox(checked)}
                              <div>
                                <p className="text-[12px]" style={{ color: C.t0 }}>{item.label}</p>
                                {item.source && <p className="text-[10px]" style={{ color: C.t2 }}>From pattern: {item.source}</p>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[8px] p-4 xl:col-span-2" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL_STYLE}>Today&apos;s session plan</p>
                  <div className="mt-3 space-y-2">
                    {sessionPlan.map((row, index) => (
                      <div key={row.id} className="flex items-start gap-3 rounded-[6px] border px-3 py-2" style={{ borderColor: C.b0, backgroundColor: C.d3 }}>
                        <span className="mt-0.5 text-[11px]" style={{ color: C.t2 }}>{index + 1}.</span>
                        <p className="flex-1 text-[12px] leading-[1.6]" style={{ color: C.t0 }}>{row.rule}</p>
                        <span className="shrink-0 rounded-[4px] px-2 py-[3px] text-[10px] font-semibold uppercase" style={{ ...sourceBadgeStyle(row.source), letterSpacing: '0.08em' }}>
                          {row.source}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[8px] p-4 xl:col-span-2" style={{ backgroundColor: C.d2, border: CARD_BORDER }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={startSession}
                      className="rounded-[6px] border px-4 py-2 text-[12px] font-semibold"
                      style={{ borderColor: C.acc, backgroundColor: C.acc, color: '#0e0d0d' }}
                    >
                      Start session — I&apos;m ready to trade
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="rounded-[6px] border px-4 py-2 text-[12px] font-semibold"
                      style={{ borderColor: C.b1, backgroundColor: 'transparent', color: C.t1 }}
                    >
                      Skip brief and go to dashboard
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
