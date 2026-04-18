import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import Header from './Header.js';
import RiskWarningBanner from '../risk/RiskWarningBanner.js';
import FlyxaChatWidget from '../common/FlyxaChatWidget.js';
import { useRisk } from '../../contexts/RiskContext.js';

export default function Layout() {
  const { riskLevel, dailyStatus } = useRisk();
  const location = useLocation();
  const isJournalWorkspace = location.pathname === '/scanner';
  const isFullBleed = location.pathname === '/chart'
    || location.pathname === '/backtest'
    || location.pathname === '/'
    || isJournalWorkspace;

  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {location.pathname !== '/' && !isJournalWorkspace && <Header />}
        {riskLevel !== 'normal' && dailyStatus && (
          <RiskWarningBanner riskLevel={riskLevel} dailyStatus={dailyStatus} />
        )}
        <main className={isFullBleed ? 'flex-1 overflow-hidden p-0' : 'flex-1 overflow-auto p-8'}>
          <div className={isFullBleed ? 'h-full w-full' : 'mx-auto max-w-[1400px]'}>
            <Outlet />
          </div>
        </main>
      </div>
      {location.pathname !== '/' && !isJournalWorkspace && <FlyxaChatWidget />}
    </div>
  );
}
