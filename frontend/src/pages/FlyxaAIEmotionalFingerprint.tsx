import { CSSProperties, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import FlyxaNav from '../components/flyxa/FlyxaNav.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { Trade } from '../types/index.js';

// ── constants ────────────────────────────────────────────────────────────────

const CARD_BORDER = '1px solid rgba(255,255,255,0.07)';
const SECTION_LABEL: CSSProperties = {
  fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#64748b',
};

const EMOTION_META: Record<string, { color: string; bg: string }> = {
  'Calm':            { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'    },
  'Confident':       { color: '#4a9eff', bg: 'rgba(74,158,255,0.12)'   },
  'Anxious':         { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'   },
  'Revenge Trading': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'    },
  'FOMO':            { color: '#f97316', bg: 'rgba(249,115,22,0.12)'   },
  'Overconfident':   { color: '#a855f7', bg: 'rgba(168,85,247,0.12)'   },
  'Tired':           { color: '#64748b', bg: 'rgba(100,116,139,0.12)'  },
};

const EMOTION_ORDER = ['Calm', 'Confident', 'Anxious', 'Revenge Trading', 'FOMO', 'Overconfident', 'Tired'];

// ── helpers ──────────────────────────────────────────────────────────────────

type EmotionStats = {
  emotion: string;
  trades: number;
  wins: number;
  winRate: number;
  netPnL: number;
  avgPnL: number;
  planRate: number;
  avgConfidence: number;
};

function computeEmotionStats(trades: Trade[]): EmotionStats[] {
  const map = new Map<string, { trades: Trade[] }>();
  for (const t of trades) {
    const key = t.emotional_state ?? 'Unknown';
    if (!map.has(key)) map.set(key, { trades: [] });
    map.get(key)!.trades.push(t);
  }

  return EMOTION_ORDER
    .filter(e => map.has(e))
    .map(emotion => {
      const { trades: et } = map.get(emotion)!;
      const wins = et.filter(t => t.pnl > 0).length;
      const netPnL = et.reduce((s, t) => s + t.pnl, 0);
      const planCount = et.filter(t => t.followed_plan).length;
      const confSum = et.reduce((s, t) => s + (t.confidence_level ?? 0), 0);
      return {
        emotion,
        trades: et.length,
        wins,
        winRate: et.length > 0 ? (wins / et.length) * 100 : 0,
        netPnL,
        avgPnL: et.length > 0 ? netPnL / et.length : 0,
        planRate: et.length > 0 ? (planCount / et.length) * 100 : 0,
        avgConfidence: et.length > 0 ? confSum / et.length : 0,
      };
    });
}

function pct(value: number) {
  return `${value.toFixed(0)}%`;
}

function currency(value: number) {
  const abs = Math.abs(value);
  const str = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(abs);
  return value < 0 ? `-${str}` : str;
}

// ── sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }) {
  const color = tone === 'pos' ? '#22c55e' : tone === 'neg' ? '#ef4444' : '#94a3b8';
  return (
    <div>
      <p style={SECTION_LABEL}>{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function EmotionCard({ stat }: { stat: EmotionStats }) {
  const meta = EMOTION_META[stat.emotion] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  const pnlTone = stat.avgPnL >= 0 ? 'pos' : 'neg';

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ backgroundColor: '#0d1526', border: CARD_BORDER }}
    >
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ color: meta.color, backgroundColor: meta.bg, border: `1px solid ${meta.color}30` }}
        >
          {stat.emotion}
        </span>
        <span className="text-[12px] text-[#64748b]">{stat.trades} trade{stat.trades !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <StatPill label="Win rate"    value={pct(stat.winRate)}          tone={stat.winRate >= 50 ? 'pos' : 'neg'} />
        <StatPill label="Avg P&L"     value={currency(stat.avgPnL)}       tone={pnlTone} />
        <StatPill label="Plan rate"   value={pct(stat.planRate)}          tone={stat.planRate >= 70 ? 'pos' : stat.planRate >= 40 ? 'neutral' : 'neg'} />
        <StatPill label="Avg confid." value={`${stat.avgConfidence.toFixed(1)}/10`} tone="neutral" />
      </div>

      {/* Win-rate bar */}
      <div>
        <div className="h-1.5 rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${stat.winRate}%`, backgroundColor: meta.color }}
          />
        </div>
      </div>
    </div>
  );
}

// ── custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: EmotionStats }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const meta = EMOTION_META[d.emotion] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1526] px-3 py-2 text-[12px] space-y-1">
      <p style={{ color: meta.color, fontWeight: 600 }}>{d.emotion}</p>
      <p className="text-[#94a3b8]">Avg P&L: <span style={{ color: d.avgPnL >= 0 ? '#22c55e' : '#ef4444' }}>{currency(d.avgPnL)}</span></p>
      <p className="text-[#94a3b8]">Win rate: {pct(d.winRate)}</p>
      <p className="text-[#94a3b8]">Trades: {d.trades}</p>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function FlyxaAIEmotionalFingerprint() {
  const { trades, loading } = useTrades();
  const { filterTradesBySelectedAccount } = useAppSettings();
  const filtered = useMemo(() => filterTradesBySelectedAccount(trades), [filterTradesBySelectedAccount, trades]);
  const stats = useMemo(() => computeEmotionStats(filtered), [filtered]);

  const bestState  = useMemo(() => stats.filter(s => s.trades >= 3).sort((a, b) => b.winRate - a.winRate)[0] ?? null, [stats]);
  const worstState = useMemo(() => stats.filter(s => s.trades >= 3).sort((a, b) => a.winRate - b.winRate)[0] ?? null, [stats]);
  const planLeader = useMemo(() => stats.filter(s => s.trades >= 3).sort((a, b) => b.planRate - a.planRate)[0] ?? null, [stats]);

  if (loading) {
    return (
      <div className="animate-fade-in -m-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#060a12] text-[#e2e8f0]">
        <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] overflow-hidden">
          <FlyxaNav />
          <div className="flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  const hasData = stats.length > 0;

  return (
    <div className="animate-fade-in -m-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#060a12] text-[#e2e8f0]">
      <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] overflow-hidden">
        <FlyxaNav />

        <main className="min-h-0 overflow-y-auto px-6 py-6">
          <div className="space-y-6">

            {/* Header */}
            <header>
              <h1 className="text-[26px] font-semibold text-[#e2e8f0]">Emotional fingerprint</h1>
              <p className="mt-1 text-[13px] text-[#64748b]">How your mental state shapes execution quality and P&L.</p>
            </header>

            {!hasData ? (
              <div
                className="rounded-xl border p-10 text-center"
                style={{ border: CARD_BORDER, backgroundColor: '#0d1526' }}
              >
                <p className="text-[14px] text-[#64748b]">No trade data yet.</p>
                <p className="mt-1 text-[12px] text-[#475569]">Log trades with an emotional state to see your fingerprint.</p>
              </div>
            ) : (
              <>
                {/* Summary insight cards */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {bestState && (
                    <div className="rounded-xl border p-4" style={{ border: CARD_BORDER, backgroundColor: '#0d1526' }}>
                      <p style={SECTION_LABEL}>Your best state</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                          style={{ color: EMOTION_META[bestState.emotion]?.color ?? '#94a3b8', backgroundColor: EMOTION_META[bestState.emotion]?.bg ?? 'rgba(148,163,184,0.1)' }}
                        >
                          {bestState.emotion}
                        </span>
                      </div>
                      <p className="mt-2 text-[22px] font-semibold text-[#22c55e]">{pct(bestState.winRate)} WR</p>
                      <p className="text-[12px] text-[#64748b]">{currency(bestState.avgPnL)} avg · {bestState.trades} trades</p>
                    </div>
                  )}

                  {worstState && worstState.emotion !== bestState?.emotion && (
                    <div className="rounded-xl border p-4" style={{ border: CARD_BORDER, backgroundColor: '#0d1526' }}>
                      <p style={SECTION_LABEL}>Biggest risk state</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                          style={{ color: EMOTION_META[worstState.emotion]?.color ?? '#94a3b8', backgroundColor: EMOTION_META[worstState.emotion]?.bg ?? 'rgba(148,163,184,0.1)' }}
                        >
                          {worstState.emotion}
                        </span>
                      </div>
                      <p className="mt-2 text-[22px] font-semibold text-[#ef4444]">{pct(worstState.winRate)} WR</p>
                      <p className="text-[12px] text-[#64748b]">{currency(worstState.avgPnL)} avg · {worstState.trades} trades</p>
                    </div>
                  )}

                  {planLeader && (
                    <div className="rounded-xl border p-4" style={{ border: CARD_BORDER, backgroundColor: '#0d1526' }}>
                      <p style={SECTION_LABEL}>Most disciplined state</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                          style={{ color: EMOTION_META[planLeader.emotion]?.color ?? '#94a3b8', backgroundColor: EMOTION_META[planLeader.emotion]?.bg ?? 'rgba(148,163,184,0.1)' }}
                        >
                          {planLeader.emotion}
                        </span>
                      </div>
                      <p className="mt-2 text-[22px] font-semibold text-[#4a9eff]">{pct(planLeader.planRate)} plan rate</p>
                      <p className="text-[12px] text-[#64748b]">{pct(planLeader.winRate)} WR · {planLeader.trades} trades</p>
                    </div>
                  )}
                </div>

                {/* Avg P&L by emotion — bar chart */}
                <div className="rounded-xl border p-4" style={{ border: CARD_BORDER, backgroundColor: '#0d1526' }}>
                  <p style={SECTION_LABEL}>Average P&L by emotional state</p>
                  <div className="mt-4 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats} barCategoryGap="30%" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="emotion"
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={e => e.length > 8 ? e.slice(0, 8) + '…' : e}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => `$${v}`}
                          width={46}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                        <Bar dataKey="avgPnL" radius={[4, 4, 0, 0]}>
                          {stats.map(s => (
                            <Cell
                              key={s.emotion}
                              fill={s.avgPnL >= 0
                                ? (EMOTION_META[s.emotion]?.color ?? '#22c55e')
                                : '#ef4444'}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Per-emotion detail cards */}
                <div>
                  <p style={{ ...SECTION_LABEL, marginBottom: 12 }}>Breakdown by state</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {stats.map(s => <EmotionCard key={s.emotion} stat={s} />)}
                  </div>
                </div>

                {/* Recent trade emotion timeline */}
                <div className="rounded-xl border p-4" style={{ border: CARD_BORDER, backgroundColor: '#0d1526' }}>
                  <p style={SECTION_LABEL}>Recent trades — emotion timeline</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...filtered]
                      .sort((a, b) => {
                        const da = `${a.trade_date}T${a.trade_time ?? '00:00'}`;
                        const db = `${b.trade_date}T${b.trade_time ?? '00:00'}`;
                        return db < da ? -1 : db > da ? 1 : 0;
                      })
                      .slice(0, 40)
                      .map((t, i) => {
                        const meta = EMOTION_META[t.emotional_state ?? ''] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
                        return (
                          <div
                            key={`${t.id}-${i}`}
                            title={`${t.trade_date} · ${t.emotional_state ?? '—'} · ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(0)}`}
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold cursor-default"
                            style={{
                              backgroundColor: meta.bg,
                              border: `1px solid ${meta.color}40`,
                              color: meta.color,
                            }}
                          >
                            {(t.emotional_state ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                        );
                      })}
                  </div>
                  <p className="mt-2 text-[11px] text-[#475569]">Hover a dot to see date, state, and P&L. Newest left to right.</p>
                </div>

              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
