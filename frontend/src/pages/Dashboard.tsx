import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Target, BarChart2,
  ArrowUpRight, ArrowDownRight, Eye, Filter, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import {
  PieChart, Pie, Cell,
} from 'recharts';
import { format } from 'date-fns';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings, ALL_ACCOUNTS_ID } from '../contexts/AppSettingsContext.js';
import {
  buildAnalyticsSummary,
  buildRecentTrades,
  getTradeRiskReward,
} from '../utils/tradeAnalytics.js';
import { formatRiskRewardRatio } from '../utils/riskReward.js';
import MonthlyHeatmap from '../components/dashboard/MonthlyHeatmap.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { Trade } from '../types/index.js';

// ── Design tokens ────────────────────────────────────────────────
const COBALT      = '#1E6FFF';
const COBALT_DIM  = 'rgba(30,111,255,0.10)';
const AMBER       = '#f59e0b';
const AMBER_DIM   = 'rgba(245,158,11,0.10)';
const GREEN       = '#22c55e';
const GREEN_DIM   = 'rgba(34,197,94,0.10)';
const RED         = '#ef4444';
const RED_DIM     = 'rgba(239,68,68,0.10)';
const S1          = 'var(--app-panel)';
const S2          = 'var(--app-panel-strong)';
const BORDER      = 'var(--app-border)';
const BSUB        = 'rgba(255,255,255,0.04)';
const T1          = 'var(--app-text)';
const T2          = 'var(--app-text-muted)';
const T3          = 'var(--app-text-subtle)';
const MONO        = 'var(--font-mono)';
const SANS        = 'var(--font-sans)';

// ── Helpers ──────────────────────────────────────────────────────
const fmtUSD = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtPct = (v: number) => v.toFixed(1) + '%';
const fmtRR  = (v: number) => formatRiskRewardRatio(v, { placeholder: '1:0 RR' });
const fmtSignedCompactUSD = (v: number) => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.abs(v)).replace('K', 'k');
  return `${v >= 0 ? '+' : '-'}${formatted}`;
};

function winRateBadge(winRate: number): string {
  const diff = Math.round(winRate - 50);
  if (diff === 0) return 'At target';
  return `${Math.abs(diff)} pts ${diff > 0 ? 'above' : 'below'} target`;
}

// ── Sub-components ───────────────────────────────────────────────

function IconBadge({ color, dim, children }: { color: string; dim: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
      background: dim, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  );
}

function EquityCurveIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <path d="M2 14H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
      <path d="M2 11L6 8L9 9L12 5L15 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RiskRewardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="5.5" height="9" rx="1.2" fill={RED} fillOpacity="0.55" />
      <rect x="9.5" y="4" width="5.5" height="9" rx="1.2" fill={GREEN} fillOpacity="0.75" />
      <path d="M8.5 3V14" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

type BadgeTone = 'positive' | 'negative' | 'neutral';

function DeltaBadge({ label, tone = 'neutral' }: { label?: string; tone?: BadgeTone }) {
  if (label === undefined) return null;
  if (tone === 'neutral') {
    return (
      <span style={{
        fontSize: 11, fontFamily: MONO, color: T3,
        background: 'rgba(255,255,255,0.05)',
        padding: '2px 7px', borderRadius: 3,
      }}>{label}</span>
    );
  }
  const pos = tone === 'positive';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontFamily: MONO, fontVariantNumeric: 'tabular-nums',
      color: pos ? GREEN : RED,
      background: pos ? GREEN_DIM : RED_DIM,
      padding: '2px 7px', borderRadius: 3,
    }}>
      {pos ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {label}
    </span>
  );
}

function DirBadge({ dir }: { dir: 'Long' | 'Short' }) {
  const long = dir === 'Long';
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, fontFamily: SANS, letterSpacing: '0.06em',
      color: long ? COBALT : '#f87171',
      background: long ? COBALT_DIM : RED_DIM,
      padding: '2px 7px', borderRadius: 3,
    }}>
      {dir.toUpperCase()}
    </span>
  );
}

