import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useRisk } from '../../contexts/RiskContext.js';
import { formatCurrency } from '../../utils/calculations.js';
import ThemeToggle from '../common/ThemeToggle.js';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/scanner': 'Trade Journal',
  '/coach': 'Flyxa AI',
  '/analytics': 'Analytics',
  '/chart': 'Backtest',
  '/backtest': 'Backtest',
  '/psychology': 'Psychology Tracker',
  '/journal': 'Daily Journal',
};

export default function Header() {
  const location = useLocation();
  const { settings, dailyStatus } = useRisk();
  const pageName = pageNames[location.pathname] || 'Flyxa';
  const todayPnL = dailyStatus?.todayPnL ?? 0;

  return (
    <header className="theme-header h-14 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-white">{pageName}</h1>
      <div className="flex items-center gap-6">
        <ThemeToggle />
        <div className="text-sm text-slate-400">
          {format(new Date(), 'EEEE, MMM d yyyy')}
        </div>
        {settings?.account_size && (
          <div className="text-sm">
            <span className="text-slate-500">Account: </span>
            <span className="text-slate-200 font-medium">{formatCurrency(settings.account_size)}</span>
          </div>
        )}
        <div className="text-sm">
          <span className="text-slate-500">Today: </span>
          <span className={`font-semibold ${todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(todayPnL)}
          </span>
        </div>
      </div>
    </header>
  );
}
