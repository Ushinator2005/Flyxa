import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { getRivalMetricValue } from '../lib/mascotProgression.js';
import { useRivals } from '../hooks/useRivals.js';
import MascotCard from '../components/rivals/MascotCard.js';
import RivalsList from '../components/rivals/RivalsList.js';
import Leaderboard from '../components/rivals/Leaderboard.js';
import AddRivalModal from '../components/rivals/AddRivalModal.js';
import '../components/rivals/rivals.css';

export default function Rivals() {
  const { rivals, addRival } = useRivals();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const currentUser = rivals.find(rival => rival.isMe) ?? rivals[0];

  const quickStats = useMemo(() => {
    const others = rivals.filter(rival => !rival.isMe);
    const sortedByStreak = [...rivals].sort(
      (a, b) => getRivalMetricValue(b, 'streak') - getRivalMetricValue(a, 'streak'),
    );
    const myRank = sortedByStreak.findIndex(rival => rival.id === currentUser?.id) + 1;
    return {
      totalRivals: others.length,
      myRank,
      myStreak: currentUser?.mascot.streakDays ?? 0,
    };
  }, [currentUser?.id, currentUser?.mascot.streakDays, rivals]);

  if (!currentUser) return null;

  return (
    <div className="rivals-page">
      <div className="rivals-shell">
        <div className="rivals-top">
          <div>
            <h1 className="rivals-title">Rivals</h1>
            <p className="rivals-subtitle">Compete daily, evolve your mascot, and climb the board.</p>
          </div>
          <button type="button" className="rivals-cta" onClick={() => setIsAddOpen(true)}>
            <Plus size={14} />
            Add Rival
          </button>
        </div>

        <div className="rivals-stats">
          <StatCard label="Total Rivals" value={String(quickStats.totalRivals)} tone="var(--rv-blue)" />
          <StatCard label="Your Rank" value={`#${quickStats.myRank}`} tone="var(--rv-amber)" />
          <StatCard label="Your Streak" value={`${quickStats.myStreak}d`} tone="var(--rv-green)" />
        </div>

        <div className="rivals-main-grid">
          <MascotCard mascot={currentUser.mascot} />
          <div className="rivals-stack">
            <RivalsList rivals={rivals} currentUser={currentUser} />
            <Leaderboard rivals={rivals} currentUserId={currentUser.id} defaultMetric="streak" />
          </div>
        </div>
      </div>

      <AddRivalModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={username => addRival(username)}
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rivals-stat">
      <div className="rivals-stat-label">{label}</div>
      <div className="rivals-stat-value" style={{ color: tone }}>{value}</div>
      <div className="rivals-stat-note">Live performance snapshot</div>
    </div>
  );
}
