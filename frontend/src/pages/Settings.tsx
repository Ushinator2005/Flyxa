import { useRef, useState } from 'react';
import { ChevronDown, Monitor, Palette, Plus, Trash2, Wallet } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.js';
import { DEFAULT_ACCOUNT_ID, useAppSettings } from '../contexts/AppSettingsContext.js';
import { TradingAccountType } from '../types/index.js';

const ACCOUNT_TYPES: TradingAccountType[] = ['Futures', 'Forex', 'Stocks'];
const ACCOUNT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        style={{
          color: '#3b82f6',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(51,65,85,0.5)' }} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        marginBottom: '6px',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'rgba(100,116,139,0.9)',
      }}
    >
      {children}
    </span>
  );
}

function StyledSelect({
  value,
  onChange,
  children,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          appearance: 'none',
          background: '#070c18',
          border: `1px solid ${focused ? '#2563eb' : 'rgba(51,65,85,0.65)'}`,
          borderRadius: '8px',
          padding: compact ? '6px 32px 6px 10px' : '10px 36px 10px 12px',
          color: '#e2e8f0',
          fontSize: compact ? '12px' : '13px',
          outline: 'none',
          cursor: 'pointer',
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        style={{ color: 'rgba(100,116,139,0.7)' }}
      />
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  headerRight,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#0d1526',
        border: '1px solid rgba(30,41,59,0.9)',
        borderRadius: '14px',
        padding: '24px',
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>{title}</p>
          <p style={{ fontSize: '12px', color: 'rgba(100,116,139,0.9)' }}>{subtitle}</p>
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const {
    accounts,
    preferences,
    addAccount,
    updateAccount,
    deleteAccount,
    updatePreferences,
  } = useAppSettings();
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState({
    name: '',
    broker: '',
    type: 'Futures' as TradingAccountType,
    color: ACCOUNT_COLORS[0],
  });
  const [activeSection, setActiveSection] = useState<string>('');

  const generalRef = useRef<HTMLElement>(null);
  const displayRef = useRef<HTMLElement>(null);
  const accountsRef = useRef<HTMLElement>(null);

  const navSections = [
    {
      key: 'general',
      title: 'General',
      description: 'Global look and formatting defaults.',
      icon: <Palette size={16} />,
      ref: generalRef,
    },
    {
      key: 'display',
      title: 'Display',
      description: 'Chart defaults for new views.',
      icon: <Monitor size={16} />,
      ref: displayRef,
    },
    {
      key: 'accounts',
      title: 'Accounts',
      description: 'Manage trading accounts.',
      icon: <Wallet size={16} />,
      ref: accountsRef,
    },
  ];

  function scrollToSection(key: string, ref: React.RefObject<HTMLElement | null>) {
    setActiveSection(key);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleAddAccount() {
    if (!newAccount.name.trim()) return;
    addAccount({
      name: newAccount.name.trim(),
      broker: newAccount.broker.trim(),
      type: newAccount.type,
      color: newAccount.color,
    });
    setNewAccount({ name: '', broker: '', type: 'Futures', color: ACCOUNT_COLORS[0] });
    setShowNewAccountForm(false);
  }

  // shared inline input style for the accounts table
  const tableInputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e2e8f0',
    fontSize: '13px',
    padding: '4px 0',
  };

  const tableInputFocusedStyle: React.CSSProperties = {
    borderBottom: '1px solid rgba(37,99,235,0.5)',
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>Settings</h1>
        <p style={{ marginTop: '6px', fontSize: '13px', color: 'rgba(100,116,139,0.9)' }}>
          Manage workspace preferences, display defaults, and trading accounts.
        </p>
      </div>

      {/* ── Nav cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {navSections.map(section => {
          const isActive = activeSection === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => scrollToSection(section.key, section.ref)}
              style={{
                textAlign: 'left',
                background: isActive ? '#111d35' : '#0d1526',
                border: `1px solid ${isActive ? '#2563eb' : 'rgba(30,41,59,0.9)'}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(51,65,85,0.9)';
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(30,41,59,0.9)';
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(37,99,235,0.15)' : 'rgba(15,23,42,0.8)',
                    border: `1px solid ${isActive ? 'rgba(37,99,235,0.3)' : 'rgba(51,65,85,0.5)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: isActive ? '#60a5fa' : 'rgba(100,116,139,0.8)',
                  }}
                >
                  {section.icon}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '3px' }}>
                    {section.title}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(100,116,139,0.8)', lineHeight: 1.4 }}>
                    {section.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── General section ── */}
      <section ref={generalRef}>
        <SectionDivider label="General" />
        <SectionCard
          title="Workspace preferences"
          subtitle="Control the global look and formatting defaults for the app."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <label>
              <FieldLabel>Theme</FieldLabel>
              <StyledSelect
                value={theme}
                onChange={v => setTheme(v as 'dark' | 'light')}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </StyledSelect>
            </label>

            <label>
              <FieldLabel>Date format</FieldLabel>
              <StyledSelect
                value={preferences.dateFormat}
                onChange={v => updatePreferences({ dateFormat: v as typeof preferences.dateFormat })}
              >
                <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                <option value="yyyy-MM-dd">YYYY-MM-DD</option>
              </StyledSelect>
            </label>

            <label>
              <FieldLabel>Currency symbol</FieldLabel>
              <StyledSelect
                value={preferences.currencySymbol}
                onChange={v => updatePreferences({ currencySymbol: v as typeof preferences.currencySymbol })}
              >
                <option value="$">$ USD</option>
                <option value="€">€ EUR</option>
                <option value="£">£ GBP</option>
                <option value="A$">A$ AUD</option>
              </StyledSelect>
            </label>
          </div>
        </SectionCard>
      </section>

      {/* ── Display section ── */}
      <section ref={displayRef}>
        <SectionDivider label="Display" />
        <SectionCard
          title="Chart defaults"
          subtitle="Choose the chart defaults you want when opening new views."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <label>
              <FieldLabel>Default timeframe</FieldLabel>
              <StyledSelect
                value={preferences.defaultTimeframe}
                onChange={v => updatePreferences({ defaultTimeframe: v as typeof preferences.defaultTimeframe })}
              >
                <option value="1m">1 minute</option>
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 hour</option>
              </StyledSelect>
            </label>

            <label>
              <FieldLabel>Default chart type</FieldLabel>
              <StyledSelect
                value={preferences.defaultChartType}
                onChange={v => updatePreferences({ defaultChartType: v as typeof preferences.defaultChartType })}
              >
                <option value="Candles">Candles</option>
                <option value="Line">Line</option>
                <option value="Area">Area</option>
              </StyledSelect>
            </label>
          </div>
        </SectionCard>
      </section>

      {/* ── Accounts section ── */}
      <section ref={accountsRef}>
        <SectionDivider label="Accounts" />
        <SectionCard
          title="Trading accounts"
          subtitle="Manage the trading accounts available across the dashboard and journal."
          headerRight={
            <button
              type="button"
              onClick={() => setShowNewAccountForm(c => !c)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2563eb'; }}
            >
              <Plus size={13} />
              Add Account
            </button>
          }
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 140px 120px 80px',
              gap: '12px',
              padding: '0 4px 8px',
              borderBottom: '1px solid rgba(51,65,85,0.4)',
              marginBottom: '4px',
            }}
          >
            {['Account name', 'Broker', 'Account type', 'Color tag', 'Default'].map(col => (
              <span
                key={col}
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'rgba(71,85,105,0.8)',
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Account rows */}
          <div>
            {accounts.map(account => (
              <div key={account.id}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 140px 120px 80px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '10px 4px',
                    borderBottom: '1px solid rgba(30,41,59,0.7)',
                  }}
                >
                  {/* Account name */}
                  <input
                    style={tableInputStyle}
                    value={account.name}
                    onChange={e => updateAccount(account.id, { name: e.target.value })}
                    onFocus={e => Object.assign(e.target.style, tableInputFocusedStyle)}
                    onBlur={e => { e.target.style.borderBottom = 'none'; }}
                    placeholder="Account name"
                  />

                  {/* Broker */}
                  <input
                    style={tableInputStyle}
                    value={account.broker ?? ''}
                    onChange={e => updateAccount(account.id, { broker: e.target.value })}
                    onFocus={e => Object.assign(e.target.style, tableInputFocusedStyle)}
                    onBlur={e => { e.target.style.borderBottom = 'none'; }}
                    placeholder="Broker"
                  />

                  {/* Account type */}
                  <StyledSelect
                    value={account.type}
                    onChange={v => updateAccount(account.id, { type: v as TradingAccountType })}
                    compact
                  >
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </StyledSelect>

                  {/* Color dots */}
                  <div className="flex items-center gap-1.5">
                    {ACCOUNT_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateAccount(account.id, { color })}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: color,
                          border: 'none',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: account.color === color
                            ? `0 0 0 2px #0a0f1e, 0 0 0 4px rgba(255,255,255,0.5)`
                            : 'none',
                          transition: 'box-shadow 0.15s',
                        }}
                        aria-label={`Set color ${color}`}
                      />
                    ))}
                  </div>

                  {/* Default / Delete */}
                  <div>
                    {account.id === DEFAULT_ACCOUNT_ID ? (
                      <span
                        style={{
                          display: 'inline-block',
                          background: 'rgba(37,99,235,0.12)',
                          color: '#60a5fa',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          borderRadius: '999px',
                          padding: '3px 9px',
                        }}
                      >
                        Default
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(account.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'transparent',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          color: 'rgba(252,165,165,0.8)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = 'rgba(239,68,68,0.1)';
                          el.style.color = '#fca5a5';
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLButtonElement;
                          el.style.background = 'transparent';
                          el.style.color = 'rgba(252,165,165,0.8)';
                        }}
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Delete confirmation */}
                {deleteTarget === account.id && (
                  <div
                    style={{
                      margin: '8px 4px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245,158,11,0.2)',
                      background: 'rgba(245,158,11,0.06)',
                      padding: '12px 16px',
                    }}
                  >
                    <p style={{ fontSize: '13px', color: '#fde68a' }}>
                      Delete{' '}
                      <span style={{ fontWeight: 600, color: '#fff' }}>{account.name}</span>?{' '}
                      Trades on this account will fall back to Default Account.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => { deleteAccount(account.id); setDeleteTarget(null); }}
                        className="btn-danger"
                        style={{ fontSize: '12px', padding: '6px 14px' }}
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 14px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* New account inline row */}
            {showNewAccountForm && (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 140px 120px 80px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '10px 4px',
                    borderBottom: '1px solid rgba(30,41,59,0.7)',
                    background: 'rgba(37,99,235,0.04)',
                    borderRadius: '6px',
                  }}
                >
                  <input
                    style={{ ...tableInputStyle, borderBottom: '1px solid rgba(51,65,85,0.5)' }}
                    placeholder="Account name"
                    value={newAccount.name}
                    onChange={e => setNewAccount(c => ({ ...c, name: e.target.value }))}
                    autoFocus
                  />
                  <input
                    style={{ ...tableInputStyle, borderBottom: '1px solid rgba(51,65,85,0.5)' }}
                    placeholder="Broker"
                    value={newAccount.broker}
                    onChange={e => setNewAccount(c => ({ ...c, broker: e.target.value }))}
                  />
                  <StyledSelect
                    value={newAccount.type}
                    onChange={v => setNewAccount(c => ({ ...c, type: v as TradingAccountType }))}
                    compact
                  >
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </StyledSelect>
                  <div className="flex items-center gap-1.5">
                    {ACCOUNT_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewAccount(c => ({ ...c, color }))}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: color,
                          border: 'none',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: newAccount.color === color
                            ? `0 0 0 2px #0a0f1e, 0 0 0 4px rgba(255,255,255,0.5)`
                            : 'none',
                          transition: 'box-shadow 0.15s',
                        }}
                        aria-label={`Pick color ${color}`}
                      />
                    ))}
                  </div>
                  <div />
                </div>
                <div className="flex gap-2 px-1 pt-3 pb-1">
                  <button
                    type="button"
                    onClick={handleAddAccount}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Save Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewAccountForm(false)}
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ＋ Add another account ghost button */}
          {!showNewAccountForm && (
            <button
              type="button"
              onClick={() => setShowNewAccountForm(true)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '10px',
                marginTop: '4px',
                background: 'transparent',
                border: 'none',
                borderTop: '1px solid rgba(30,41,59,0.8)',
                color: 'rgba(100,116,139,0.7)',
                fontSize: '12px',
                cursor: 'pointer',
                borderRadius: '0 0 6px 6px',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'rgba(37,99,235,0.06)';
                el.style.color = '#60a5fa';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'transparent';
                el.style.color = 'rgba(100,116,139,0.7)';
              }}
            >
              <Plus size={13} />
              Add another account
            </button>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
