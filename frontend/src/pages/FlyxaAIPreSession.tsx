import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FlyxaNav from '../components/flyxa/FlyxaNav.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { useRisk } from '../contexts/RiskContext.js';
import { useTrades } from '../hooks/useTrades.js';
import { RiskSettings, Trade } from '../types/index.js';
import { PatternItem, patternsData } from './FlyxaAIPatterns.js';

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
  source: 'Edge confirmed' | 'Risk flag' | 'News event' | 'Risk limit';
  rule: string;
};

const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;
const SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#64748b',
};
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)';


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

function readJsonFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

function etIsoDate(now: Date) {
  const et = getEtParts(now);
  const month = String(et.month).padStart(2, '0');
  const day = String(et.day).padStart(2, '0');
  return `${et.year}-${month}-${day}`;
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
  if (source === 'Edge confirmed') return { color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' };
  if (source === 'Risk flag') return { color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' };
  if (source === 'News event') return { color: '#4a9eff', backgroundColor: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)' };
  return { color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' };
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

  const [now, setNow] = useState(() => new Date());
  const [emotion, setEmotion] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('presession.emotion') || '';
  });
  const [note, setNote] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('presession.note') || '';
  });
  const [bias, setBias] = useState<BiasState>(() => readJsonFromStorage<BiasState>('presession.bias', { ES: 'Neutral', NQ: 'Neutral' }));
  const [checklistState, setChecklistState] = useState<ChecklistState>(() => readJsonFromStorage<ChecklistState>('presession.checklist', {}));
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
    () => patternsData.filter(pattern => pattern.status !== 'Resolved'),
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
      ...activePatterns.map(pattern => ({
        id: `technical-pattern-${pattern.id}`,
        label: pattern.type === 'Risk' ? `Guard against: ${pattern.title}` : `Execute when seen: ${pattern.title}`,
        source: pattern.title,
      })),
    ],
    [activePatterns]
  );

  const sessionPlan = useMemo<SessionPlanRow[]>(() => {
    const topEdge = confirmedEdgePatterns[0];
    const topRisk = activeRiskPatterns[0];
    return [
      {
        id: 'edge',
        source: 'Edge confirmed',
        rule: topEdge
          ? `Prioritize ${topEdge.session} setups in ${topEdge.instrument}; this is your highest-confidence edge window today.`
          : 'Prioritize your cleanest A+ continuation setup window and skip marginal entries.',
      },
      {
        id: 'risk',
        source: 'Risk flag',
        rule: topRisk
          ? `Avoid ${topRisk.title.toLowerCase()} by pausing after the first loss and requiring full checklist confirmation.`
          : 'No active risk flags today. Keep discipline and avoid unplanned entries.',
      },
      {
        id: 'news',
        source: 'News event',
        rule: 'No major news on the calendar. If surprise headlines hit, reduce size by 30% until volatility settles.',
      },
      {
        id: 'limits',
        source: 'Risk limit',
        rule: `Walk away for the day at ${formatCurrency(-riskLimits.maxDailyLoss)} or after ${riskLimits.maxTrades} trades, whichever comes first.`,
      },
    ];
  }, [confirmedEdgePatterns, activeRiskPatterns, riskLimits.maxDailyLoss, riskLimits.maxTrades]);

  const rthTiming = useMemo(() => getRthTiming(now), [now]);
  const greeting = now.getHours() < 12 ? 'Good morning' : 'Good afternoon';
  const subtitle = `${etDateLabel(now)} | ${
    rthTiming.marketOpenNow ? 'RTH open now' : `RTH opens in ${formatDuration(rthTiming.minutesUntilOpen)}`
  }`;
  const emotionLogged = emotion.trim().length > 0;

  const setEmotionAndPersist = (nextEmotion: string) => {
    setEmotion(nextEmotion);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('presession.emotion', nextEmotion);
    }
  };

  const setNoteAndPersist = (nextNote: string) => {
    setNote(nextNote);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('presession.note', nextNote);
    }
  };

  const setBiasAndPersist = (instrument: keyof BiasState, value: BiasValue) => {
    setBias(current => {
      const next = { ...current, [instrument]: value };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('presession.bias', JSON.stringify(next));
      }
      return next;
    });
  };

  const toggleChecklist = (item: ChecklistItem) => {
    if (item.autoFromEmotion) return;
    setChecklistState(current => {
      const next = { ...current, [item.id]: !current[item.id] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('presession.checklist', JSON.stringify(next));
      }
      return next;
    });
  };

  const startSession = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('presession.startedAt', new Date().toISOString());
    }
    navigate(`/journal?date=${etIsoDate(now)}`);
  };

  if (loading) {
    return (
      <div className="animate-fade-in -m-8 flex h-[calc(100vh-3.5rem)] items-center justify-center bg-[#060a12]">
        <LoadingSpinner size="lg" label="Preparing your pre-session brief..." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in -m-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#060a12] text-[#e2e8f0]">
      <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] overflow-hidden">
        <FlyxaNav />

        <main className="min-h-0 overflow-y-auto px-5 py-5">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p style={SECTION_LABEL_STYLE}>Pre-session Brief</p>
              <h1 className="mt-1 text-[24px] font-semibold text-[#e2e8f0]">{greeting}</h1>
              <p className="mt-1 text-[12px] text-[#64748b]">{subtitle}</p>
            </div>
            <div className="rounded-xl px-3 py-2 text-right" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p className="flex items-center justify-end gap-2 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rthTiming.marketOpenToday ? '#22c55e' : '#64748b' }} />
                <span style={{ color: rthTiming.marketOpenToday ? '#22c55e' : '#94a3b8' }}>
                  {rthTiming.marketOpenToday ? 'Market open today' : 'Market closed'}
                </span>
              </p>
              <p className="mt-1 text-[12px] text-[#94a3b8]">
                {lastSession
                  ? `Last session ${formatSignedR(lastSession.netR)} (${lastSession.tradeCount} trades)`
                  : 'Last session result unavailable'}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-xl p-4" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p style={SECTION_LABEL_STYLE}>How are you feeling?</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                {emotions.map(item => {
                  const selected = emotion === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setEmotionAndPersist(item)}
                      className="rounded-lg border px-2 py-2 text-center text-[12px] font-medium"
                      style={{
                        borderColor: selected ? '#4a9eff' : 'rgba(255,255,255,0.1)',
                        backgroundColor: selected ? 'rgba(74,158,255,0.12)' : '#0a101d',
                        color: selected ? '#4a9eff' : '#cbd5e1',
                      }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 block text-[11px] text-[#64748b]" htmlFor="presession-note">Anything on your mind before the open?</label>
              <textarea
                id="presession-note"
                value={note}
                onChange={event => setNoteAndPersist(event.target.value)}
                className="mt-2 h-24 w-full resize-none rounded-lg border bg-[#0a101d] px-3 py-2 text-[12px] text-[#cbd5e1] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                placeholder="Quick pre-open note..."
              />
            </section>

            <section className="rounded-xl p-4" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p style={SECTION_LABEL_STYLE}>Today&apos;s risk limits</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}>
                  <p className="text-[12px] font-semibold text-[#f87171]">{formatCurrency(-riskLimits.maxDailyLoss)}</p>
                  <p className="mt-1 text-[11px] text-[#64748b]">Max daily loss</p>
                </div>
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}>
                  <p className="text-[12px] font-semibold text-[#e2e8f0]">{riskLimits.maxTrades}</p>
                  <p className="mt-1 text-[11px] text-[#64748b]">Max trades</p>
                </div>
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}>
                  <p className="text-[12px] font-semibold text-[#e2e8f0]">{formatCurrency(riskLimits.riskPerTrade)} ({riskLimits.riskPct.toFixed(1)}%)</p>
                  <p className="mt-1 text-[11px] text-[#64748b]">Risk per trade</p>
                </div>
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}>
                  <p className="text-[12px] font-semibold text-[#22c55e]">{formatCurrency(riskLimits.target)}</p>
                  <p className="mt-1 text-[11px] text-[#64748b]">Session target</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl p-4" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p style={SECTION_LABEL_STYLE}>Flyxa pattern watch</p>
              <div className="mt-3 space-y-2">
                {activeRiskPatterns.map(pattern => (
                  <article key={`watch-${pattern.id}`} className="grid overflow-hidden rounded-lg" style={{ gridTemplateColumns: '4px minmax(0,1fr)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ backgroundColor: '#ef4444' }} />
                    <div className="bg-[#0a101d] px-3 py-2">
                      <p className="text-[12px] font-semibold text-[#f87171]">Watch: {pattern.title}</p>
                      <p className="mt-1 text-[11px] leading-[1.6] text-[#94a3b8]">{buildPatternInstruction(pattern, 'watch')}</p>
                    </div>
                  </article>
                ))}
                {confirmedEdgePatterns.map(pattern => (
                  <article key={`protect-${pattern.id}`} className="grid overflow-hidden rounded-lg" style={{ gridTemplateColumns: '4px minmax(0,1fr)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ backgroundColor: '#22c55e' }} />
                    <div className="bg-[#0a101d] px-3 py-2">
                      <p className="text-[12px] font-semibold text-[#22c55e]">Protect: {pattern.title}</p>
                      <p className="mt-1 text-[11px] leading-[1.6] text-[#94a3b8]">{buildPatternInstruction(pattern, 'protect')}</p>
                    </div>
                  </article>
                ))}
                {activeRiskPatterns.length === 0 && (
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(34,197,94,0.2)', backgroundColor: 'rgba(34,197,94,0.1)' }}>
                    <p className="text-[12px] font-semibold text-[#22c55e]">No active risk flags today</p>
                    <p className="mt-1 text-[11px] text-[#94a3b8]">Keep your process tight and continue executing your highest-confidence setups.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl p-4" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p style={SECTION_LABEL_STYLE}>Market context</p>
              <div className="mt-3 space-y-3">
                {(['ES', 'NQ'] as const).map(instrument => (
                  <div key={instrument}>
                    <p className="text-[11px] text-[#64748b]">{instrument} bias</p>
                    <div className="mt-1 flex gap-2">
                      {biasOptions.map(option => {
                        const selected = bias[instrument] === option;
                        return (
                          <button
                            key={`${instrument}-${option}`}
                            type="button"
                            onClick={() => setBiasAndPersist(instrument, option)}
                            className="rounded-full border px-3 py-1 text-[11px]"
                            style={{
                              borderColor: selected ? '#4a9eff' : 'rgba(255,255,255,0.1)',
                              backgroundColor: selected ? 'rgba(74,158,255,0.12)' : '#0a101d',
                              color: selected ? '#4a9eff' : '#94a3b8',
                            }}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}>
                  <p className="text-[11px] text-[#64748b]">News today</p>
                  <p className="mt-1 text-[12px] text-[#cbd5e1]">No major news</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl p-4 xl:col-span-2" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p style={SECTION_LABEL_STYLE}>Pre-session checklist</p>
              <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">Mental checks</p>
                  <div className="mt-2 space-y-2">
                    {mentalChecklistItems.map(item => {
                      const checked = item.autoFromEmotion ? emotionLogged : Boolean(checklistState[item.id]);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleChecklist(item)}
                          className="flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left"
                          style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}
                        >
                          {customCheckbox(checked)}
                          <div>
                            <p className="text-[12px] text-[#cbd5e1]">{item.label}</p>
                            {item.autoFromEmotion && <p className="text-[10px] text-[#64748b]">Auto-linked to emotion log</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">Technical checks</p>
                  <div className="mt-2 space-y-2">
                    {technicalChecklistItems.map(item => {
                      const checked = Boolean(checklistState[item.id]);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleChecklist(item)}
                          className="flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left"
                          style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}
                        >
                          {customCheckbox(checked)}
                          <div>
                            <p className="text-[12px] text-[#cbd5e1]">{item.label}</p>
                            {item.source && <p className="text-[10px] text-[#64748b]">From pattern: {item.source}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl p-4 xl:col-span-2" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <p style={SECTION_LABEL_STYLE}>Today&apos;s session plan</p>
              <div className="mt-3 space-y-2">
                {sessionPlan.map((row, index) => (
                  <div key={row.id} className="flex items-start gap-3 rounded-md border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0a101d' }}>
                    <span className="mt-0.5 text-[11px] text-[#64748b]">{index + 1}.</span>
                    <p className="flex-1 text-[12px] leading-[1.6] text-[#cbd5e1]">{row.rule}</p>
                    <span className="shrink-0 rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase" style={{ ...sourceBadgeStyle(row.source), letterSpacing: '0.08em' }}>
                      {row.source}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl p-4 xl:col-span-2" style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startSession}
                  className="rounded-lg border border-[#4a9eff] bg-[#4a9eff] px-4 py-2 text-[12px] font-semibold text-white"
                >
                  Start session - I&apos;m ready to trade
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/journal')}
                  className="rounded-lg border px-4 py-2 text-[12px] font-semibold text-[#cbd5e1]"
                  style={{ borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'transparent' }}
                >
                  Skip brief and go to journal
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
