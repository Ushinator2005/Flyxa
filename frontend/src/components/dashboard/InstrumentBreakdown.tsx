import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { InstrumentData } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';

interface Props {
  data: InstrumentData[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-300 text-xs font-medium mb-1">{label}</p>
      <p className={`font-semibold text-sm ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
};

export default function InstrumentBreakdown({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.netPnL - a.netPnL);

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="symbol"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="netPnL" radius={[0, 3, 3, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={entry.netPnL >= 0 ? '#10b981' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 space-y-1">
        {sorted.slice(0, 5).map(item => (
          <div key={item.symbol} className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">{item.symbol}</span>
            <div className="flex items-center gap-3 text-slate-500">
              <span>{item.trades} trades</span>
              <span>{item.winRate.toFixed(0)}% WR</span>
              <span className={item.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {formatCurrency(item.netPnL)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
