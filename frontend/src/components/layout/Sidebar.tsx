import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Scan, Brain, BarChart2, Target,
  Heart, FileText, Crosshair, Swords, Trophy,
  Settings, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useAppSettings } from '../../contexts/AppSettingsContext.js';

const AMBER      = '#f59e0b';
const AMBER_DIM  = 'rgba(245,158,11,0.10)';
const AMBER_BORD = 'rgba(245,158,11,0.20)';
const S1         = 'var(--app-panel)';
const BORDER     = 'var(--app-border)';
const BSUB       = 'rgba(255,255,255,0.04)';
const T1         = 'var(--app-text)';
const T2         = 'var(--app-text-muted)';
const T3         = 'var(--app-text-subtle)';
const SANS       = 'var(--font-sans)';
const MONO       = 'var(--font-mono)';

const navItems = [
  { path: '/',           icon: LayoutDashboard, label: 'Dashboard'    },
  { path: '/scanner',    icon: Scan,            label: 'Trade Journal' },
  { path: '/flyxa-ai',   icon: Brain,           label: 'Flyxa AI'      },
  { path: '/analytics',  icon: BarChart2,        label: 'Analytics'    },
  { path: '/backtest',   icon: Target,           label: 'Backtest'     },
  { path: '/psychology', icon: Heart,            label: 'Psychology'   },
  { path: '/journal',    icon: FileText,         label: 'Daily Journal' },
  { path: '/goals',      icon: Crosshair,        label: 'Goals'        },
  { path: '/rivals',     icon: Swords,           label: 'Rivals'       },
  { path: '/achievements',icon: Trophy,          label: 'Achievements' },
];

function NavItem({
  path, icon: Icon, label, exact = false, onClick,
}: {
  path: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; onClick?: () => void;
}) {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === path
    : location.pathname === path || location.pathname.startsWith(path + '/');

  const [hov, setHov] = useState(false);

  return (
    <NavLink
      to={path}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 6,
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        textDecoration: 'none', fontFamily: SANS,
        color: isActive ? AMBER : hov ? T1 : T2,
        background: isActive ? AMBER_DIM : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: isActive ? `1px solid ${AMBER_BORD}` : '1px solid transparent',
        transition: 'background 0.13s, color 0.13s, border-color 0.13s',
      }}
    >
      <Icon size={15} />
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { user, signOut } = useAuth();
  const { accounts, selectedAccountId, setSelectedAccountId } = useAppSettings();
  const selectedAcct = accounts.find(a => a.id === selectedAccountId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Logo */}
      <div style={{
        minHeight: 62,
        borderBottom: `1px solid ${BSUB}`,
        background: S1,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <svg
          viewBox="0 0 160 38"
          fill="none"
          preserveAspectRatio="xMinYMid meet"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 112,
            height: 24,
            pointerEvents: 'none',
          }}
        >
          <line x1="0" y1="27" x2="48" y2="27" stroke="rgba(245,158,11,0.55)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="48" y1="27" x2="76" y2="9" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="76" y1="9" x2="160" y2="9" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="48" cy="27" r="4.8" fill="#F59E0B" />
        </svg>
      </div>

      {/* Nav + Accounts */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Main nav */}
        <div>
          <p style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: T3, padding: '0 12px', marginBottom: 5,
          }}>Main</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(item => (
              <NavItem
                key={item.path}
                path={item.path}
                icon={item.icon}
                label={item.label}
                exact={item.path === '/'}
                onClick={onNavClick}
              />
            ))}
          </div>
        </div>

        {/* Accounts */}
        {accounts.length > 0 && (
          <div>
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: T3, padding: '0 12px', marginBottom: 5,
            }}>Accounts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {accounts.map(acct => {
                const sel = selectedAccountId === acct.id;
                return (
                  <button
                    key={acct.id}
                    onClick={() => setSelectedAccountId(acct.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      width: '100%', padding: '7px 12px', borderRadius: 6,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: sel ? 'rgba(255,255,255,0.04)' : 'transparent',
                      fontSize: 12, fontFamily: SANS,
                      color: sel ? T1 : T2,
                      transition: 'background 0.13s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = sel ? 'rgba(255,255,255,0.04)' : 'transparent'; }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: acct.color || AMBER, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acct.name}
                    </span>
                    <span style={{ fontSize: 9, color: T3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {acct.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Settings */}
      <div style={{ padding: '8px 8px 0', borderTop: `1px solid ${BSUB}` }}>
        <NavItem path="/settings" icon={Settings} label="Settings" onClick={onNavClick} />
      </div>

      {/* User card */}
      <div style={{ padding: '10px 12px 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: AMBER_DIM, border: `1px solid ${AMBER_BORD}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: AMBER, fontFamily: MONO,
        }}>
          {(user?.email ?? 'FX').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email?.split('@')[0] ?? 'Trader'}
          </div>
          <div style={{ fontSize: 10, color: T3, textTransform: 'capitalize' }}>
            {selectedAcct?.status?.toLowerCase() ?? 'free plan'}
          </div>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T3, padding: 4, lineHeight: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.color = T3; }}
        >
          <LogOut size={13} />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden"
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 50,
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none',
            color: T2, cursor: 'pointer',
          }}
          aria-label="Open navigation"
        >
          <Menu size={17} />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className="md:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, height: '100%', width: 240, zIndex: 50,
          background: S1, borderRight: `1px solid ${BORDER}`,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', cursor: 'pointer', color: T3, lineHeight: 0,
          }}
          aria-label="Close navigation"
        >
          <X size={17} />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0"
        style={{
          width: 220, height: '100vh', position: 'sticky', top: 0,
          background: S1, borderRight: `1px solid ${BORDER}`,
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
