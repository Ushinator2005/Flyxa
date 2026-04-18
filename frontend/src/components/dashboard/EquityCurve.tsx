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
        color: value >= 0 ? '#f59e0b' : '#ef4444',
      }}>
        {formatCurrency(value)}
      </p>
    </div>
  );
};

export default function EquityCurve({ data }: Props) {
  const isPositive = data.length > 0 && data[data.length - 1].cumulative >= 0;
  const lineColor = isPositive ? '#f59e0b' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v < -999 ? `${(v/1000).toFixed(1)}k` : v}`}
          tick={{ fill: 'var(--app-text-subtle)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="linear"
          dataKey="cumulative"
          stroke={lineColor}
          strokeWidth={1.5}
          fill="none"
          dot={false}
          activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
