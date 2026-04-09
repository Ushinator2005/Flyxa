import { Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '../common/ThemeToggle.js';
import { ALL_ACCOUNTS_ID, useAppSettings } from '../../contexts/AppSettingsContext.js';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/scanner': 'Trade Journal',
  '/coach': 'Flyxa AI',
  '/analytics': 'Analytics',
  '/chart': 'Backtest',
  '/backtest': 'Backtest',
  '/psychology': 'Psychology Tracker',
  '/journal': 'Daily Journal',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accounts, selectedAccountId, setSelectedAccountId } = useAppSettings();
  const pageName = pageNames[location.pathname] || 'Flyxa';

  return (
    <header className="theme-header h-14 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-white">{pageName}</h1>
      <div className="flex items-center gap-4">
        <label className="relative">
          <span className="sr-only">Select account</span>
          <select
            value={selectedAccountId}
            onChange={event => setSelectedAccountId(event.target.value)}
            className="input-field h-10 min-w-[190px] appearance-none rounded-xl border-slate-700/70 bg-slate-900/85 pr-10 text-sm text-slate-200"
          >
            <option value={ALL_ACCOUNTS_ID}>All Accounts</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">▼</span>
        </label>
        <ThemeToggle compact />
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/85 text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
