import { Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '../common/ThemeToggle.js';
import { ALL_ACCOUNTS_ID, useAppSettings } from '../../contexts/AppSettingsContext.js';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/coach': 'Flyxa AI',
  '/flyxa-ai': 'Flyxa AI',
  '/flyxa-ai/patterns': 'Pattern library',
  '/flyxa-ai/pre-session': 'Pre-session brief',
  '/analytics': 'Analytics',
  '/journal': 'Daily Journal',
  '/chart': 'Backtest',
  '/backtest': 'Backtest',
  '/trading-plan': 'Trading Plan',
  '/psychology': 'Psychology Tracker',
  '/goals': 'Goals',
  '/billing': 'Billing',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accounts, selectedAccountId, setSelectedAccountId } = useAppSettings();
  const pageName = pageNames[location.pathname] || 'Flyxa';

  return (
    <header
      style={{
        height: 52,
        background: 'var(--app-panel)',
        borderBottom: '1px solid var(--app-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
      }}
    >
      <h1 style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--app-text-subtle)',
        fontFamily: 'var(--font-sans)',
        margin: 0,
      }}>
        {pageName}
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ position: 'relative' }}>
          <span className="sr-only">Select account</span>
          <select
            value={selectedAccountId}
            onChange={event => setSelectedAccountId(event.target.value)}
            style={{
              height: 34,
              minWidth: 180,
              appearance: 'none',
              paddingLeft: 12,
              paddingRight: 32,
              paddingTop: 0,
              paddingBottom: 0,
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              color: 'var(--app-text-muted)',
              background: 'var(--app-bg)',
              border: '1px solid var(--app-border)',
              borderRadius: 6,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value={ALL_ACCOUNTS_ID}>All Accounts</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <span style={{
            pointerEvents: 'none',
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10,
            color: 'var(--app-text-subtle)',
          }}>▼</span>
        </label>
        <ThemeToggle compact />
        <button
          type="button"
          onClick={() => navigate('/settings')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 34,
            width: 34,
            borderRadius: 6,
            border: '1px solid var(--app-border)',
            background: 'var(--app-bg)',
            color: 'var(--app-text-muted)',
            cursor: 'pointer',
            transition: 'border-color 180ms ease, color 180ms ease',
          }}
          onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(255,255,255,0.14)'; el.style.color = 'var(--app-text)'; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--app-border)'; el.style.color = 'var(--app-text-muted)'; }}
          aria-label="Open settings"
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
