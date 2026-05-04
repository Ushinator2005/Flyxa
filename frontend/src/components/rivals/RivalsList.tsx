import type { Rival } from '../../types/rivals.js';
import { compareMetric, getMascotLabel } from '../../lib/mascotProgression.js';

interface RivalsListProps {
  rivals: Rival[];
  currentUser: Rival;
}

const STAGE_LABELS: Record<string, string> = {
  seed: 'Seed',
  rookie: 'Rookie',
  veteran: 'Veteran',
  elite: 'Elite',
  apex: 'Apex',
};

function getMetricVal(rival: Rival, key: 'streak' | 'discipline' | 'consistency' | 'psychology'): number {
  switch (key) {
    case 'streak':
      return rival.mascot.streakDays;
    case 'discipline':
      return rival.mascot.stats.discipline;
    case 'consistency':
      return rival.mascot.stats.consistency;
    case 'psychology':
      return rival.mascot.stats.psychology;
  }
}

function valueClass(mine: number, theirs: number): 'delta-win' | 'delta-lose' | 'delta-even' {
  const result = compareMetric(mine, theirs);
  if (result === 'winning') return 'delta-win';
  if (result === 'losing') return 'delta-lose';
  return 'delta-even';
}

export default function RivalsList({ rivals, currentUser }: RivalsListProps) {
  const ordered = [...rivals].sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return b.mascot.streakDays - a.mascot.streakDays;
  });

  return (
    <div className="rv-card">
      <div className="rv-section-head">
        <div>
          <div className="rv-section-kicker">Head-to-Head</div>
          <div className="rv-section-title">Your rivals</div>
        </div>
      </div>

      <div className="rv-table-head">
        <span>Rival</span>
        <span className="align-r">Streak</span>
        <span className="align-r">Discipline</span>
        <span className="align-r">Consistency</span>
        <span className="align-r">Psychology</span>
        <span className="align-r">Action</span>
      </div>

      {ordered.map(rival => {
        const isMe = Boolean(rival.isMe);
        const streak = getMetricVal(rival, 'streak');
        const discipline = getMetricVal(rival, 'discipline');
        const consistency = getMetricVal(rival, 'consistency');
        const psychology = getMetricVal(rival, 'psychology');

        return (
          <div key={rival.id} className={`rv-row ${isMe ? 'me' : ''}`}>
            <div className="rv-rival">
              <div
                className="rv-avatar"
                style={{
                  background: `${rival.avatarColor}14`,
                  border: `1px solid ${rival.avatarColor}38`,
                  color: rival.avatarColor,
                }}
              >
                {rival.avatarInitials}
              </div>
              <div className="rv-name">
                <h4 className={isMe ? 'is-me' : undefined}>{rival.displayName}</h4>
                <p>
                  @{rival.username} | {STAGE_LABELS[rival.mascot.stage] ?? getMascotLabel(rival.mascot.stage)}
                </p>
              </div>
            </div>

            <div className={`rv-cell ${isMe ? 'delta-even' : valueClass(currentUser.mascot.streakDays, streak)}`}>{streak}</div>
            <div className={`rv-cell ${isMe ? 'delta-even' : valueClass(currentUser.mascot.stats.discipline, discipline)}`}>{discipline}</div>
            <div className={`rv-cell ${isMe ? 'delta-even' : valueClass(currentUser.mascot.stats.consistency, consistency)}`}>{consistency}</div>
            <div className={`rv-cell ${isMe ? 'delta-even' : valueClass(currentUser.mascot.stats.psychology, psychology)}`}>{psychology}</div>

            <div className="rv-action">
              <span className={`rv-badge ${isMe ? 'me' : ''}`}>{isMe ? 'YOU' : 'VS'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}



