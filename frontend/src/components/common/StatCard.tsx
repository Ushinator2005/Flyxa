import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  color?: 'default' | 'green' | 'red' | 'blue';
  subtitle?: string;
}

const colorMap = {
  default: 'text-slate-100',
  green: 'text-emerald-400',
  red: 'text-red-400',
  blue: 'text-blue-400',
};

export default function StatCard({ title, value, change, icon, color = 'default', subtitle }: StatCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 transition-all duration-200 hover:border-slate-600/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className="text-slate-600 ml-2">{icon}</div>
        )}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
