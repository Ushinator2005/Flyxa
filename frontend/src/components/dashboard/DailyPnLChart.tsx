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
import { format, parseISO } from 'date-fns';
import { DailyPnLPoint } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';

interface Props {
  data: DailyPnLPoint[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div style={{
      background: 'var(--app-panel-strong)',
      border: '1px solid var(--app-border)',
      borderRadius: 4,
      padding: '8px 12px',
    }}>
      <p style={{ fontSize: 10, color: 'var(--app-text-subtle)', marginBottom: 4, letterSpacing: '0.05em' }}>{label}</p>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 13,
        fontWeight: 600,
        color: value >= 0 ? '#22c55e' : '#ef4444',
      }}>
        {formatCurrency(value)}
      </p>
    </div>
  );
};

export default function DailyPnLChart({ data }: Props) {
  const last30 = data.slice(-30);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={last30} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="1 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => {
            try { return format(parseISO(d), 'MM/dd'); } catch { return d; }
          }}
          tick={{ fill: 'var(--app-text-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}
          tick={{ fill: 'var(--app-text-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
          {last30.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
