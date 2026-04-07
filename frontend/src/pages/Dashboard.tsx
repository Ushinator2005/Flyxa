import { useEffect, useState } from 'react';
import { DollarSign, Target, BarChart2, TrendingUp, Hash } from 'lucide-react';
import EquityCurve from '../components/dashboard/EquityCurve.js';
import MonthlyHeatmap from '../components/dashboard/MonthlyHeatmap.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { analyticsApi } from '../services/api.js';
import { formatCurrency } from '../utils/calculations.js';
import { useTrades } from '../hooks/useTrades.js';
import { AnalyticsSummary, EquityCurvePoint } from '../types/index.js';
import { format, parseISO } from 'date-fns';

export default function Dashboard() {
  const [summary, setSummary]       = useState<AnalyticsSummary | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [loading, setLoading]       = useState(true);
  const { trades } = useTrades();

  useEffect(() => {
    Promise.all([analyticsApi.getSummary(), analyticsApi.getEquityCurve()])
      .then(([sum, equity]) => {
        setSummary(sum as AnalyticsSummary);
        setEquityCurve(equity as EquityCurvePoint[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  const s = summary;

  const stats = [
    {
      label: 'Total P&L',
      value: s ? formatCurrency(s.netPnL) : '$0.00',
      icon: <DollarSign size={16} />,
      color: s && s.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Win Rate',
      value: s ? `${s.winRate.toFixed(1)}%` : '0%',
      icon: <Target size={16} />,
      color: s && s.winRate >= 50 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Profit Factor',
      value: s ? (s.profitFactor >= 999 ? '∞' : s.profitFactor.toFixed(2)) : '0',
      icon: <BarChart2 size={16} />,
      color: s && s.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Avg R:R',
      value: s ? s.avgRR.toFixed(2) : '0',
      icon: <TrendingUp size={16} />,
      color: 'text-white',
    },
    {
      label: 'Total Trades',
      value: String(s?.totalTrades ?? 0),
      icon: <Hash size={16} />,
      color: 'text-white',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Overview of your trading performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="glass-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{stat.label}</span>
              <span className="text-slate-600">{stat.icon}</span>
            </div>
            <span className={`text-3xl font-bold tracking-tight ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Calendar heatmap */}
      <div className="glass-card p-6">
        <MonthlyHeatmap />
      </div>

      {/* Equity curve */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Equity Curve</h2>
        <EquityCurve data={equityCurve} />
      </div>

      {/* Recent trades */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-300">Recent Trades</h2>
        </div>
        {trades.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-10">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-700/40 bg-slate-900/20">
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Symbol</th>
                  <th className="text-left px-4 py-3 font-medium">Direction</th>
                  <th className="text-right px-4 py-3 font-medium">Entry</th>
                  <th className="text-right px-4 py-3 font-medium">Exit</th>
                  <th className="text-right px-4 py-3 font-medium">Size</th>
                  <th className="text-right px-4 py-3 font-medium">P&L</th>
                  <th className="text-right px-6 py-3 font-medium">R:R</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {trades.slice(0, 10).map(t => {
                  const rr = t.sl_price && t.tp_price && t.entry_price
                    ? (Math.abs(t.tp_price - t.entry_price) / Math.abs(t.sl_price - t.entry_price)).toFixed(2)
                    : null;
                  return (
                    <tr key={t.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {format(parseISO(t.trade_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-slate-100 font-semibold">{t.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          t.direction === 'Long'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {t.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                        ${t.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                        ${t.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{t.contract_size}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(t.pnl)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 tabular-nums">
                        {rr ? `${rr}R` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
