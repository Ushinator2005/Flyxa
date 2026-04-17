import { useMemo } from 'react';
import { getRivalMetricValue } from '../lib/mascotProgression.js';
import { useRivals } from '../hooks/useRivals.js';
import MascotPanel from '../components/rivals/MascotPanel.js';
import RivalsList from '../components/rivals/RivalsList.js';
import Leaderboard from '../components/rivals/Leaderboard.js';

export default function Rivals() {
  const { rivals, addRival } = useRivals();
  const today = new Date().toISOString().split('T')[0];

  const currentUser = rivals.find(r => r.isMe)!;

  const quickStats = useMemo(() => {
    const others = rivals.filter(r => !r.isMe);
    const sortedByStreak = [...rivals].sort(
      (a, b) => getRivalMetricValue(b, 'streak') - getRivalMetricValue(a, 'streak'),
    );
    const myRank = sortedByStreak.findIndex(r => r.isMe) + 1;
    return { totalRivals: others.length, myRank, myStreak: currentUser.mascot.streakDays };
  }, [rivals, currentUser]);

  return (
    <div
      style={{
        background: '#070c18',
        margin: '-32px',
        padding: '36px 32px',
        minHeight: 'calc(100% + 64px)',
        boxSizing: 'border-box',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#1d6ef5',
            margin: '0 0 10px',
          }}
        >
          Rivals
        </p>
        <h1
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 32,
            fontWeight: 400,
            color: '#e2e8f0',
            margin: '0 0 10px',
            lineHeight: 1.2,
          }}
        >
          Trade better.{' '}
          <em style={{ fontStyle: 'italic' }}>Beat your friends.</em>
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: 'rgba(148,163,184,0.65)',
            margin: '0 0 22px',
            maxWidth: 520,
            lineHeight: 1.6,
          }}
        >
          Challenge your circle. Your mascot evolves the longer your streak runs — don't let it weaken.
        </p>

        {/* Quick stats row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <QuickStat label="Total rivals" value={String(quickStats.totalRivals)} />
          <QDivider />
          <QuickStat label="Your rank" value={`#${quickStats.myRank}`} />
          <QDivider />
          <QuickStat label="Your streak" value={`${quickStats.myStreak}d`} />
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* Left: mascot panel */}
        <MascotPanel mascot={currentUser.mascot} lastJournalDate={today} />

        {/* Right: rivals list + leaderboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RivalsList rivals={rivals} currentUser={currentUser} onAddRival={addRival} />
          <Leaderboard rivals={rivals} currentUserId={currentUser.id} defaultMetric="streak" />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ paddingRight: 20 }}>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 18,
          color: '#e2e8f0',
          fontWeight: 400,
          lineHeight: 1.1,
          marginBottom: 3,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: 'rgba(148,163,184,0.50)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function QDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 28,
        background: 'rgba(255,255,255,0.08)',
        marginRight: 20,
        flexShrink: 0,
      }}
    />
  );
}
