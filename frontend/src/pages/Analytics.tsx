import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { Trade } from '../types/index.js';
import { formatCurrency } from '../utils/calculations.js';

type PeriodKey = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: 'YTD', label: 'YTD' },
  { key: 'ALL', label: 'All' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const BUSINESS_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const SESSION_BUCKETS = [
  { key: 'asia', label: 'Asia' },
  { key: 'london', label: 'London' },
  { key: 'preMarket', label: 'Pre Market' },
  { key: 'newYork', label: 'New York' },
] as const;
const TIME_WINDOWS = [
  { label: '9:30', start: 570, end: 600 },
  { label: '10:00', start: 600, end: 630 },
  { label: '10:30', start: 630, end: 660 },
  { label: '11:00', start: 660, end: 720 },
  { label: '12:00', start: 720, end: 840 },
  { label: '14:00', start: 840, end: 930 },
  { label: '15:30', start: 930, end: 960 },
] as const;

function parseTradeDateTime(trade: Trade): Date | null {
  const datePart = trade.trade_date || trade.created_at?.slice(0, 10);
  if (!datePart) return null;

  const rawTime = trade.trade_time || '00:00:00';
  const timePart = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const parsed = new Date(`${datePart}T${timePart}`);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  if (trade.created_at) {
    const fallback = new Date(trade.created_at);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return null;
}

function parseTradeDateOnly(trade: Trade): Date | null {
  const datePart = trade.trade_date || trade.created_at?.slice(0, 10);
  if (!datePart) return null;
  const parsed = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPeriodStart(period: PeriodKey, now: Date): Date | null {
  if (period === 'ALL') return null;

  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  if (period === '1W') {
    base.setDate(base.getDate() - 7);
    return base;
  }

  if (period === '1M') {
    base.setMonth(base.getMonth() - 1);
    return base;
  }

  if (period === '3M') {
    base.setMonth(base.getMonth() - 3);
    return base;
  }

  return new Date(base.getFullYear(), 0, 1);
}

function getPreviousRange(period: PeriodKey, now: Date): { start: Date; end: Date } | null {
  const currentStart = getPeriodStart(period, now);
  if (!currentStart) return null;

  const currentEnd = new Date(now);
  const duration = currentEnd.getTime() - currentStart.getTime();
  if (duration <= 0) return null;

  return {
    start: new Date(currentStart.getTime() - duration),
    end: currentStart,
  };
}

function timeToMinutes(time?: string): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function isInSessionRange(minutes: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function formatSignedCurrency(value: number, withCents = false): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });
  const signed = formatter.format(Math.abs(value));
  return `${value >= 0 ? '+' : '-'}${signed}`;
}

function formatHoldDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function safeAverage(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MetricCard({
  label,
  value,
  subtitle,
  valueClassName,
}: {
  label: string;
  value: string;
  subtitle: string;
  valueClassName: string;
}) {
  return (
    <div className="min-h-[144px] rounded-2xl border border-[#22324d] bg-[#0a1428] px-5 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[#5f7297]">{label}</p>
      <p className={`mt-2.5 text-2xl font-semibold leading-[1.05] md:text-[40px] ${valueClassName}`}>{value}</p>
      <p className="mt-2.5 text-sm leading-[1.25] text-[#6d82a7] md:text-[16px]">{subtitle}</p>
    </div>
  );
}

export default function Analytics() {
  const { trades, loading } = useTrades();
  const { filterTradesBySelectedAccount, preferences } = useAppSettings();
  const [period, setPeriod] = useState<PeriodKey>('1M');
  const today = useMemo(() => new Date(), []);

  const accountTrades = useMemo(
    () => filterTradesBySelectedAccount(trades),
    [filterTradesBySelectedAccount, trades]
  );

  const filteredTrades = useMemo(() => {
    const start = getPeriodStart(period, today);
    const next = accountTrades.filter(trade => {
      if (!start) return true;
      const tradeDate = parseTradeDateOnly(trade);
      return tradeDate ? tradeDate >= start : false;
    });

    return next.sort((a, b) => {
      const aTime = parseTradeDateTime(a)?.getTime() ?? 0;
      const bTime = parseTradeDateTime(b)?.getTime() ?? 0;
      return aTime - bTime;
    });
  }, [accountTrades, period, today]);

  const previousPeriodNet = useMemo(() => {
    const prev = getPreviousRange(period, today);
    if (!prev) return null;

    return accountTrades.reduce((sum, trade) => {
      const tradeDate = parseTradeDateOnly(trade);
      if (!tradeDate) return sum;
      if (tradeDate >= prev.start && tradeDate < prev.end) {
        return sum + trade.pnl;
      }
      return sum;
    }, 0);
  }, [accountTrades, period, today]);

  const metrics = useMemo(() => {
    const wins = filteredTrades.filter(trade => trade.pnl > 0);
    const losses = filteredTrades.filter(trade => trade.pnl < 0);
    const totalTrades = filteredTrades.length;
    const netPnL = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const scoredTrades = wins.length + losses.length;
    const winRate = scoredTrades > 0 ? (wins.length / scoredTrades) * 100 : 0;
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const expectedValue = totalTrades > 0 ? netPnL / totalTrades : 0;
    const activeDays = new Set(filteredTrades.map(trade => trade.trade_date)).size;
    const tradesPerDay = activeDays > 0 ? totalTrades / activeDays : 0;
    const avgWinHold = safeAverage(wins.map(trade => trade.trade_length_seconds || 0));
    const avgLossHold = safeAverage(losses.map(trade => trade.trade_length_seconds || 0));
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(trade => trade.pnl)) : 0;

    return {
      wins,
      losses,
      totalTrades,
      netPnL,
      winRate,
      profitFactor,
      avgWin,
      expectedValue,
      tradesPerDay,
      avgWinHold,
      avgLossHold,
      largestLoss,
    };
  }, [filteredTrades]);

  const netPnLChange = useMemo(() => {
    if (previousPeriodNet === null) return null;
    if (Math.abs(previousPeriodNet) < 0.0001) return null;
    return ((metrics.netPnL - previousPeriodNet) / Math.abs(previousPeriodNet)) * 100;
  }, [metrics.netPnL, previousPeriodNet]);

  const equityCurveData = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredTrades.forEach(trade => {
      const key = trade.trade_date || trade.created_at?.slice(0, 10);
      if (!key) return;
      grouped.set(key, (grouped.get(key) ?? 0) + trade.pnl);
    });

    const daily = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    return daily.map(([date, pnl]) => {
      cumulative += pnl;
      return {
        date,
        label: formatDateLabel(date),
        cumulative,
        breakeven: 0,
      };
    });
  }, [filteredTrades]);

  const winLossData = useMemo(() => {
    const scoredTrades = metrics.wins.length + metrics.losses.length;
    if (scoredTrades === 0) {
      return [{ name: 'No trades', value: 1, color: '#22314f' }];
    }

    return [
      { name: 'Wins', value: metrics.wins.length, color: '#22c55e' },
      { name: 'Losses', value: metrics.losses.length, color: '#ef4444' },
    ];
  }, [metrics.losses.length, metrics.wins.length]);

  const dayOfWeekRows = useMemo(() => {
    const values: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
    };

    filteredTrades.forEach(trade => {
      const tradeDate = parseTradeDateOnly(trade);
      if (!tradeDate) return;
      const dayLabel = DAY_LABELS[tradeDate.getDay()];
      if (dayLabel in values) {
        values[dayLabel] += trade.pnl;
      }
    });

    const maxAbs = Math.max(1, ...BUSINESS_DAY_LABELS.map(label => Math.abs(values[label])));
    return BUSINESS_DAY_LABELS.map(label => ({
      label,
      pnl: values[label],
      ratio: Math.abs(values[label]) / maxAbs,
    }));
  }, [filteredTrades]);

  const sessionRows = useMemo(() => {
    const totals = new Map<string, number>(SESSION_BUCKETS.map(bucket => [bucket.key, 0]));
    const sessionWindows = [
      {
        key: 'asia',
        start: timeToMinutes(preferences.sessionTimes.asia.start),
        end: timeToMinutes(preferences.sessionTimes.asia.end),
      },
      {
        key: 'london',
        start: timeToMinutes(preferences.sessionTimes.london.start),
        end: timeToMinutes(preferences.sessionTimes.london.end),
      },
      {
        key: 'preMarket',
        start: timeToMinutes(preferences.sessionTimes.preMarket.start),
        end: timeToMinutes(preferences.sessionTimes.preMarket.end),
      },
      {
        key: 'newYork',
        start: timeToMinutes(preferences.sessionTimes.newYork.start),
        end: timeToMinutes(preferences.sessionTimes.newYork.end),
      },
    ] as const;

    filteredTrades.forEach(trade => {
      const minutes = timeToMinutes(trade.trade_time);
      if (minutes === null) return;
      const matchingWindow = sessionWindows.find(window => {
        if (window.start === null || window.end === null) return false;
        return isInSessionRange(minutes, window.start, window.end);
      });
      if (!matchingWindow) return;
      totals.set(matchingWindow.key, (totals.get(matchingWindow.key) ?? 0) + trade.pnl);
    });

    const maxAbs = Math.max(1, ...SESSION_BUCKETS.map(item => Math.abs(totals.get(item.key) ?? 0)));
    return SESSION_BUCKETS.map(bucket => {
      const pnl = totals.get(bucket.key) ?? 0;
      return {
        key: bucket.key,
        label: bucket.label,
        pnl,
        ratio: Math.abs(pnl) / maxAbs,
      };
    });
  }, [filteredTrades, preferences.sessionTimes.asia.end, preferences.sessionTimes.asia.start, preferences.sessionTimes.london.end, preferences.sessionTimes.london.start, preferences.sessionTimes.newYork.end, preferences.sessionTimes.newYork.start, preferences.sessionTimes.preMarket.end, preferences.sessionTimes.preMarket.start]);

  const streakStats = useMemo(() => {
    const outcomes = filteredTrades.map(trade => (trade.pnl > 0 ? 1 : trade.pnl < 0 ? -1 : 0));
    const recent = outcomes.slice(-20);

    let currentType: 1 | -1 | 0 = 0;
    let currentLength = 0;
    for (let index = outcomes.length - 1; index >= 0; index -= 1) {
      const current = outcomes[index];
      if (current === 0) break;
      if (currentType === 0) {
        currentType = current as 1 | -1;
      }
      if (current !== currentType) break;
      currentLength += 1;
    }

    let bestWin = 0;
    let worstLoss = 0;
    let runWin = 0;
    let runLoss = 0;

    outcomes.forEach(outcome => {
      if (outcome > 0) {
        runWin += 1;
        runLoss = 0;
        bestWin = Math.max(bestWin, runWin);
        return;
      }

      if (outcome < 0) {
        runLoss += 1;
        runWin = 0;
        worstLoss = Math.max(worstLoss, runLoss);
        return;
      }

      runWin = 0;
      runLoss = 0;
    });

    return {
      recent,
      currentType,
      currentLength,
      bestWin,
      worstLoss,
    };
  }, [filteredTrades]);

  const timeOfDayRows = useMemo(() => {
    const rows = TIME_WINDOWS.map(window => {
      const windowTrades = filteredTrades.filter(trade => {
        const minutes = timeToMinutes(trade.trade_time);
        return minutes !== null && minutes >= window.start && minutes < window.end;
      });

      return {
        ...window,
        avgPnL: windowTrades.length > 0
          ? safeAverage(windowTrades.map(trade => trade.pnl))
          : null,
      };
    });

    const maxAbs = Math.max(
      1,
      ...rows.map(row => Math.abs(row.avgPnL ?? 0))
    );

    return rows.map(row => ({
      ...row,
      ratio: row.avgPnL === null ? 0 : Math.abs(row.avgPnL) / maxAbs,
    }));
  }, [filteredTrades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading analytics..." />
      </div>
    );
  }

  const periodSubtitle = period === 'ALL' ? 'all time' : period === 'YTD' ? 'year to date' : period.toLowerCase();
  const winLossTotal = metrics.wins.length + metrics.losses.length;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold leading-[1.05] text-[#e2ebfb] md:text-[38px]">Analytics</h1>
          <p className="mt-1.5 text-sm text-[#6d82a7] md:text-[18px]">Performance breakdown for your selected period</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map(option => {
            const active = period === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={`rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors md:px-4 md:py-2 md:text-[16px] ${
                  active
                    ? 'border-[#3b82f6] bg-[#132c52] text-[#8fc4ff]'
                    : 'border-[#22324d] bg-[#0d1a31] text-[#8096ba] hover:text-[#bfd1ee]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Net P&L"
          value={formatSignedCurrency(metrics.netPnL)}
          subtitle={
            netPnLChange === null
              ? `Live for ${periodSubtitle}`
              : `${netPnLChange >= 0 ? '+' : ''}${netPnLChange.toFixed(1)}% vs previous period`
          }
          valueClassName={metrics.netPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}
        />
        <MetricCard
          label="Win Rate"
          value={`${metrics.winRate.toFixed(0)}%`}
          subtitle={`${metrics.wins.length}W / ${metrics.losses.length}L`}
          valueClassName="text-[#e2ebfb]"
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profitFactor >= 999 ? '∞' : metrics.profitFactor.toFixed(2)}
          subtitle={metrics.profitFactor >= 1 ? 'Above breakeven' : 'Below breakeven'}
          valueClassName={metrics.profitFactor >= 1 ? 'text-[#60a5fa]' : 'text-[#f87171]'}
        />
        <MetricCard
          label="Avg Win"
          value={formatSignedCurrency(metrics.avgWin)}
          subtitle={`vs ${formatCurrency(metrics.losses.length ? Math.abs(safeAverage(metrics.losses.map(trade => trade.pnl))) : 0)} avg loss`}
          valueClassName="text-[#22c55e]"
        />
        <MetricCard
          label="Exp. Value"
          value={formatSignedCurrency(metrics.expectedValue)}
          subtitle="Per trade"
          valueClassName={metrics.expectedValue >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}
        />
        <MetricCard
          label="Total Trades"
          value={String(metrics.totalTrades)}
          subtitle={`${metrics.tradesPerDay.toFixed(1)}/ day avg`}
          valueClassName="text-[#e2ebfb]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-[#22324d] bg-[#0a1428] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-[#e2ebfb] md:text-[32px]">Cumulative P&amp;L</h2>
            <div className="flex items-center gap-4 text-sm text-[#6d82a7] md:text-[20px]">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
                P&amp;L
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#3b82f6]" />
                Breakeven
              </span>
            </div>
          </div>

          {equityCurveData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={equityCurveData} margin={{ top: 8, right: 10, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1a2943" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#60769b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#60769b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={value => `$${Number(value).toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{ background: '#0d1930', border: '1px solid #22324d', borderRadius: 10 }}
                  labelStyle={{ color: '#97abcf' }}
                  itemStyle={{ color: '#e2ebfb' }}
                  formatter={(value: number, name) => [formatCurrency(value), name === 'cumulative' ? 'P&L' : 'Breakeven']}
                />
                <ReferenceLine y={0} stroke="#3b82f6" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#22c55e"
                  strokeWidth={3}
                  fill="url(#pnl-fill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-base text-[#6d82a7]">
              No trades in this period.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#22324d] bg-[#0a1428] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[#e2ebfb] md:text-[32px]">Win / Loss</h2>
            <span className="rounded-xl bg-[#12315f] px-3 py-1 text-xs text-[#60a5fa] md:text-[16px]">
              {metrics.winRate.toFixed(0)}% win rate
            </span>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-3">
            <div className="h-[230px] min-h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={82}
                    stroke="none"
                  >
                    {winLossData.map(segment => (
                      <Cell key={segment.name} fill={segment.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 text-base md:text-[20px]">
              <div className="flex items-center justify-between gap-5">
                <span className="inline-flex items-center gap-2 text-[#6d82a7]">
                  <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
                  Wins
                </span>
                <span className="text-[#22c55e]">{metrics.wins.length}</span>
              </div>
              <div className="flex items-center justify-between gap-5">
                <span className="inline-flex items-center gap-2 text-[#6d82a7]">
                  <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                  Losses
                </span>
                <span className="text-[#ef4444]">{metrics.losses.length}</span>
              </div>
              <div className="border-t border-[#22324d] pt-3 text-[13px]">
                <div className="mb-2 flex items-center justify-between gap-3 text-[#6d82a7]">
                  <span>Avg hold (wins)</span>
                  <span className="text-[#e2ebfb]">{formatHoldDuration(metrics.avgWinHold)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[#6d82a7]">
                  <span>Avg hold (losses)</span>
                  <span className="text-[#e2ebfb]">{formatHoldDuration(metrics.avgLossHold)}</span>
                </div>
                {winLossTotal === 0 && (
                  <p className="mt-3 text-[#6d82a7]">No scored trades yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#22324d] bg-[#0a1428] p-5">
          <h3 className="text-2xl font-semibold text-[#e2ebfb] md:text-[30px]">P&amp;L by day of week</h3>
          <div className="mt-5 space-y-2.5">
            {dayOfWeekRows.map(row => (
              <div key={row.label} className="grid grid-cols-[46px_minmax(0,1fr)_92px] items-center gap-2.5">
                <span className="w-[46px] text-lg leading-none text-[#9aaed0] md:text-[16px]">{row.label}</span>
                <div className="min-w-0 h-2.5 rounded-full bg-[#1a2943]">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${Math.max(6, row.ratio * 100)}%`,
                      backgroundColor: row.pnl >= 0 ? '#22c55e' : '#ef4444',
                    }}
                  />
                </div>
                <span className={`text-right text-base tabular-nums whitespace-nowrap md:text-[16px] ${row.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatSignedCurrency(row.pnl)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#22324d] bg-[#0a1428] p-5">
          <h3 className="text-2xl font-semibold text-[#e2ebfb] md:text-[30px]">P&amp;L by session</h3>
          <div className="mt-5 space-y-3">
            {sessionRows.map(row => (
              <div key={row.key} className="grid grid-cols-[92px_minmax(0,1fr)_92px] items-center gap-2.5">
                <span className="w-[92px] text-lg leading-[1.05] text-[#9aaed0] md:text-[16px]">{row.label}</span>
                <div className="min-w-0 h-2.5 rounded-full bg-[#1a2943]">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${Math.max(6, row.ratio * 100)}%`,
                      backgroundColor: row.pnl >= 0 ? '#22c55e' : '#ef4444',
                    }}
                  />
                </div>
                <span className={`text-right text-base tabular-nums whitespace-nowrap md:text-[16px] ${row.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatSignedCurrency(row.pnl)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#22324d] bg-[#0a1428] p-5">
          <h3 className="text-2xl font-semibold text-[#e2ebfb] md:text-[30px]">Win/loss streak</h3>
          <p className="mt-3 text-sm text-[#6d82a7] md:text-[18px]">Last 20 trades</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {streakStats.recent.map((outcome, index) => (
              <span
                key={`${outcome}-${index}`}
                className="h-8 w-2.5 rounded-full"
                style={{
                  backgroundColor: outcome > 0 ? '#22c55e' : outcome < 0 ? '#ef4444' : '#334155',
                }}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 text-sm md:text-[15px]">
            <div>
              <p className="text-[#6d82a7]">CURRENT</p>
              <p className={streakStats.currentType >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                {streakStats.currentLength}{streakStats.currentType >= 0 ? 'W' : 'L'} streak
              </p>
            </div>
            <div>
              <p className="text-[#6d82a7]">BEST</p>
              <p className="text-[#22c55e]">{streakStats.bestWin}W streak</p>
            </div>
            <div>
              <p className="text-[#6d82a7]">WORST LOSS</p>
              <p className="text-[#ef4444]">{streakStats.worstLoss}L streak</p>
            </div>
            <div>
              <p className="text-[#6d82a7]">LARGEST LOSS</p>
              <p className="text-[#ef4444]">{metrics.largestLoss < 0 ? formatCurrency(metrics.largestLoss) : '$0.00'}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#22324d] bg-[#0a1428] p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold text-[#e2ebfb] md:text-[30px]">P&amp;L by time of day</h3>
          <p className="text-xs text-[#6d82a7] md:text-[16px]">Avg P&amp;L per trade in each 30-min window</p>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {timeOfDayRows.map(row => (
            <div key={row.label} className="text-center">
              <p className="mb-1.5 text-xs text-[#6d82a7] md:text-[13px]">{row.label}</p>
              <div
                className="rounded-lg px-2 py-2 text-xs font-medium md:text-[14px]"
                style={{
                  backgroundColor: row.avgPnL === null
                    ? '#1a2943'
                    : row.avgPnL >= 0
                      ? `rgba(34,197,94,${0.3 + (row.ratio * 0.42)})`
                      : `rgba(239,68,68,${0.3 + (row.ratio * 0.42)})`,
                  color: row.avgPnL === null ? '#6d82a7' : row.avgPnL >= 0 ? '#dcfce7' : '#fecaca',
                }}
              >
                {row.avgPnL === null ? '--' : formatSignedCurrency(row.avgPnL)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-[#6d82a7] md:text-[14px]">Mon-Fri</span>
          <div className="flex items-center gap-2 text-xs text-[#6d82a7] md:text-[14px]">
            <span>Loss</span>
            <span className="h-3 w-6 rounded bg-[#7f1d1d]" />
            <span className="h-3 w-6 rounded bg-[#b91c1c]" />
            <span className="h-3 w-6 rounded bg-[#1a2943]" />
            <span className="h-3 w-6 rounded bg-[#166534]" />
            <span className="h-3 w-6 rounded bg-[#16a34a]" />
            <span className="h-3 w-6 rounded bg-[#22c55e]" />
            <span>Profit</span>
          </div>
        </div>
      </section>
    </div>
  );
}
