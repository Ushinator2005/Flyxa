import { useMemo } from 'react';
import { DollarSign, Target, BarChart2, TrendingUp, Hash } from 'lucide-react';
import EquityCurve from '../components/dashboard/EquityCurve.js';
import MonthlyHeatmap from '../components/dashboard/MonthlyHeatmap.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { formatCurrency } from '../utils/calculations.js';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import {
  buildAnalyticsSummary,
  buildEquityCurve,
  buildRecentTrades,
  formatTradeDateLabel,
  getTradeRiskReward,
} from '../utils/tradeAnalytics.js';

function formatPrice(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Dashboard() {
  const { trades, loading } = useTrades();
  const { filterTradesBySelectedAccount, selectedAccountId, accounts } = useAppSettings();
  const filteredTrades = useMemo(() => filterTradesBySelectedAccount(trades), [filterTradesBySelectedAccount, trades]);
  const summary = useMemo(() => buildAnalyticsSummary(filteredTrades), [filteredTrades]);
  const equityCurve = useMemo(() => buildEquityCurve(filteredTrades), [filteredTrades]);
  const recentTrades = useMemo(() => buildRecentTrades(filteredTrades), [filteredTrades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  const selectedAccountName = selectedAccountId === 'all'
    ? 'All Accounts'
    : accounts.find(account => account.id === selectedAccountId)?.name ?? 'Default Account';

  const stats = [
    {
      label: 'Total P&L',
      value: formatCurrency(summary.netPnL),
      icon: <DollarSign size={16} />,
      color: summary.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Win Rate',
      value: `${summary.winRate.toFixed(1)}%`,
      icon: <Target size={16} />,
      color: summary.winRate >= 50 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Profit Factor',
      value: summary.profitFactor >= 999 ? '-' : summary.profitFactor.toFixed(2),
      icon: <BarChart2 size={16} />,
      color: summary.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Avg R:R',
      value: summary.avgRR.toFixed(2),
      icon: <TrendingUp size={16} />,
      color: 'text-white',
    },
    {
      label: 'Total Trades',
      value: String(summary.totalTrades),
      icon: <Hash size={16} />,
      color: 'text-white',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Overview of your trading performance for {selectedAccountName}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
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

      <div className="glass-card p-6">
        <MonthlyHeatmap trades={filteredTrades} />
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-300">Equity Curve</h2>
        <EquityCurve data={equityCurve} />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-300">Recent Trades</h2>
        </div>
        {recentTrades.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No trades yet.</p>
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
                {recentTrades.map(trade => {
                  const rr = getTradeRiskReward(trade);
                  const direction = trade.direction === 'Long' || trade.direction === 'Short' ? trade.direction : null;
                  return (
                    <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatTradeDateLabel(trade.trade_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-100 font-semibold">{trade.symbol || 'N/A'}</td>
                      <td className="px-4 py-3">
                        {direction ? (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              direction === 'Long'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {direction.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                        ${formatPrice(trade.entry_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                        ${formatPrice(trade.exit_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{trade.contract_size}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(trade.pnl)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 tabular-nums">
                        {rr !== null ? `${rr.toFixed(2)}R` : 'N/A'}
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
