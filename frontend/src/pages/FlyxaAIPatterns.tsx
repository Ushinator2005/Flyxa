import { CSSProperties, useMemo, useState } from 'react';
import FlyxaNav from '../components/flyxa/FlyxaNav.js';

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

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const subSectionLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#64748b',
};

const cardBorder = '1px solid rgba(255,255,255,0.07)';


export const patternsData: PatternItem[] = [
  {
    id: 'p1',
    type: 'Risk',
    status: 'Active',
    title: 'Open-hour overtrading after first loss',
    description: 'You tend to add one or two low-conviction entries in the first 30 minutes after an initial loss, which expands drawdown quickly.',
    firstSeen: '2026-01-15',
    sessionCount: 9,
    totalR: -6.7,
    tags: [
      { label: '-6.7R total', sentiment: 'negative' },
      { label: 'Mostly ES', sentiment: 'neutral' },
      { label: 'After first red trade', sentiment: 'neutral' },
    ],
    confidence: 88,
    instrument: 'ES',
    session: 'RTH open',
    sessions: [
      { date: '2026-04-05', rOutcome: -1.2 },
      { date: '2026-04-02', rOutcome: -0.9 },
      { date: '2026-03-27', rOutcome: -0.8 },
      { date: '2026-03-19', rOutcome: -1.1 },
    ],
  },
  {
    id: 'p2',
    type: 'Behaviour',
    status: 'Improving',
    title: 'Early TP on clean continuation setups',
    description: 'When in profit quickly, you trim too early and miss full target range. This has improved but still caps upside.',
    firstSeen: '2026-02-08',
    sessionCount: 7,
    totalR: -2.4,
    tags: [
      { label: 'Improving over 3 weeks', sentiment: 'positive' },
      { label: '-2.4R missed', sentiment: 'negative' },
    ],
    confidence: 64,
    instrument: 'NQ',
    session: 'Overlap',
    sessions: [
      { date: '2026-04-03', rOutcome: -0.3 },
      { date: '2026-03-31', rOutcome: -0.2 },
      { date: '2026-03-21', rOutcome: -0.6 },
    ],
  },
  {
    id: 'p3',
    type: 'Edge',
    status: 'Confirmed',
    title: 'London/NY overlap pullback continuation',
    description: 'Highest repeatability pattern. Entries after second pullback during overlap sessions continue to produce above-average returns.',
    firstSeen: '2025-12-20',
    sessionCount: 14,
    totalR: 11.3,
    tags: [
      { label: '+11.3R total', sentiment: 'positive' },
      { label: '67% win rate', sentiment: 'positive' },
      { label: 'NQ edge', sentiment: 'neutral' },
    ],
    confidence: 92,
    instrument: 'NQ',
    session: 'Overlap',
    sessions: [
      { date: '2026-04-04', rOutcome: 1.8 },
      { date: '2026-03-30', rOutcome: 1.1 },
      { date: '2026-03-25', rOutcome: 0.9 },
      { date: '2026-03-14', rOutcome: 1.4 },
    ],
  },
  {
    id: 'p4',
    type: 'Psychology',
    status: 'Active',
    title: 'Frustration carry-over into next session',
    description: 'After a larger red day, the first entries in the following session are often reactive and outside planned setup criteria.',
    firstSeen: '2026-01-29',
    sessionCount: 6,
    totalR: -3.9,
    tags: [
      { label: 'Post-loss behavior', sentiment: 'negative' },
      { label: '-3.9R impact', sentiment: 'negative' },
    ],
    confidence: 73,
    instrument: 'ES',
    session: 'RTH open',
    sessions: [
      { date: '2026-04-01', rOutcome: -1.0 },
      { date: '2026-03-12', rOutcome: -0.7 },
      { date: '2026-02-26', rOutcome: -1.1 },
    ],
  },
  {
    id: 'p5',
    type: 'Edge',
    status: 'Confirmed',
    title: 'Midday mean-reversion fade at prior day extremes',
    description: 'When midday volatility compresses, fades from prior-day extremes have produced consistent positive R with controlled downside.',
    firstSeen: '2026-02-18',
    sessionCount: 8,
    totalR: 5.6,
    tags: [
      { label: '+5.6R earned', sentiment: 'positive' },
      { label: 'Midday only', sentiment: 'neutral' },
    ],
    confidence: 81,
    instrument: 'ES',
    session: 'Midday',
    sessions: [
      { date: '2026-04-06', rOutcome: 0.9 },
      { date: '2026-03-28', rOutcome: 0.8 },
      { date: '2026-03-22', rOutcome: 0.6 },
    ],
  },
  {
    id: 'p6',
    type: 'Behaviour',
    status: 'Resolved',
    title: 'Chasing momentum candle closes',
    description: 'Previously entered late momentum candles without structure confirmation; no longer present in recent sessions.',
    firstSeen: '2025-11-12',
    sessionCount: 10,
    totalR: -4.2,
    tags: [
      { label: 'Eliminated pattern', sentiment: 'positive' },
    ],
    confidence: 86,
    instrument: 'NQ',
    session: 'RTH open',
    sessions: [
      { date: '2026-01-20', rOutcome: -0.4 },
      { date: '2026-01-07', rOutcome: -0.5 },
    ],
  },
];

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
  if (active) return 'border-[#4a9eff] bg-[rgba(74,158,255,0.12)] text-[#4a9eff]';
  return 'border-white/10 bg-[#0d1526] text-[#94a3b8] hover:text-[#cbd5e1]';
}

