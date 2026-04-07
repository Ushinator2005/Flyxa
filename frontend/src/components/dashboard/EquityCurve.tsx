import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { EquityCurvePoint } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';

interface Props {
  data: EquityCurvePoint[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`font-semibold text-sm ${value >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
};

export default function EquityCurve({ data }: Props) {
  const isPositive = data.length > 0 && data[data.length - 1].cumulative >= 0;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isPositive ? '#3b82f6' : '#ef4444'} stopOpacity={0.3} />
            <stop offset="95%" stopColor={isPositive ? '#3b82f6' : '#ef4444'} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => {
            try { return format(parseISO(d), 'MM/dd'); } catch { return d; }
          }}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: '#1e293b' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v < -999 ? `${(v/1000).toFixed(1)}k` : v}`}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={isPositive ? '#3b82f6' : '#ef4444'}
          strokeWidth={2}
          fill="url(#equityGradient)"
          dot={false}
          activeDot={{ r: 4, fill: isPositive ? '#3b82f6' : '#ef4444' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
