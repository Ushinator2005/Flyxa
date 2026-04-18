import { useMemo } from 'react';
import { getRivalMetricValue } from '../lib/mascotProgression.js';
import { useRivals } from '../hooks/useRivals.js';
import MascotPanel from '../components/rivals/MascotPanel.js';
import RivalsList from '../components/rivals/RivalsList.js';
import Leaderboard from '../components/rivals/Leaderboard.js';

const COBALT = '#1E6FFF';
const AMBER = '#f59e0b';
const S1 = 'var(--app-panel)';
const BORDER = 'var(--app-border)';
const T1 = 'var(--app-text)';
const T2 = 'var(--app-text-muted)';
const T3 = 'var(--app-text-subtle)';
const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: SANS }}>
      <div
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minWidth: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: T1, margin: 0, letterSpacing: '-0.02em' }}>
            Rivals
          </h1>
          <p style={{ fontSize: 12, color: T3, margin: '3px 0 0' }}>
            Head-to-head competition and streak momentum
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          <QuickStatCard label="Total rivals" value={String(quickStats.totalRivals)} accent={COBALT} />
          <QuickStatCard label="Your rank" value={`#${quickStats.myRank}`} accent={AMBER} />
          <QuickStatCard label="Your streak" value={`${quickStats.myStreak}d`} accent={COBALT} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: 16,
            alignItems: 'start',
            minHeight: 0,
          }}
        >
          <MascotPanel mascot={currentUser.mascot} lastJournalDate={today} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <RivalsList rivals={rivals} currentUser={currentUser} onAddRival={addRival} />
            <Leaderboard rivals={rivals} currentUserId={currentUser.id} defaultMetric="streak" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: S1,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: T3,
          marginBottom: 8,
          fontFamily: SANS,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 22,
          lineHeight: 1,
          color: accent,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: T2, marginTop: 6 }}>Performance snapshot</div>
    </div>
  );
}