function Pill({ color, bg, children }: { color: string; bg: string; children: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, fontFamily: SANS, color, background: bg, padding: '2px 7px', borderRadius: 3 }}>
      {children}
    </span>
  );
}

function ResultBadge({ trade }: { trade: Trade }) {
  const open = !trade.exit_price || trade.exit_price === 0;
  if (open)          return <Pill color={AMBER} bg={AMBER_DIM}>OPEN</Pill>;
  if (trade.pnl > 0) return <Pill color={GREEN} bg={GREEN_DIM}>WIN</Pill>;
  return                    <Pill color={RED}   bg={RED_DIM}>LOSS</Pill>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S1, border: `1px solid ${BORDER}`, borderRadius: 8, ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${BSUB}`,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: T1, margin: 0, marginBottom: sub ? 2 : 0 }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: T3, margin: 0 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function StatCard({ icon, color, dim, label, value, badgeLabel, badgeTone = 'neutral' }: {
  icon: React.ReactNode; color: string; dim: string;
  label: string; value: string;
  badgeLabel?: string; badgeTone?: BadgeTone;
}) {
  return (
    <Card>
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <IconBadge color={color} dim={dim}>{icon}</IconBadge>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T3, marginBottom: 6 }}>
            {label}
          </p>
          <p style={{
            fontSize: 20, fontWeight: 500, fontFamily: MONO,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
            fontFeatureSettings: "'zero' 1",
            lineHeight: 1, marginBottom: 6, color: T1,
          }}>
            {value}
          </p>
          <DeltaBadge label={badgeLabel} tone={badgeTone} />
        </div>
      </div>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { trades, loading, deleteTrade } = useTrades();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const { accounts, selectedAccountId, setSelectedAccountId, filterTradesBySelectedAccount } = useAppSettings();
  const filteredTrades = useMemo(
    () => filterTradesBySelectedAccount(trades),
    [filterTradesBySelectedAccount, trades],
  );
  const summary      = useMemo(() => buildAnalyticsSummary(filteredTrades), [filteredTrades]);
  const recentTrades = useMemo(() => buildRecentTrades(filteredTrades).slice(0, 25), [filteredTrades]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayTrades = useMemo(
    () => filteredTrades
      .filter(t => t.trade_date === todayStr)
      .sort((a, b) => (a.trade_time ?? '').localeCompare(b.trade_time ?? '')),
    [filteredTrades, todayStr],
  );

  const tradesByDate = useMemo(() => {
    const m: Record<string, Trade[]> = {};
    filteredTrades.forEach(t => { (m[t.trade_date] ??= []).push(t); });
    return m;
  }, [filteredTrades]);

  // Calendar week Mon–Sun
  const weekDays = useMemo(() => {
    const today = new Date();
    const dow = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((dow + 6) % 7) + (weekOffset * 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const wins   = filteredTrades.filter(t => t.pnl > 0).length;
  const losses = filteredTrades.filter(t => t.pnl < 0).length;
  const winRingData = wins + losses > 0
    ? [{ v: wins, c: GREEN }, { v: losses, c: 'rgba(255,255,255,0.06)' }]
    : [{ v: 1, c: 'rgba(255,255,255,0.06)' }];

  const todayPnL    = todayTrades.reduce((s, t) => s + t.pnl, 0);
  const selectedAcct = selectedAccountId !== ALL_ACCOUNTS_ID
    ? accounts.find(a => a.id === selectedAccountId)
    : undefined;
  const acctName    = selectedAcct?.name ?? 'All Accounts';

  const displayTrades = recentTrades;

  function goToTradeInJournal(trade: Trade) {
    const params = new URLSearchParams();
    if (trade.trade_date) params.set('date', trade.trade_date);
    params.set('tradeId', trade.id);
    navigate(`/trade-scanner?${params.toString()}`);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--app-bg)' }}>
        <LoadingSpinner size="lg" label="Loading..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: SANS }}>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: T1, margin: 0, letterSpacing: '-0.02em' }}>
              Dashboard
            </h1>
            <p style={{ fontSize: 12, color: T3, margin: '3px 0 0' }}>
              {format(new Date(), 'EEEE, MMMM d')}
              {' · '}
              <span style={{ color: AMBER }}>{acctName}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                style={{
                  height: 34, paddingLeft: 12, paddingRight: 28,
                  appearance: 'none',
                  background: S1, border: `1px solid ${BORDER}`,
                  borderRadius: 5, fontSize: 12, fontFamily: SANS,
                  color: T1, outline: 'none', cursor: 'pointer',
                  minWidth: 170,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; }}
                onBlur={e =>  { e.currentTarget.style.borderColor = BORDER; }}
              >
                <option value={ALL_ACCOUNTS_ID}>All Accounts</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <span style={{ pointerEvents: 'none', position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: T3 }}>▼</span>
            </div>
            <button
              onClick={() => navigate('/trade-scanner')}
              style={{
                height: 34, padding: '0 14px',
                background: AMBER, border: 'none', borderRadius: 5,
                fontSize: 12, fontWeight: 600, color: '#000', cursor: 'pointer',
                fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              <TrendingUp size={13} />
              Log trade
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flexShrink: 0 }}>
          <StatCard
            icon={<EquityCurveIcon />} color={AMBER} dim={AMBER_DIM}
            label="Net P&L"
            value={fmtUSD(summary.netPnL)}
            badgeLabel={todayTrades.length > 0 ? `Today ${fmtSignedCompactUSD(todayPnL)}` : 'No trades today'}
            badgeTone={todayTrades.length === 0 ? 'neutral' : todayPnL >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            icon={<Target size={17} />} color={COBALT} dim={COBALT_DIM}
            label="Win Rate"
            value={fmtPct(summary.winRate)}
            badgeLabel={summary.totalTrades > 0 ? winRateBadge(summary.winRate) : 'No closed trades'}
            badgeTone={summary.totalTrades === 0 ? 'neutral' : summary.winRate >= 50 ? 'positive' : 'negative'}
          />
          <StatCard
            icon={<RiskRewardIcon />} color={GREEN} dim={GREEN_DIM}
            label="Avg R:R"
            value={fmtRR(summary.avgRR)}
            badgeLabel={summary.avgRR > 0 ? (summary.avgRR >= 1 ? 'Above 1:1' : 'Below 1:1') : 'No ratio yet'}
            badgeTone={summary.avgRR === 0 ? 'neutral' : summary.avgRR >= 1 ? 'positive' : 'negative'}
          />
          <StatCard
            icon={<BarChart2 size={17} />} color={RED} dim={RED_DIM}
            label="Trades"
            value={String(summary.totalTrades)}
            badgeLabel={`${todayTrades.length} Today`}
          />
        </div>

        {/* 2-column content grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, flex: 1, minHeight: 0 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            {/* P&L Calendar */}
            <Card style={{ flexShrink: 0 }}>
              <div style={{ padding: '14px 18px' }}>
                <MonthlyHeatmap trades={filteredTrades} />
              </div>
            </Card>

            {/* Recent Trades table */}
            <Card>
              <CardHeader
                title="Recent Trades"
                sub={`${displayTrades.length} trade${displayTrades.length !== 1 ? 's' : ''}`}
                right={
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontFamily: SANS, color: T2,
                    background: S2, border: `1px solid ${BORDER}`,
                    borderRadius: 4, padding: '5px 10px', cursor: 'pointer',
                  }}>
                    <Filter size={11} /> Filter
                  </button>
                }
              />
              {displayTrades.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: T3 }}>
                  No trades yet — log your first trade to get started.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Symbol', 'Dir', 'Entry', 'Exit', 'Qty', 'R:R', 'P&L', 'Result'].map(col => (
                          <th key={col} style={{
                            padding: '9px 14px',
                            paddingRight: col === 'Result' ? 36 : 14,
                            textAlign: col === 'P&L' || col === 'Result' ? 'right' : 'left',
                            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                            textTransform: 'uppercase', color: T3, whiteSpace: 'nowrap',
                            borderBottom: `1px solid ${BSUB}`, fontFamily: SANS,
                          }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayTrades.map((trade, i) => {
                        const rrVal = getTradeRiskReward(trade);
                        return (
                          <tr
                            key={trade.id}
                            style={{ borderBottom: i < displayTrades.length - 1 ? `1px solid ${BSUB}` : 'none', transition: 'background 0.12s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.015)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '9px 14px' }}>
                              <div style={{ fontSize: 13, fontWeight: 500, fontFamily: MONO, color: T1 }}>{trade.symbol || 'N/A'}</div>
                              <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{trade.trade_date}</div>
                            </td>
                            <td style={{ padding: '9px 14px' }}>
                              {(trade.direction === 'Long' || trade.direction === 'Short')
                                ? <DirBadge dir={trade.direction} />
                                : <span style={{ color: T3, fontSize: 12 }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 14px', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: T2 }}>
                              ${trade.entry_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                            </td>
                            <td style={{ padding: '9px 14px', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: T2 }}>
                              ${trade.exit_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                            </td>
                            <td style={{ padding: '9px 14px', fontFamily: MONO, fontSize: 12, color: T2 }}>
                              {trade.contract_size}
                            </td>
                            <td style={{ padding: '9px 14px', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: T2 }}>
                              {rrVal !== null ? fmtRR(rrVal) : '—'}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: trade.pnl > 0 ? GREEN : trade.pnl < 0 ? RED : AMBER }}>
                              {fmtUSD(trade.pnl)}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <ResultBadge trade={trade} />
                                <button
                                  type="button"
                                  title="View in Journal"
                                  onClick={() => goToTradeInJournal(trade)}
                                  style={{ border: 'none', background: 'transparent', padding: 2, color: T3, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', lineHeight: 0 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = COBALT; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = T3; }}
                                >
                                  <Eye size={13} />
                                </button>
                                {pendingDeleteId === trade.id ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <button
                                      type="button"
                                      onClick={() => { deleteTrade(trade.id); setPendingDeleteId(null); }}
                                      style={{ fontSize: 11, fontFamily: SANS, padding: '2px 8px', borderRadius: 4, border: 'none', background: RED, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                                    >Delete</button>
                                    <button
                                      type="button"
                                      onClick={() => setPendingDeleteId(null)}
                                      style={{ fontSize: 11, fontFamily: SANS, padding: '2px 8px', borderRadius: 4, border: `1px solid ${BORDER}`, background: 'transparent', color: T2, cursor: 'pointer' }}
                                    >Cancel</button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    title="Delete trade"
                                    onClick={() => setPendingDeleteId(trade.id)}
                                    style={{ border: 'none', background: 'transparent', padding: 2, color: T3, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', lineHeight: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = RED; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = T3; }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Right column — widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

            {/* Win Rate ring */}
            <Card style={{ padding: 16, flexShrink: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T1, marginBottom: 14 }}>Win Rate</p>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <PieChart width={132} height={132}>
                  <Pie
                    data={winRingData} dataKey="v"
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={62}
                    stroke="none" isAnimationActive={false}
                    startAngle={90} endAngle={-270}
                  >
                    {winRingData.map((entry, i) => <Cell key={i} fill={entry.c} />)}
                  </Pie>
                </PieChart>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 400, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: T1, lineHeight: 1 }}>
                    {fmtPct(summary.winRate)}
                  </div>
                  <div style={{ fontSize: 10, color: T3, marginTop: 3, letterSpacing: '0.06em' }}>Win Rate</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                {[{ label: `${wins} wins`, color: GREEN }, { label: `${losses} losses`, color: RED }].map(l => (
                  <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T2 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </Card>

            {/* Calendar strip */}
            <Card style={{ padding: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T1, margin: 0 }}>
                  Today, {format(new Date(), 'MMM d')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {weekOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setWeekOffset(0)}
                      style={{
                        height: 20,
                        padding: '0 7px',
                        borderRadius: 4,
                        border: `1px solid ${BORDER}`,
                        background: 'transparent',
                        color: T2,
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Now
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setWeekOffset(prev => prev - 1)}
                    aria-label="Previous week"
                    style={{
                      width: 20,
                      height: 20,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 4,
                      border: `1px solid ${BORDER}`,
                      background: 'transparent',
                      color: T2,
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekOffset(prev => prev + 1)}
                    aria-label="Next week"
                    style={{
                      width: 20,
                      height: 20,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 4,
                      border: `1px solid ${BORDER}`,
                      background: 'transparent',
                      color: T2,
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 10, color: T3, marginBottom: 12 }}>
                Week of {format(weekDays[0], 'MMM d')}
                {weekOffset !== 0 ? ` (${weekOffset > 0 ? '+' : ''}${weekOffset}w)` : ''}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {weekDays.map(day => {
                  const ds      = format(day, 'yyyy-MM-dd');
                  const dayTr   = tradesByDate[ds] ?? [];
                  const isToday = ds === todayStr;
                  const dayW    = dayTr.filter(t => t.pnl > 0);
                  const dayL    = dayTr.filter(t => t.pnl < 0);
                  return (
                    <div key={ds} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      padding: '5px 2px', borderRadius: 5,
                      background: isToday ? AMBER_DIM : 'transparent',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isToday ? AMBER : T3 }}>
                        {format(day, 'EEE').slice(0, 2)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: isToday ? AMBER : T1 }}>
                        {format(day, 'd')}
                      </span>
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', minHeight: 8 }}>
                        {dayW.slice(0, 3).map((_, i) => <span key={`w${i}`} style={{ width: 4, height: 4, borderRadius: '50%', background: GREEN }} />)}
                        {dayL.slice(0, 3).map((_, i) => <span key={`l${i}`} style={{ width: 4, height: 4, borderRadius: '50%', background: RED }} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Daily trade log */}
            <Card style={{ padding: 16, flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T1, marginBottom: 12 }}>Today's Log</p>
              {todayTrades.length === 0 ? (
                <p style={{ fontSize: 12, color: T3, textAlign: 'center', padding: '16px 0' }}>No trades today.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {todayTrades.map(trade => {
                    const open   = !trade.exit_price || trade.exit_price === 0;
                    const isWin  = trade.pnl > 0;
                    const badgeBg    = open ? AMBER_DIM   : isWin ? 'rgba(34,197,94,0.10)'  : RED_DIM;
                    const badgeColor = open ? AMBER        : isWin ? GREEN                    : RED;
                    const Icon       = open ? TrendingUp   : isWin ? ArrowUpRight             : ArrowDownRight;
                    return (
                      <div key={trade.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ fontSize: 10, fontFamily: MONO, color: T3, flexShrink: 0, width: 36 }}>
                          {(trade.trade_time ?? '--:--').slice(0, 5)}
                        </span>
                        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: badgeBg, color: badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={13} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 450, color: T1, fontFamily: MONO }}>{trade.symbol}</div>
                          <div style={{ fontSize: 10, color: T3 }}>{trade.direction} · {trade.session}</div>
                        </div>
                        <span style={{ fontSize: 12, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: "'zero' 1", fontWeight: 500, flexShrink: 0, color: open ? AMBER : isWin ? GREEN : RED }}>
                          {fmtUSD(trade.pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
