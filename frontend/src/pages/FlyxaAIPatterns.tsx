import { CSSProperties, useMemo, useState } from 'react';
import FlyxaNav from '../components/flyxa/FlyxaNav.js';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { Trade } from '../types/index.js';

export type PatternType = 'Risk' | 'Edge' | 'Psychology' | 'Behaviour';
export type PatternStatus = 'Active' | 'Improving' | 'Confirmed' | 'Resolved';
export type SessionBucket = 'RTH open' | 'Overlap' | 'Midday';
export type TagSentiment = 'positive' | 'negative' | 'neutral';
type SortOption = 'impact' | 'recent' | 'frequency';

export type PatternSession = {
  date: string;
  rOutcome: number;
};

export type PatternItem = {
  id: string;
  type: PatternType;
  status: PatternStatus;
  resolvedFrom?: Exclude<PatternStatus, 'Resolved'>;
  title: string;
  description: string;
  firstSeen: string;
  sessionCount: number;
  totalR: number;
  tags: Array<{ label: string; sentiment: TagSentiment }>;
  confidence: number;
  instrument: string;
  session: SessionBucket;
  sessions: PatternSession[];
};

const colors = {
  d0: '#0e0d0d', d1: '#141312', d2: '#1a1917', d3: '#201f1d', d4: '#27251f',
  b0: 'rgba(255,255,255,0.07)', b1: 'rgba(255,255,255,0.12)',
  t0: '#e8e3dc', t1: '#8a8178', t2: '#5c5751',
  acc: '#f59e0b', grn: '#22d68a', red: '#f05252',
};

const tinyMetaLabelStyle: CSSProperties = {
  fontSize: 9.5, fontWeight: 500, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: colors.t2,
};

const cardBorder = `1px solid ${colors.b0}`;


function patternAccent(type: PatternType) {
  if (type === 'Risk') return '#ef4444';
  if (type === 'Edge') return '#22c55e';
  if (type === 'Psychology') return '#f59e0b';
  return '#4a9eff';
}

