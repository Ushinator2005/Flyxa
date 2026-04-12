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
  X,
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
  { path: '/achievements', icon: Trophy, label: 'Achievements' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <FlyxaLogo
          size={38}
          showWordmark
          subtitle="Futures Journal"
          wordmarkClassName="text-lg"
          subtitleClassName="text-xs uppercase tracking-[0.24em] text-slate-500"
        />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);
          return (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="px-3 py-2 mb-2">
          <div className="text-xs text-slate-500">Signed in as</div>
          <div className="text-sm text-slate-300 truncate">{user?.email}</div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="theme-mobile-menu lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg text-slate-300"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`theme-sidebar lg:hidden fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-700/50 z-50 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      <aside className="theme-sidebar hidden lg:flex flex-col w-60 min-h-screen bg-slate-900 border-r border-slate-700/50 flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}

