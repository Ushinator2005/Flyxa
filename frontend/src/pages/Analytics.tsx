import { useEffect, useState } from 'react';
import { BarChart2, TrendingDown, Clock, Brain, Layers } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine
} from 'recharts';
import { analyticsApi } from '../services/api.js';
import { formatCurrency } from '../utils/calculations.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';

type Tab = 'overview' | 'instrument' | 'session' | 'psychology' | 'drawdown';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const darkTooltip = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
          : 'text-slate-400 hover:text-slate-200 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <div className="text-slate-500 text-sm text-center py-10">No data available.</div>;

  const rrDist = (data.rrDistribution as { rr: string; count: number }[]) || [];
  const holdTime = (data.holdTimeDistribution as { bucket: string; count: number }[]) || [];
  const byExitReason = (data.byExitReason as { exit_reason: string; count: number; avg_pnl: number }[]) || [];

  return (
    <div className="space-y-6">
      {/* R:R Distribution */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">R:R Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rrDist}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rr" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...darkTooltip} />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Trades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hold Time Distribution */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-slate-300 font-semibold text-sm mb-4">Hold Time Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={holdTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip {...darkTooltip} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Trades" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Exit Reason Breakdown */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-slate-300 font-semibold text-sm mb-4">Exit Reason Breakdown</h3>
          {byExitReason.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={byExitReason}
                    dataKey="count"
                    nameKey="exit_reason"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                  >
                    {byExitReason.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip {...darkTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {byExitReason.map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: i === 0 ? '#10b981' : '#ef4444' }}
                      />
                      <span className="text-slate-300 text-sm">{item.exit_reason}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-200 text-sm font-medium">{item.count} trades</p>
                      <p className={`text-xs ${item.avg_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        avg {formatCurrency(item.avg_pnl)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center py-10">No data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Instrument Tab ──────────────────────────────────────────────────────────

function InstrumentTab({ data }: { data: unknown[] }) {
  const rows = data as {
    symbol: string; trades: number; winRate: number;
    netPnL: number; profitFactor: number; avgPnL: number;
  }[];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Net P&L by Instrument</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
            <YAxis dataKey="symbol" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
            <Tooltip {...darkTooltip} formatter={(v: number) => [formatCurrency(v), 'Net P&L']} />
            <Bar dataKey="netPnL" radius={[0, 4, 4, 0]} name="Net P&L">
              {rows.map((entry, i) => (
                <Cell key={i} fill={entry.netPnL >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {['Symbol', 'Trades', 'Win Rate', 'Net P&L', 'Profit Factor', 'Avg P&L'].map(h => (
                <th key={h} className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-200 font-medium">{r.symbol}</td>
                <td className="px-4 py-3 text-slate-300">{r.trades}</td>
                <td className="px-4 py-3">
                  <span className={r.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                    {r.winRate.toFixed(1)}%
                  </span>
                </td>
                <td className={`px-4 py-3 font-medium ${r.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(r.netPnL)}
                </td>
                <td className={`px-4 py-3 ${r.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.profitFactor >= 999 ? '∞' : r.profitFactor.toFixed(2)}
                </td>
                <td className={`px-4 py-3 ${r.avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(r.avgPnL)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-10">No instrument data yet.</div>
        )}
      </div>
    </div>
  );
}

// ── Session Tab ─────────────────────────────────────────────────────────────

function SessionTab({
  sessions, timeOfDay
}: {
  sessions: unknown[];
  timeOfDay: unknown[];
}) {
  const sess = sessions as {
    session: string; trades: number; winRate: number; netPnL: number; profitFactor: number;
  }[];
  const tod = timeOfDay as { hour: number; label: string; trades: number; avgPnL: number; winRate: number }[];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {sess.map((s, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-200 font-semibold">{s.session}</h3>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                s.netPnL >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {formatCurrency(s.netPnL)}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Trades</span>
                <span className="text-slate-200">{s.trades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Win Rate</span>
                <span className={s.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                  {s.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Profit Factor</span>
                <span className={s.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}>
                  {s.profitFactor >= 999 ? '∞' : s.profitFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Avg P&L by Time of Day</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={tod}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip {...darkTooltip} formatter={(v: number) => [formatCurrency(v), 'Avg P&L']} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="avgPnL" radius={[4, 4, 0, 0]} name="Avg P&L">
              {tod.map((entry, i) => (
                <Cell key={i} fill={entry.avgPnL >= 0 ? '#3b82f6' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Psychology Tab ──────────────────────────────────────────────────────────

function PsychologyTab({ data }: { data: unknown[] }) {
  const rows = data as {
    emotional_state: string; trades: number; winRate: number; avgPnL: number; netPnL: number;
  }[];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Avg P&L by Emotional State</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="emotional_state" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip {...darkTooltip} formatter={(v: number) => [formatCurrency(v), 'Avg P&L']} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="avgPnL" radius={[4, 4, 0, 0]} name="Avg P&L">
              {rows.map((_entry, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {['Emotional State', 'Trades', 'Win Rate', 'Avg P&L', 'Net P&L'].map(h => (
                <th key={h} className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: COLORS[i % COLORS.length] + '30',
                      color: COLORS[i % COLORS.length],
                    }}
                  >
                    {r.emotional_state}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{r.trades}</td>
                <td className={`px-4 py-3 ${r.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.winRate.toFixed(1)}%
                </td>
                <td className={`px-4 py-3 font-medium ${r.avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(r.avgPnL)}
                </td>
                <td className={`px-4 py-3 font-medium ${r.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(r.netPnL)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-10">
            No emotional state data yet. Add emotional state to your trades.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Drawdown Tab ─────────────────────────────────────────────────────────────

function DrawdownTab({ data }: { data: Record<string, unknown> | null }) {
  const dd = data?.drawdownSeries as { date: string; drawdown: number }[] || [];
  const maxDd = (data?.maxDrawdown as number) ?? 0;
  const currentDd = (data?.currentDrawdown as number) ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Max Drawdown</p>
          <p className="text-3xl font-bold text-red-400">{formatCurrency(maxDd)}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Current Drawdown</p>
          <p className={`text-3xl font-bold ${currentDd < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatCurrency(currentDd)}
          </p>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Drawdown Over Time</h3>
        {dd.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dd}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip {...darkTooltip} formatter={(v: number) => [formatCurrency(v), 'Drawdown']} />
              <ReferenceLine y={0} stroke="#475569" />
              <Line
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Drawdown"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 text-sm text-center py-10">No drawdown data yet.</div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [advanced, setAdvanced] = useState<Record<string, unknown> | null>(null);
  const [instruments, setInstruments] = useState<unknown[]>([]);
  const [sessions, setSessions] = useState<unknown[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.getAdvanced(),
      analyticsApi.getByInstrument(),
      analyticsApi.getBySession(),
      analyticsApi.getByTimeOfDay(),
    ])
      .then(([adv, inst, sess, tod]) => {
        setAdvanced(adv as Record<string, unknown>);
        setInstruments(inst as unknown[]);
        setSessions(sess as unknown[]);
        setTimeOfDay(tod as unknown[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart2 size={22} className="text-blue-400" />
          Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Deep performance insights across every dimension of your trading
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/50 pb-3">
        <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}
          icon={<Layers size={15} />} label="Overview" />
        <TabBtn active={activeTab === 'instrument'} onClick={() => setActiveTab('instrument')}
          icon={<BarChart2 size={15} />} label="By Instrument" />
        <TabBtn active={activeTab === 'session'} onClick={() => setActiveTab('session')}
          icon={<Clock size={15} />} label="By Session & Time" />
        <TabBtn active={activeTab === 'psychology'} onClick={() => setActiveTab('psychology')}
          icon={<Brain size={15} />} label="By Psychology" />
        <TabBtn active={activeTab === 'drawdown'} onClick={() => setActiveTab('drawdown')}
          icon={<TrendingDown size={15} />} label="Drawdown" />
      </div>

      {activeTab === 'overview' && (
        <OverviewTab data={advanced} />
      )}
      {activeTab === 'instrument' && (
        <InstrumentTab data={instruments} />
      )}
      {activeTab === 'session' && (
        <SessionTab sessions={sessions} timeOfDay={timeOfDay} />
      )}
      {activeTab === 'psychology' && (
        <PsychologyTab data={(advanced?.byEmotionalState as unknown[]) || []} />
      )}
      {activeTab === 'drawdown' && (
        <DrawdownTab data={advanced} />
      )}
    </div>
  );
}