function statusStyles(status: PatternStatus): CSSProperties {
  if (status === 'Active') return { color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' };
  if (status === 'Improving') return { color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' };
  if (status === 'Confirmed') return { color: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' };
  return { color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' };
}

function tagStyles(sentiment: TagSentiment): CSSProperties {
  if (sentiment === 'negative') return { color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' };
  if (sentiment === 'positive') return { color: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' };
  return { color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' };
}

function confidenceColor(confidence: number) {
  if (confidence >= 75) return '#22c55e';
  if (confidence >= 50) return '#f59e0b';
  return '#ef4444';
}

function filterPillClass(active: boolean) {
  if (active) return 'border-[#f59e0b] bg-[rgba(245,158,11,0.10)] text-[#f59e0b]';
  return 'border-white/[0.07] bg-[#1a1917] text-[#8a8178] hover:text-[#e8e3dc]';
}

type DetectedTimeFrame = '1M' | '3M' | '6M' | 'All';

function getDetectedPeriodStart(tf: DetectedTimeFrame): Date {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (tf === '1M') return new Date(today.getFullYear(), today.getMonth(), 1);
  if (tf === '3M') return new Date(today.getFullYear(), today.getMonth() - 2, 1);
  if (tf === '6M') return new Date(today.getFullYear(), today.getMonth() - 5, 1);
  return new Date(0); // All
}

function tradeR(trade: Partial<Trade>): number {
  const entry = Number(trade.entry_price ?? 0);
  const sl = Number(trade.sl_price ?? 0);
  const pnl = Number(trade.pnl ?? 0);
  const riskPts = Math.abs(entry - sl);
  if (riskPts > 0) {
    const size = Math.max(1, Number(trade.contract_size ?? 1));
    const ptVal = Math.max(1, Number(trade.point_value ?? 1));
    const risk = riskPts * size * ptVal;
    if (risk > 0) return pnl / risk;
  }
  return pnl > 0 ? 1 : pnl < 0 ? -1 : 0;
}

function detectPatternsFromTrades(trades: Trade[], tf: DetectedTimeFrame): PatternItem[] {
  if (!trades.length) return [];
  const cutoff = getDetectedPeriodStart(tf);
  const filtered = trades.filter(t => {
    const d = t.trade_date ? new Date(`${t.trade_date}T00:00:00`) : (t.created_at ? new Date(t.created_at) : null);
    return d && d >= cutoff;
  });
  if (!filtered.length) return [];

  const patterns: PatternItem[] = [];
  const now = new Date().toISOString().slice(0, 10);

  const groupBy = <K extends string>(arr: Trade[], key: (t: Trade) => K) => {
    const map = new Map<K, Trade[]>();
    arr.forEach(t => { const k = key(t); map.set(k, [...(map.get(k) ?? []), t]); });
    return map;
  };

  const summariseGroup = (group: Trade[]) => {
    const winners = group.filter(t => Number(t.pnl) > 0);
    const rs = group.map(tradeR);
    return {
      count: group.length,
      netPnl: group.reduce((s, t) => s + Number(t.pnl ?? 0), 0),
      winRate: group.length ? (winners.length / group.length) * 100 : 0,
      totalR: rs.reduce((s, r) => s + r, 0),
      sessions: group
        .map(t => ({ date: t.trade_date ?? now, rOutcome: parseFloat(tradeR(t).toFixed(2)) }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
      firstSeen: group.map(t => t.trade_date ?? now).sort()[0] ?? now,
    };
  };

  // ── Symbol patterns ──────────────────────────────────────────────
  const symbolGroups = groupBy(filtered, t => (t.symbol?.trim() || 'Unknown'));
  symbolGroups.forEach((group, symbol) => {
    if (group.length < 4 || symbol === 'Unknown') return;
    const s = summariseGroup(group);
    const confidence = Math.min(95, Math.round(30 + (group.length / 2) * 10 + Math.abs(s.winRate - 50)));
    if (s.winRate < 35 && s.netPnl < 0) {
      patterns.push({
        id: `auto-sym-risk-${symbol}`,
        type: 'Risk',
        status: 'Active',
        title: `${symbol} is consistently unprofitable`,
        description: `Across ${group.length} trades, ${symbol} returned ${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(1)}R (${Math.round(s.winRate)}% win rate). The edge here is negative — this instrument may need to be paused or the setup re-validated.`,
        firstSeen: s.firstSeen,
        sessionCount: group.length,
        totalR: parseFloat(s.totalR.toFixed(2)),
        tags: [{ label: `${group.length} trades`, sentiment: 'neutral' }, { label: `${Math.round(s.winRate)}% win rate`, sentiment: 'negative' }],
        confidence,
        instrument: symbol,
        session: 'RTH open',
        sessions: s.sessions,
      });
    } else if (s.winRate >= 60 && s.netPnl > 0 && group.length >= 5) {
      patterns.push({
        id: `auto-sym-edge-${symbol}`,
        type: 'Edge',
        status: 'Confirmed',
        title: `${symbol} is a confirmed profit driver`,
        description: `${group.length} trades on ${symbol} yielded ${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(1)}R at ${Math.round(s.winRate)}% win rate. This instrument has a validated edge over this period — keep conditions tight.`,
        firstSeen: s.firstSeen,
        sessionCount: group.length,
        totalR: parseFloat(s.totalR.toFixed(2)),
        tags: [{ label: `${group.length} trades`, sentiment: 'neutral' }, { label: `${Math.round(s.winRate)}% win rate`, sentiment: 'positive' }],
        confidence,
        instrument: symbol,
        session: 'RTH open',
        sessions: s.sessions,
      });
    }
  });

  // ── Session patterns ─────────────────────────────────────────────
  const sessionGroups = groupBy(filtered, t => ((t.session ?? 'Other') as string) as any);
  sessionGroups.forEach((group, session) => {
    if (group.length < 5 || session === 'Other') return;
    const s = summariseGroup(group);
    const confidence = Math.min(92, Math.round(25 + (group.length / 3) * 10 + Math.abs(s.winRate - 50)));
    if (s.winRate < 40 && s.netPnl < 0) {
      patterns.push({
        id: `auto-sess-risk-${session}`,
        type: 'Risk',
        status: 'Active',
        title: `${session} session is your weakest window`,
        description: `Your ${session} trades returned ${s.totalR.toFixed(1)}R across ${group.length} trades (${Math.round(s.winRate)}% win rate). Consider reducing size or skipping entries during this session until execution improves.`,
        firstSeen: s.firstSeen,
        sessionCount: group.length,
        totalR: parseFloat(s.totalR.toFixed(2)),
        tags: [{ label: session, sentiment: 'neutral' }, { label: `${Math.round(s.winRate)}% win rate`, sentiment: 'negative' }],
        confidence,
        instrument: 'All',
        session: 'RTH open',
        sessions: s.sessions,
      });
    } else if (s.winRate >= 58 && s.netPnl > 0 && group.length >= 6) {
      patterns.push({
        id: `auto-sess-edge-${session}`,
        type: 'Edge',
        status: 'Confirmed',
        title: `${session} session is your edge window`,
        description: `${group.length} trades during ${session} returned +${s.totalR.toFixed(1)}R at ${Math.round(s.winRate)}% win rate. This is a statistically meaningful edge — protect it with consistent sizing.`,
        firstSeen: s.firstSeen,
        sessionCount: group.length,
        totalR: parseFloat(s.totalR.toFixed(2)),
        tags: [{ label: session, sentiment: 'neutral' }, { label: `${Math.round(s.winRate)}% win rate`, sentiment: 'positive' }],
        confidence,
        instrument: 'All',
        session: 'RTH open',
        sessions: s.sessions,
      });
    }
  });

  // ── Emotional state patterns ─────────────────────────────────────
  const stateGroups = groupBy(filtered, t => (t.emotional_state || 'Unspecified') as any);
  stateGroups.forEach((group, state) => {
    if (group.length < 3 || state === 'Unspecified') return;
    const s = summariseGroup(group);
    const confidence = Math.min(90, Math.round(20 + (group.length / 2) * 10 + Math.abs(s.winRate - 50)));
    if (s.winRate < 38 && s.netPnl < 0) {
      patterns.push({
        id: `auto-psych-risk-${state}`,
        type: 'Psychology',
        status: 'Active',
        title: `Trading when "${state}" is costing you money`,
        description: `${group.length} trades logged while feeling "${state}" returned ${s.totalR.toFixed(1)}R at ${Math.round(s.winRate)}% win rate. This emotional state correlates with underperformance — consider a no-trade rule when you feel this way.`,
        firstSeen: s.firstSeen,
        sessionCount: group.length,
        totalR: parseFloat(s.totalR.toFixed(2)),
        tags: [{ label: `"${state}"`, sentiment: 'negative' }, { label: `${group.length} trades`, sentiment: 'neutral' }],
        confidence,
        instrument: 'All',
        session: 'RTH open',
        sessions: s.sessions,
      });
    } else if (s.winRate >= 60 && s.netPnl > 0 && group.length >= 4) {
      patterns.push({
        id: `auto-psych-edge-${state}`,
        type: 'Psychology',
        status: 'Confirmed',
        title: `"${state}" is your optimal trading state`,
        description: `${group.length} trades when feeling "${state}" returned +${s.totalR.toFixed(1)}R at ${Math.round(s.winRate)}% win rate. This emotional state correlates with your best execution — note the conditions that produce it.`,
        firstSeen: s.firstSeen,
        sessionCount: group.length,
        totalR: parseFloat(s.totalR.toFixed(2)),
        tags: [{ label: `"${state}"`, sentiment: 'positive' }, { label: `${group.length} trades`, sentiment: 'neutral' }],
        confidence,
        instrument: 'All',
        session: 'RTH open',
        sessions: s.sessions,
      });
    }
  });

  return patterns.sort((a, b) => Math.abs(b.totalR) - Math.abs(a.totalR));
}

export default function FlyxaAIPatterns() {
  const { trades } = useTrades();
  const { filterTradesBySelectedAccount } = useAppSettings();
  const accountTrades = useMemo(
    () => (filterTradesBySelectedAccount(trades) as Trade[]).filter(Boolean),
    [filterTradesBySelectedAccount, trades]
  );

  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedType, setSelectedType] = useState<'All' | PatternType>('All');
  const [selectedSession, setSelectedSession] = useState<'All' | SessionBucket>('All');
  const [sortBy, setSortBy] = useState<SortOption>('impact');
  const [detectedTf, setDetectedTf] = useState<DetectedTimeFrame>('3M');

  const detectedPatterns = useMemo(
    () => detectPatternsFromTrades(accountTrades, detectedTf),
    [accountTrades, detectedTf]
  );

  const filteredPatterns = useMemo(() => {
    const base = patterns.filter(pattern => pattern.status !== 'Resolved');
    const byType = selectedType === 'All' ? base : base.filter(pattern => pattern.type === selectedType);
    const bySession = selectedSession === 'All' ? byType : byType.filter(pattern => pattern.session === selectedSession);
    return [...bySession].sort((a, b) => {
      if (sortBy === 'impact') return Math.abs(b.totalR) - Math.abs(a.totalR);
      if (sortBy === 'frequency') return b.sessionCount - a.sessionCount;
      return new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime();
    });
  }, [patterns, selectedType, selectedSession, sortBy]);

  const costingPatterns = filteredPatterns.filter(pattern => pattern.totalR < 0);
  const earningPatterns = filteredPatterns.filter(pattern => pattern.totalR >= 0);
  const resolvedPatterns = patterns.filter(pattern => pattern.status === 'Resolved');

  const summary = useMemo(() => {
    const activePatterns = filteredPatterns;
    const totalLost = activePatterns.filter(p => p.totalR < 0).reduce((sum, p) => sum + p.totalR, 0);
    const totalGained = activePatterns.filter(p => p.totalR > 0).reduce((sum, p) => sum + p.totalR, 0);
    return {
      totalLost,
      riskCount: activePatterns.filter(p => p.type === 'Risk').length,
      totalGained,
      edgeCount: activePatterns.filter(p => p.type === 'Edge' && p.status === 'Confirmed').length,
      improvingCount: activePatterns.filter(p => p.status === 'Improving').length,
      resolvedCount: resolvedPatterns.length,
    };
  }, [filteredPatterns, resolvedPatterns.length]);

  const togglePattern = (patternId: string) => {
    setExpandedPatternId(current => current === patternId ? null : patternId);
  };

  const markResolved = (patternId: string) => {
    setPatterns(current => current.map(pattern => {
      if (pattern.id !== patternId || pattern.status === 'Resolved') {
        return pattern;
      }

      return {
        ...pattern,
        resolvedFrom: pattern.status,
        status: 'Resolved',
      };
    }));
    setExpandedPatternId(null);
  };

  const unresolvePattern = (patternId: string) => {
    setPatterns(current => current.map(pattern => {
      if (pattern.id !== patternId || pattern.status !== 'Resolved') {
        return pattern;
      }

      return {
        ...pattern,
        status: pattern.resolvedFrom ?? 'Active',
        resolvedFrom: undefined,
      };
    }));
  };

  const renderPatternCard = (pattern: PatternItem) => {
    const accent = patternAccent(pattern.type);
    const isExpanded = expandedPatternId === pattern.id;
    const totalLabel = pattern.totalR < 0 ? 'Total cost' : 'Total earned';
    const totalColor = pattern.totalR < 0 ? '#f87171' : '#34d399';
    const confidenceTone = confidenceColor(pattern.confidence);

    return (
      <article
        key={pattern.id}
        className="grid cursor-pointer overflow-hidden rounded-[8px]"
        style={{ gridTemplateColumns: '4px minmax(0,1fr)', backgroundColor: colors.d2, border: cardBorder }}
        onClick={() => togglePattern(pattern.id)}
      >
        <div style={{ backgroundColor: accent }} />
        <div className="px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-[4px] px-2 py-1 text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: accent, backgroundColor: `${accent}1A`, border: `1px solid ${accent}40` }}>
                {pattern.type}
              </span>
              <span className="rounded-[4px] px-2 py-1 text-[10px] font-medium" style={statusStyles(pattern.status)}>
                {pattern.status}
              </span>
              <span className="text-[11px]" style={{ color: colors.t2 }}>First seen {new Date(pattern.firstSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {pattern.sessionCount} sessions</span>
            </div>
            <div className="text-right">
              <p className="text-[21px] font-semibold" style={{ color: totalColor }}>{pattern.totalR >= 0 ? '+' : ''}{pattern.totalR.toFixed(1)}R</p>
              <p className="text-[11px]" style={{ color: colors.t2 }}>{totalLabel}</p>
            </div>
          </div>

          <h3 className="mt-2.5 text-[14px] font-semibold" style={{ color: colors.t0 }}>{pattern.title}</h3>
          <p className="mt-1.5 text-[12px] leading-[1.65]" style={{ color: colors.t1 }}>{pattern.description}</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {pattern.tags.map(tag => (
                <span key={tag.label} className="rounded-[4px] px-2 py-[3px] text-[11px]" style={tagStyles(tag.sentiment)}>{tag.label}</span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: colors.t1 }}>Confidence</span>
                <div className="h-[3px] w-20 rounded-[2px]" style={{ backgroundColor: colors.d4 }}>
                  <div className="h-[3px] rounded-[2px]" style={{ width: `${pattern.confidence}%`, backgroundColor: confidenceTone }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: confidenceTone }}>{pattern.confidence}%</span>
              </div>
              <span className="text-[11px] font-medium" style={{ color: colors.acc }}>View sessions &rarr;</span>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 rounded-[8px] border p-3" style={{ borderColor: colors.b0, backgroundColor: colors.d3 }} onClick={event => event.stopPropagation()}>
              <p style={tinyMetaLabelStyle}>Sessions</p>
              <div className="mt-2 space-y-1.5">
                {pattern.sessions.map(session => (
                  <div key={`${pattern.id}-${session.date}-${session.rOutcome}`} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: colors.t1 }}>{new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span style={{ color: session.rOutcome >= 0 ? colors.grn : colors.red }}>{session.rOutcome >= 0 ? '+' : ''}{session.rOutcome.toFixed(1)}R</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => markResolved(pattern.id)}
                className="mt-3 rounded-[6px] border px-3 py-1.5 text-[12px] transition-colors"
                style={{ borderColor: colors.b1, backgroundColor: colors.d4, color: colors.t0 }}
              >
                Mark as resolved
              </button>
              <div className="mt-3 rounded-[6px] border p-3" style={{ borderColor: `${colors.acc}30`, backgroundColor: `rgba(245,158,11,0.07)` }}>
                <p style={{ ...tinyMetaLabelStyle, color: colors.acc }}>AI Suggestion</p>
                <p className="mt-1 text-[12px] leading-[1.6]" style={{ color: colors.t1 }}>Add a pre-trade checkpoint for this pattern: define entry condition, invalidation, and a max re-entry rule before placing the next order.</p>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-3.5rem)] overflow-hidden rounded-2xl" style={{ backgroundColor: colors.d0, color: colors.t0 }}>
      <div className="grid h-full grid-cols-[178px_minmax(0,1fr)] overflow-hidden">
        <FlyxaNav />

        <main className="min-h-0 overflow-hidden" style={{ backgroundColor: colors.d0 }}>
          <div className="flex h-full min-h-0 flex-col">
            <section className="border-b px-6 py-5" style={{ borderColor: colors.b0 }}>
              <p className="text-[9.5px] uppercase tracking-[0.12em]" style={{ color: colors.t2 }}>Flyxa AI</p>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-[24px] font-bold tracking-[-0.02em]" style={{ color: colors.t0 }}>Pattern library</h1>
                <div className="flex gap-0.5 rounded-[5px] p-0.5" style={{ backgroundColor: colors.d3 }}>
                  {(['1M', '3M', '6M', 'All'] as DetectedTimeFrame[]).map(tf => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setDetectedTf(tf)}
                      className="rounded-[3px] px-2.5 py-[3px] text-[10px] font-medium transition-colors"
                      style={{
                        backgroundColor: detectedTf === tf ? colors.d4 : 'transparent',
                        color: detectedTf === tf ? colors.t0 : colors.t2,
                        border: detectedTf === tf ? `1px solid ${colors.b1}` : '1px solid transparent',
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[12px]" style={{ color: colors.t2 }}>Patterns auto-detected from your trade history &middot; {detectedPatterns.length} found over {detectedTf === 'All' ? 'all time' : detectedTf === '1M' ? 'the last month' : detectedTf === '3M' ? 'the last 3 months' : 'the last 6 months'}</p>
            </section>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">

                {/* ── Auto-detected patterns ── */}
                {detectedPatterns.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: colors.acc }}>Auto-detected from trade history</p>
                      <span className="rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: colors.acc }}>{detectedPatterns.length}</span>
                    </div>
                    <div className="space-y-3">
                      {detectedPatterns.map(renderPatternCard)}
                    </div>
                  </section>
                )}
                {detectedPatterns.length === 0 && accountTrades.length > 0 && (
                  <div className="rounded-[8px] border px-4 py-3 text-[12px]" style={{ borderColor: colors.b0, backgroundColor: colors.d2, color: colors.t2 }}>
                    No statistically significant patterns found in the selected period. Patterns emerge once a symbol, session, or emotional state has 3–5+ trades with a consistent directional result. Keep logging.
                  </div>
                )}
                {accountTrades.length === 0 && (
                  <div className="rounded-[8px] border px-4 py-3 text-[12px]" style={{ borderColor: colors.b0, backgroundColor: colors.d2, color: colors.t2 }}>
                    No trade data found. Log trades in the journal to activate auto-detection.
                  </div>
                )}

                <section className="space-y-2 rounded-[8px] p-3" style={{ border: cardBorder, backgroundColor: colors.d2 }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={tinyMetaLabelStyle}>Type</span>
                    {(['All', 'Risk', 'Edge', 'Psychology', 'Behaviour'] as const).map(type => (
                      <button key={type} type="button" onClick={() => setSelectedType(type)} className={`rounded-[4px] border px-3 py-1 text-[12px] ${filterPillClass(selectedType === type)}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={tinyMetaLabelStyle}>Session</span>
                    {(['All', 'RTH open', 'Overlap', 'Midday'] as const).map(session => (
                      <button key={session} type="button" onClick={() => setSelectedSession(session)} className={`rounded-[4px] border px-3 py-1 text-[12px] ${filterPillClass(selectedSession === session)}`}>
                        {session}
                      </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                      <span style={tinyMetaLabelStyle}>Sort</span>
                      <select
                        value={sortBy}
                        onChange={event => setSortBy(event.target.value as SortOption)}
                        className="rounded-[4px] border px-2.5 py-1.5 text-[12px]"
                        style={{ borderColor: colors.b0, backgroundColor: colors.d3, color: colors.t0 }}
                      >
                        <option value="impact">Most impactful</option>
                        <option value="recent">Most recent</option>
                        <option value="frequency">Most frequent</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-[8px] p-3" style={{ border: cardBorder, backgroundColor: colors.d2 }}>
                    <p style={tinyMetaLabelStyle}>Costing you</p>
                    <p className="mt-1 text-[22px] font-semibold" style={{ color: colors.red }}>{summary.totalLost.toFixed(1)}R</p>
                    <p className="text-[12px]" style={{ color: colors.t2 }}>{summary.riskCount} active risk patterns</p>
                  </div>
                  <div className="rounded-[8px] p-3" style={{ border: cardBorder, backgroundColor: colors.d2 }}>
                    <p style={tinyMetaLabelStyle}>Making you money</p>
                    <p className="mt-1 text-[22px] font-semibold" style={{ color: colors.grn }}>+{summary.totalGained.toFixed(1)}R</p>
                    <p className="text-[12px]" style={{ color: colors.t2 }}>{summary.edgeCount} confirmed edges</p>
                  </div>
                  <div className="rounded-[8px] p-3" style={{ border: cardBorder, backgroundColor: colors.d2 }}>
                    <p style={tinyMetaLabelStyle}>Improving</p>
                    <p className="mt-1 text-[22px] font-semibold" style={{ color: colors.acc }}>{summary.improvingCount}</p>
                    <p className="text-[12px]" style={{ color: colors.t2 }}>patterns trending better</p>
                  </div>
                  <div className="rounded-[8px] p-3" style={{ border: cardBorder, backgroundColor: colors.d2 }}>
                    <p style={tinyMetaLabelStyle}>Resolved</p>
                    <p className="mt-1 text-[22px] font-semibold" style={{ color: colors.t1 }}>{summary.resolvedCount}</p>
                    <p className="text-[12px]" style={{ color: colors.t2 }}>eliminated patterns</p>
                  </div>
                </section>

                <section>
                  <div className="mb-2">
                    <p className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: colors.red }}>Manually tracked · Costing you</p>
                    <p className="text-[12px]" style={{ color: colors.t2 }}>{costingPatterns.length} patterns</p>
                  </div>
                  <div className="space-y-3">
                    {costingPatterns.map(renderPatternCard)}
                    {costingPatterns.length === 0 && (
                      <div className="rounded-[8px] border p-4 text-[12px]" style={{ borderColor: colors.b0, backgroundColor: colors.d2, color: colors.t2 }}>
                        No real risk patterns detected from your current trades.
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-2">
                    <p className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: colors.grn }}>Manually tracked · Making you money</p>
                    <p className="text-[12px]" style={{ color: colors.t2 }}>{earningPatterns.length} patterns</p>
                  </div>
                  <div className="space-y-3">
                    {earningPatterns.map(renderPatternCard)}
                    {earningPatterns.length === 0 && (
                      <div className="rounded-[8px] border p-4 text-[12px]" style={{ borderColor: colors.b0, backgroundColor: colors.d2, color: colors.t2 }}>
                        No real earning patterns detected from your current trades.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[8px] p-3" style={{ border: cardBorder, backgroundColor: colors.d2 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9.5px] font-medium uppercase tracking-[0.12em]" style={{ color: colors.t1 }}>Resolved</p>
                      <p className="text-[12px]" style={{ color: colors.t2 }}>{resolvedPatterns.length} eliminated patterns</p>
                    </div>
                    <button type="button" onClick={() => setShowResolved(value => !value)} className="text-[12px] font-medium transition-colors" style={{ color: colors.t1 }}>
                      {showResolved ? 'Hide all ↑' : 'Show all ↓'}
                    </button>
                  </div>
                  {showResolved && (
                    <div className="mt-3 space-y-2">
                      {resolvedPatterns.map(pattern => {
                        const lastSeen = pattern.sessions.length > 0 ? pattern.sessions[0].date : pattern.firstSeen;
                        return (
                          <div key={pattern.id} className="rounded-[8px] border px-3 py-2 text-[12px]" style={{ borderColor: colors.b0, backgroundColor: colors.d3, color: colors.t2 }}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span style={{ color: colors.t1 }}>{pattern.title}</span>
                                <p className="mt-0.5">Last seen {new Date(lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span style={{ color: colors.t1 }}>~{Math.abs(pattern.totalR).toFixed(1)}R saved</span>
                                <button
                                  type="button"
                                  onClick={() => unresolvePattern(pattern.id)}
                                  className="rounded-[4px] border px-2 py-1 text-[11px] transition-colors"
                                  style={{ borderColor: colors.b1, backgroundColor: colors.d4, color: colors.t0 }}
                                >
                                  Unresolve
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
