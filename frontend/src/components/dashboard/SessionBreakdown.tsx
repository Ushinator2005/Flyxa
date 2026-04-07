import { SessionData } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';

interface Props {
  data: SessionData[];
}

const sessionColors: Record<string, string> = {
  'London': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'New York': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Asia': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Other': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function SessionBreakdown({ data }: Props) {
  return (
    <div className="space-y-3">
      {data.map(s => (
        <div key={s.session} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sessionColors[s.session] || sessionColors['Other']}`}>
              {s.session}
            </span>
            <span className={`text-sm font-semibold ${s.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(s.netPnL)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-slate-500">Trades</div>
              <div className="text-slate-200 font-medium">{s.trades}</div>
            </div>
            <div>
              <div className="text-slate-500">Win Rate</div>
              <div className="text-slate-200 font-medium">{s.winRate.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-slate-500">P.Factor</div>
              <div className="text-slate-200 font-medium">
                {s.profitFactor >= 999 ? '∞' : s.profitFactor.toFixed(2)}
              </div>
            </div>
          </div>
          {/* Win rate bar */}
          <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(s.winRate, 100)}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-4">No session data yet</p>
      )}
    </div>
  );
}
