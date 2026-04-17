import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Scan,
  Brain,
  BarChart2,
  Target,
  Heart,
  FileText,
  LogOut,
  Menu,
  Trophy,
  Crosshair,
  Swords,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import FlyxaLogo from '../common/FlyxaLogo.js';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/scanner', icon: Scan, label: 'Trade Journal' },
  { path: '/flyxa-ai', icon: Brain, label: 'Flyxa AI' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/backtest', icon: Target, label: 'Backtest' },
  { path: '/psychology', icon: Heart, label: 'Psychology' },
  { path: '/journal', icon: FileText, label: 'Daily Journal' },
  { path: '/goals', icon: Crosshair, label: 'Goals' },
  { path: '/rivals', icon: Swords, label: 'Rivals' },
  { path: '/achievements', icon: Trophy, label: 'Achievements' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden' }}>
      {/* Logo + collapse toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '18px 0' : '16px 14px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <FlyxaLogo
            size={34}
            showWordmark
            subtitle="Trading Intelligence"
            wordmarkClassName="text-base"
            subtitleClassName="text-[9px] uppercase tracking-[0.5em] text-[#1f6570]"
          />
        )}
        {collapsed && (
          <FlyxaLogo size={28} showWordmark={false} />
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(148,163,184,0.5)',
            marginLeft: collapsed ? 0 : 8,
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '10px 0' : '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
                color: isActive ? '#60a5fa' : 'rgba(148,163,184,0.7)',
                background: isActive ? 'rgba(29,110,245,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(29,110,245,0.2)' : '1px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={17} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {!collapsed && (
          <div style={{ padding: '4px 12px 8px', overflow: 'hidden' }}>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)', fontFamily: "'DM Sans', sans-serif", marginBottom: 1 }}>Signed in as</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        )}
        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            width: '100%',
            padding: collapsed ? '10px 0' : '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'rgba(148,163,184,0.5)',
            fontSize: 13,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#f87171'; el.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'rgba(148,163,184,0.5)'; el.style.background = 'transparent'; }}
        >
          <LogOut size={15} />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="theme-mobile-menu md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg text-slate-300"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`theme-sidebar md:hidden fixed top-0 left-0 h-full bg-slate-900 border-r border-slate-700/50 z-50 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 220 }}
      >
        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="theme-sidebar hidden md:flex flex-col min-h-screen bg-slate-900 border-r border-slate-700/50 flex-shrink-0"
        style={{ width: collapsed ? 56 : 210, transition: 'width 0.2s cubic-bezier(.4,0,.2,1)' }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
