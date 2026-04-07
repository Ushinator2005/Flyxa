import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import Header from './Header.js';
import RiskWarningBanner from '../risk/RiskWarningBanner.js';
import { useRisk } from '../../contexts/RiskContext.js';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { riskLevel, dailyStatus } = useRisk();
  const location = useLocation();
  const isFullBleedChartPage = location.pathname === '/chart' || location.pathname === '/backtest';

  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        {riskLevel !== 'normal' && dailyStatus && (
          <RiskWarningBanner riskLevel={riskLevel} dailyStatus={dailyStatus} />
        )}
        <main className={isFullBleedChartPage ? 'flex-1 overflow-hidden p-0' : 'flex-1 overflow-auto p-8'}>
          <div className={isFullBleedChartPage ? 'h-full w-full' : 'mx-auto max-w-[1400px]'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
