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
import { DayOfWeekData } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';

interface Props {
  data: DayOfWeekData[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-slate-300 text-xs font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={`text-sm ${p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {p.name}: {p.name === 'Avg P&L' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function DayOfWeekChart({ data }: Props) {
  const shortDay = (day: string) => day.slice(0, 3);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data.map(d => ({ ...d, day: shortDay(d.day) }))}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: '#64748b', fontSize: 12 }}
          axisLine={{ stroke: '#1e293b' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v < -999 ? `${(v/1000).toFixed(1)}k` : v}`}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="avgPnL" name="Avg P&L" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.avgPnL >= 0 ? '#3b82f6' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