export default function FlyxaAIPatterns() {
  const [patterns, setPatterns] = useState<PatternItem[]>(patternsData);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedType, setSelectedType] = useState<'All' | PatternType>('All');
  const [selectedSession, setSelectedSession] = useState<'All' | SessionBucket>('All');
  const [sortBy, setSortBy] = useState<SortOption>('impact');

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
        className="grid cursor-pointer overflow-hidden rounded-xl"
        style={{ gridTemplateColumns: '4px minmax(0,1fr)', backgroundColor: '#0d1526', border: cardBorder }}
        onClick={() => togglePattern(pattern.id)}
      >
        <div style={{ backgroundColor: accent }} />
        <div className="px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: accent, backgroundColor: `${accent}1A`, border: `1px solid ${accent}40` }}>
                {pattern.type}
              </span>
              <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={statusStyles(pattern.status)}>
                {pattern.status}
              </span>
              <span className="text-[11px] text-[#64748b]">First seen {new Date(pattern.firstSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {pattern.sessionCount} sessions</span>
            </div>
            <div className="text-right">
              <p className="text-[21px] font-semibold" style={{ color: totalColor }}>{pattern.totalR >= 0 ? '+' : ''}{pattern.totalR.toFixed(1)}R</p>
              <p className="text-[11px] text-[#64748b]">{totalLabel}</p>
            </div>
          </div>

          <h3 className="mt-2.5 text-[14px] font-semibold text-[#e2e8f0]">{pattern.title}</h3>
          <p className="mt-1.5 text-[12px] leading-[1.65] text-[#475569]">{pattern.description}</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {pattern.tags.map(tag => (
                <span key={tag.label} className="rounded-full px-2 py-[3px] text-[11px]" style={tagStyles(tag.sentiment)}>{tag.label}</span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#94a3b8]">Confidence</span>
                <div className="h-[3px] w-20 rounded-full bg-white/10">
                  <div className="h-[3px] rounded-full" style={{ width: `${pattern.confidence}%`, backgroundColor: confidenceTone }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: confidenceTone }}>{pattern.confidence}%</span>
              </div>
              <span className="text-[11px] font-medium text-[#4a9eff]">View sessions -&gt;</span>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 rounded-lg border border-white/10 bg-[#0a101d] p-3" onClick={event => event.stopPropagation()}>
              <p style={subSectionLabelStyle}>Sessions</p>
              <div className="mt-2 space-y-1.5">
                {pattern.sessions.map(session => (
                  <div key={`${pattern.id}-${session.date}-${session.rOutcome}`} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#94a3b8]">{new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span style={{ color: session.rOutcome >= 0 ? '#34d399' : '#f87171' }}>{session.rOutcome >= 0 ? '+' : ''}{session.rOutcome.toFixed(1)}R</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => markResolved(pattern.id)}
                className="mt-3 rounded-md border border-white/10 bg-[#11192a] px-3 py-1.5 text-[12px] text-[#cbd5e1] hover:bg-[#1a253a]"
              >
                Mark as resolved
              </button>
              <div className="mt-3 rounded-md border border-[#4a9eff]/30 bg-[#4a9eff]/10 p-3">
                <p style={{ ...subSectionLabelStyle, color: '#4a9eff' }}>AI Suggestion</p>
                <p className="mt-1 text-[12px] leading-[1.6] text-[#94a3b8]">Add a pre-trade checkpoint for this pattern: define entry condition, invalidation, and a max re-entry rule before placing the next order.</p>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="animate-fade-in -m-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#060a12] text-[#e2e8f0]">
      <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] overflow-hidden">
        <FlyxaNav />

        <main className="min-h-0 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <header>
              <h1 className="text-[26px] font-semibold text-[#e2e8f0]">Pattern library</h1>
              <p className="mt-1 text-[13px] text-[#64748b]">Track recurring behaviors, confirm edges, and close leakage loops.</p>
            </header>

            <section className="space-y-2 rounded-xl border p-3" style={{ border: cardBorder, backgroundColor: '#0d1526' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span style={subSectionLabelStyle}>Type</span>
                {(['All', 'Risk', 'Edge', 'Psychology', 'Behaviour'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setSelectedType(type)} className={`rounded-full border px-3 py-1 text-[12px] ${filterPillClass(selectedType === type)}`}>
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span style={subSectionLabelStyle}>Session</span>
                {(['All', 'RTH open', 'Overlap', 'Midday'] as const).map(session => (
                  <button key={session} type="button" onClick={() => setSelectedSession(session)} className={`rounded-full border px-3 py-1 text-[12px] ${filterPillClass(selectedSession === session)}`}>
                    {session}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span style={subSectionLabelStyle}>Sort</span>
                  <select value={sortBy} onChange={event => setSortBy(event.target.value as SortOption)} className="rounded-md border border-white/10 bg-[#0a101d] px-2.5 py-1.5 text-[12px] text-[#cbd5e1]">
                    <option value="impact">Most impactful</option>
                    <option value="recent">Most recent</option>
                    <option value="frequency">Most frequent</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border p-3" style={{ border: cardBorder, backgroundColor: '#0d1526' }}>
                <p style={subSectionLabelStyle}>Costing you</p>
                <p className="mt-1 text-[22px] font-semibold text-[#f87171]">{summary.totalLost.toFixed(1)}R</p>
                <p className="text-[12px] text-[#64748b]">{summary.riskCount} active risk patterns</p>
              </div>
              <div className="rounded-xl border p-3" style={{ border: cardBorder, backgroundColor: '#0d1526' }}>
                <p style={subSectionLabelStyle}>Making you money</p>
                <p className="mt-1 text-[22px] font-semibold text-[#34d399]">+{summary.totalGained.toFixed(1)}R</p>
                <p className="text-[12px] text-[#64748b]">{summary.edgeCount} confirmed edges</p>
              </div>
              <div className="rounded-xl border p-3" style={{ border: cardBorder, backgroundColor: '#0d1526' }}>
                <p style={subSectionLabelStyle}>Improving</p>
                <p className="mt-1 text-[22px] font-semibold text-[#f59e0b]">{summary.improvingCount}</p>
                <p className="text-[12px] text-[#64748b]">patterns trending better</p>
              </div>
              <div className="rounded-xl border p-3" style={{ border: cardBorder, backgroundColor: '#0d1526' }}>
                <p style={subSectionLabelStyle}>Resolved</p>
                <p className="mt-1 text-[22px] font-semibold text-[#94a3b8]">{summary.resolvedCount}</p>
                <p className="text-[12px] text-[#64748b]">eliminated patterns</p>
              </div>
            </section>

            <section>
              <div className="mb-2">
                <p style={{ ...sectionLabelStyle, color: '#f87171' }}>Costing you</p>
                <p className="text-[12px] text-[#64748b]">{costingPatterns.length} patterns</p>
              </div>
              <div className="space-y-3">
                {costingPatterns.map(renderPatternCard)}
                {costingPatterns.length === 0 && <p className="text-[12px] text-[#64748b]">No patterns match current filters.</p>}
              </div>
            </section>

            <section>
              <div className="mb-2">
                <p style={{ ...sectionLabelStyle, color: '#34d399' }}>Making you money</p>
                <p className="text-[12px] text-[#64748b]">{earningPatterns.length} patterns</p>
              </div>
              <div className="space-y-3">
                {earningPatterns.map(renderPatternCard)}
                {earningPatterns.length === 0 && <p className="text-[12px] text-[#64748b]">No patterns match current filters.</p>}
              </div>
            </section>

            <section className="rounded-xl border p-3" style={{ border: cardBorder, backgroundColor: '#0d1526' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ ...sectionLabelStyle, color: '#94a3b8' }}>Resolved</p>
                  <p className="text-[12px] text-[#64748b]">{resolvedPatterns.length} eliminated patterns</p>
                </div>
                <button type="button" onClick={() => setShowResolved(value => !value)} className="text-[12px] font-medium text-[#94a3b8] hover:text-[#cbd5e1]">
                  {showResolved ? 'Hide all ↑' : 'Show all ↓'}
                </button>
              </div>
              {showResolved && (
                <div className="mt-3 space-y-2">
                  {resolvedPatterns.map(pattern => {
                    const lastSeen = pattern.sessions.length > 0 ? pattern.sessions[0].date : pattern.firstSeen;
                    return (
                      <div key={pattern.id} className="rounded-md border border-white/5 bg-[#0a101d] px-3 py-2 text-[12px] text-[#64748b]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[#94a3b8]">{pattern.title}</span>
                            <p className="mt-0.5">Last seen {new Date(lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#94a3b8]">~{Math.abs(pattern.totalR).toFixed(1)}R saved</span>
                            <button
                              type="button"
                              onClick={() => unresolvePattern(pattern.id)}
                              className="rounded border border-white/10 bg-[#11192a] px-2 py-1 text-[11px] text-[#cbd5e1] hover:bg-[#1a253a]"
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
        </main>
      </div>
    </div>
  );
}
