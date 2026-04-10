import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Monitor, Palette, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.js';
import { DEFAULT_ACCOUNT_ID, useAppSettings } from '../contexts/AppSettingsContext.js';
import { TradingAccountStatus, TradingAccountType } from '../types/index.js';

const ACCOUNT_TYPES: TradingAccountType[] = ['Futures', 'Forex', 'Stocks'];
const DEFAULT_ACCOUNT_COLOR = '#3b82f6';
const DEFAULT_TIMEZONE = 'America/New_York';
const ACCOUNT_STATUSES: TradingAccountStatus[] = ['Eval', 'Funded', 'Live', 'Blown'];
const ACCOUNT_TABLE_GRID_COLUMNS = 'minmax(0,1fr) minmax(0,1fr) 170px 150px 90px';
const ACCOUNT_TABLE_COLUMN_GAP = '16px';
const TIMEZONE_REGION_PRIORITY = ['America', 'Europe', 'Asia', 'Pacific'];
const SESSION_TIME_FIELDS = [
  { key: 'asia', label: 'Asia' },
  { key: 'london', label: 'London' },
  { key: 'preMarket', label: 'Pre Market' },
  { key: 'newYork', label: 'New York' },
] as const;
type SessionTimeKey = (typeof SESSION_TIME_FIELDS)[number]['key'];
const ACCOUNT_STATUS_STYLES: Record<TradingAccountStatus, { background: string; border: string; color: string }> = {
  Eval: {
    background: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.24)',
    color: '#60a5fa',
  },
  Funded: {
    background: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.24)',
    color: '#fbbf24',
  },
  Live: {
    background: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.24)',
    color: '#34d399',
  },
  Blown: {
    background: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.24)',
    color: '#fca5a5',
  },
};

interface TimezoneGroup {
  region: string;
  zones: string[];
}

const TIMEZONE_GROUPS: TimezoneGroup[] = (() => {
  const intlWithSupportedValues = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intlWithSupportedValues.supportedValuesOf?.('timeZone') ?? [];
  const timezoneList = zones.includes(DEFAULT_TIMEZONE) ? zones : [...zones, DEFAULT_TIMEZONE];
  const grouped = new Map<string, string[]>();

  timezoneList.forEach(zone => {
    const [region] = zone.split('/');
    const group = region || 'Other';
    const bucket = grouped.get(group) ?? [];
    bucket.push(zone);
    grouped.set(group, bucket);
  });

  return [...grouped.entries()]
    .sort(([a], [b]) => {
      const aIndex = TIMEZONE_REGION_PRIORITY.indexOf(a);
      const bIndex = TIMEZONE_REGION_PRIORITY.indexOf(b);

      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }

      return a.localeCompare(b);
    })
    .map(([region, groupZones]) => ({
      region,
      zones: [...groupZones].sort((a, b) => a.localeCompare(b)),
    }));
})();

const getUtcOffset = (timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(new Date());
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
  const offset = offsetPart
    .replace('GMT', 'UTC')
    .replace('UTC+0', 'UTC')
    .replace('UTC-0', 'UTC');
  return offset ? `(${offset})` : '(UTC)';
};

const formatTimezoneOptionLabel = (timezone: string) => {
  const zoneParts = timezone.split('/');
  const citySegment = zoneParts[zoneParts.length - 1] || timezone;
  const cityLabel = citySegment.replace(/_/g, ' ');
  return `${getUtcOffset(timezone)} ${cityLabel}`;
};

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
          border: `1px solid ${focused ? '#2563eb' : 'rgba(255,255,255,0.12)'}`,
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

function StyledTimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      type="time"
      value={value}
      onChange={event => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%',
        background: '#070c18',
        border: `1px solid ${focused ? '#2563eb' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#e2e8f0',
        fontSize: '13px',
        outline: 'none',
        boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    />
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: TradingAccountStatus;
  onChange: (value: TradingAccountStatus) => void;
}) {
  const [focused, setFocused] = useState(false);
  const palette = ACCOUNT_STATUS_STYLES[value];
  const isBlown = value === 'Blown';

  return (
    <div className="relative inline-flex min-w-[110px]">
      <select
        value={value}
        onChange={event => onChange(event.target.value as TradingAccountStatus)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          appearance: 'none',
          background: isBlown ? 'rgba(127,29,29,0.82)' : '#08111f',
          border: `1px solid ${focused ? palette.color : isBlown ? 'rgba(252,165,165,0.85)' : palette.border}`,
          borderRadius: '999px',
          padding: isBlown ? '6px 28px 6px 31px' : '6px 28px 6px 12px',
          color: isBlown ? '#fee2e2' : palette.color,
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          outline: 'none',
          cursor: 'pointer',
          boxShadow: focused
            ? `0 0 0 3px ${palette.background}`
            : isBlown
              ? 'inset 0 0 0 1px rgba(239,68,68,0.32), 0 0 20px rgba(239,68,68,0.2)'
              : `inset 0 0 0 1px ${palette.background}`,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {ACCOUNT_STATUSES.map(status => (
          <option
            key={status}
            value={status}
            style={{
              backgroundColor: '#08111f',
              color: ACCOUNT_STATUS_STYLES[status].color,
              fontWeight: 700,
            }}
          >
            {status}
          </option>
        ))}
      </select>
      {isBlown && (
        <AlertTriangle
          size={11}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ color: '#fecaca' }}
        />
      )}
      <ChevronDown
        size={11}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        style={{ color: isBlown ? '#fecaca' : palette.color }}
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
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState({
    name: '',
    broker: '',
    credentials: '',
    type: 'Futures' as TradingAccountType,
    status: 'Eval' as TradingAccountStatus,
  });
  const [activeSection, setActiveSection] = useState<string>('general');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const generalRef = useRef<HTMLElement>(null);
  const displayRef = useRef<HTMLElement>(null);
  const accountsRef = useRef<HTMLElement>(null);
  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveToastReadyRef = useRef(false);

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

  function resetNewAccountForm() {
    setNewAccount({
      name: '',
      broker: '',
      credentials: '',
      type: 'Futures',
      status: 'Eval',
    });
  }

  function closeAddAccountModal() {
    setShowAddAccountModal(false);
    resetNewAccountForm();
  }

  function handleAddAccount() {
    if (!newAccount.name.trim()) return;
    addAccount({
      name: newAccount.name.trim(),
      broker: newAccount.broker.trim(),
      credentials: newAccount.credentials.trim(),
      type: newAccount.type,
      status: newAccount.status,
      color: DEFAULT_ACCOUNT_COLOR,
    });
    closeAddAccountModal();
  }

  function handleSessionTimeChange(session: SessionTimeKey, field: 'start' | 'end', value: string) {
    updatePreferences({
      sessionTimes: {
        ...preferences.sessionTimes,
        [session]: {
          ...preferences.sessionTimes[session],
          [field]: value,
        },
      },
    });
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

  useEffect(() => {
    const sectionEntries = [
      { key: 'general', ref: generalRef },
      { key: 'display', ref: displayRef },
      { key: 'accounts', ref: accountsRef },
    ];

    const updateActiveSectionFromScroll = () => {
      const stickyOffset = 180;
      let nextActive = 'general';

      sectionEntries.forEach(section => {
        const top = section.ref.current?.getBoundingClientRect().top;
        if (typeof top === 'number' && top <= stickyOffset) {
          nextActive = section.key;
        }
      });

      setActiveSection(current => (current === nextActive ? current : nextActive));
    };

    updateActiveSectionFromScroll();
    window.addEventListener('scroll', updateActiveSectionFromScroll, { passive: true });

    return () => window.removeEventListener('scroll', updateActiveSectionFromScroll);
  }, []);

  useEffect(() => {
    if (!autoSaveToastReadyRef.current) {
      autoSaveToastReadyRef.current = true;
      return;
    }

    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }

    saveDebounceTimerRef.current = setTimeout(() => {
      setShowSavedToast(true);

      if (saveHideTimerRef.current) {
        clearTimeout(saveHideTimerRef.current);
      }

      saveHideTimerRef.current = setTimeout(() => setShowSavedToast(false), 1200);
    }, 350);
  }, [accounts, preferences]);

  useEffect(() => (
    () => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
      if (saveHideTimerRef.current) {
        clearTimeout(saveHideTimerRef.current);
      }
    }
  ), []);

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
      <div
        style={{
          position: 'sticky',
          top: '10px',
          zIndex: 25,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          padding: '8px',
          borderRadius: '14px',
          border: '1px solid rgba(51,65,85,0.42)',
          background: 'linear-gradient(180deg,rgba(8,13,25,0.92),rgba(8,13,25,0.78))',
          backdropFilter: 'blur(8px)',
        }}
      >
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
      <section ref={generalRef} style={{ scrollMarginTop: '140px' }}>
        <SectionDivider label="General" />
        <SectionCard
          title="Workspace preferences"
          subtitle="Control the global look and formatting defaults for the app."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
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

            <label>
              <FieldLabel>Timezone</FieldLabel>
              <StyledSelect
                value={preferences.timezone}
                onChange={value => updatePreferences({ timezone: value })}
              >
                {TIMEZONE_GROUPS.map(group => (
                  <optgroup key={group.region} label={group.region}>
                    {group.zones.map(zone => (
                      <option key={zone} value={zone}>{formatTimezoneOptionLabel(zone)}</option>
                    ))}
                  </optgroup>
                ))}
              </StyledSelect>
            </label>
          </div>
        </SectionCard>

        <div style={{ marginTop: '16px' }}>
          <SectionCard
            title="Session times"
            subtitle="Set your default Asia, London, Pre Market, and New York trading windows."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {SESSION_TIME_FIELDS.map(session => (
                <div
                  key={session.key}
                  style={{
                    border: '1px solid rgba(30,41,59,0.9)',
                    borderRadius: '10px',
                    padding: '12px',
                    background: '#0a1222',
                  }}
                >
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '10px' }}>
                    {session.label}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <label>
                      <FieldLabel>Start</FieldLabel>
                      <StyledTimeInput
                        value={preferences.sessionTimes[session.key].start}
                        onChange={value => handleSessionTimeChange(session.key, 'start', value)}
                      />
                    </label>
                    <label>
                      <FieldLabel>End</FieldLabel>
                      <StyledTimeInput
                        value={preferences.sessionTimes[session.key].end}
                        onChange={value => handleSessionTimeChange(session.key, 'end', value)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </section>

      {/* ── Display section ── */}
      <section ref={displayRef} style={{ scrollMarginTop: '140px' }}>
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
      <section ref={accountsRef} style={{ scrollMarginTop: '140px' }}>
        <SectionDivider label="Accounts" />
        <SectionCard
          title="Trading accounts"
          subtitle="Manage the trading accounts available across the dashboard and journal."
          headerRight={
            <button
              type="button"
              onClick={() => setShowAddAccountModal(true)}
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
              gridTemplateColumns: ACCOUNT_TABLE_GRID_COLUMNS,
              gap: ACCOUNT_TABLE_COLUMN_GAP,
              padding: '0 4px 8px',
              borderBottom: '1px solid rgba(51,65,85,0.4)',
              marginBottom: '4px',
            }}
          >
            {['Account name', 'Broker', 'Account type', 'Status', 'Actions'].map(col => (
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
                    gridTemplateColumns: ACCOUNT_TABLE_GRID_COLUMNS,
                    gap: ACCOUNT_TABLE_COLUMN_GAP,
                    alignItems: 'center',
                    padding: '10px 4px',
                    borderBottom: account.status === 'Blown'
                      ? '1px solid rgba(248,113,113,0.26)'
                      : '1px solid rgba(30,41,59,0.7)',
                    background: account.status === 'Blown' ? 'rgba(127,29,29,0.08)' : 'transparent',
                    borderRadius: account.status === 'Blown' ? '8px' : '0',
                  }}
                >
                  {/* Account name */}
                  <div>
                    <input
                      style={tableInputStyle}
                      value={account.name}
                      onChange={e => updateAccount(account.id, { name: e.target.value })}
                      onFocus={e => Object.assign(e.target.style, tableInputFocusedStyle)}
                      onBlur={e => { e.target.style.borderBottom = 'none'; }}
                      placeholder="Account name"
                    />
                    {account.id === DEFAULT_ACCOUNT_ID && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '4px',
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
                    )}
                  </div>

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

                  {/* Status */}
                  <StatusSelect
                    value={account.status}
                    onChange={status => updateAccount(account.id, { status })}
                  />

                  {/* Actions */}
                  <div>
                    {account.id === DEFAULT_ACCOUNT_ID ? (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'rgba(100,116,139,0.9)',
                        }}
                      >
                        -
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

                {account.status === 'Blown' && (
                  <div
                    style={{
                      margin: '6px 4px 0',
                      borderRadius: '8px',
                      border: '1px solid rgba(248,113,113,0.3)',
                      background: 'rgba(127,29,29,0.28)',
                      padding: '8px 10px',
                    }}
                  >
                    <p
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        color: '#fecaca',
                      }}
                    >
                      <AlertTriangle size={13} />
                      This account is blown. New trades cannot be allocated to it.
                    </p>
                  </div>
                )}

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
          </div>

          {/* Add another account trigger */}
          <button
            type="button"
            onClick={() => setShowAddAccountModal(true)}
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
        </SectionCard>
      </section>

      {showSavedToast && (
        <div
          style={{
            position: 'fixed',
            right: '18px',
            bottom: '18px',
            zIndex: 60,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '999px',
            border: '1px solid rgba(74,222,128,0.45)',
            background: 'rgba(6,78,59,0.92)',
            color: '#bbf7d0',
            padding: '9px 14px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 14px 34px rgba(2,6,23,0.34)',
          }}
        >
          <Check size={14} />
          Saved
        </div>
      )}

      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close add account modal"
            onClick={closeAddAccountModal}
            className="absolute inset-0 bg-black/70"
          />
          <div
            style={{
              position: 'relative',
              width: 'min(680px, 100%)',
              borderRadius: '16px',
              border: '1px solid rgba(51,65,85,0.9)',
              background: 'linear-gradient(180deg,rgba(13,21,38,0.96),rgba(8,13,25,0.96))',
              boxShadow: '0 28px 80px rgba(2,6,23,0.6)',
              padding: '18px',
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>Add Trading Account</p>
                <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(148,163,184,0.9)' }}>
                  Create an account profile without cluttering the table.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddAccountModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: '1px solid rgba(51,65,85,0.7)',
                  background: 'rgba(2,6,23,0.55)',
                  color: '#94a3b8',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
              <label>
                <FieldLabel>Account name</FieldLabel>
                <input
                  style={{
                    ...tableInputStyle,
                    background: '#070c18',
                    border: '1px solid rgba(51,65,85,0.7)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                  }}
                  placeholder="Account name"
                  value={newAccount.name}
                  onChange={e => setNewAccount(current => ({ ...current, name: e.target.value }))}
                  autoFocus
                />
              </label>

              <label>
                <FieldLabel>Broker</FieldLabel>
                <input
                  style={{
                    ...tableInputStyle,
                    background: '#070c18',
                    border: '1px solid rgba(51,65,85,0.7)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                  }}
                  placeholder="Broker"
                  value={newAccount.broker}
                  onChange={e => setNewAccount(current => ({ ...current, broker: e.target.value }))}
                />
              </label>

              <label>
                <FieldLabel>Credentials</FieldLabel>
                <input
                  type="password"
                  style={{
                    ...tableInputStyle,
                    background: '#070c18',
                    border: '1px solid rgba(51,65,85,0.7)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                  }}
                  placeholder="Account login or key"
                  value={newAccount.credentials}
                  onChange={e => setNewAccount(current => ({ ...current, credentials: e.target.value }))}
                />
              </label>

              <label>
                <FieldLabel>Account type</FieldLabel>
                <StyledSelect
                  value={newAccount.type}
                  onChange={value => setNewAccount(current => ({ ...current, type: value as TradingAccountType }))}
                >
                  {ACCOUNT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </StyledSelect>
              </label>

              <label>
                <FieldLabel>Status</FieldLabel>
                <StatusSelect
                  value={newAccount.status}
                  onChange={status => setNewAccount(current => ({ ...current, status }))}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAddAccountModal}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '7px 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAccount}
                className="btn-primary"
                style={{ fontSize: '12px', padding: '7px 14px' }}
              >
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
