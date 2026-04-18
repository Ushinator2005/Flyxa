import { useState } from 'react';
import type { LeaderboardMetric, Rival } from '../../types/rivals.js';
import { getMascotLabel, getRivalMetricValue } from '../../lib/mascotProgression.js';

interface LeaderboardProps {
  rivals: Rival[];
  currentUserId: string;
  defaultMetric?: LeaderboardMetric;
}

const TABS: { key: LeaderboardMetric; label: string; unit: string }[] = [
  { key: 'streak', label: 'Streak', unit: 'days' },
  { key: 'discipline', label: 'Discipline', unit: 'pts' },
  { key: 'backtest', label: 'Backtest', unit: 'hrs' },
  { key: 'psychology', label: 'Psychology', unit: 'pts' },
];

const RANK_CFG: Record<number, { color: string; rowBg: string }> = {
  1: { color: '#f59e0b', rowBg: 'rgba(245,158,11,0.06)' },
  2: { color: '#94a3b8', rowBg: 'rgba(148,163,184,0.04)' },
  3: { color: '#b87333', rowBg: 'rgba(184,115,51,0.04)' },
};

const COBALT = '#1E6FFF';
const COBALT_DIM = 'rgba(30,111,255,0.10)';
const S1 = 'var(--app-panel)';
const BORDER = 'var(--app-border)';
const BSUB = 'rgba(255,255,255,0.04)';
const T1 = 'var(--app-text)';
const T2 = 'var(--app-text-muted)';
const T3 = 'var(--app-text-subtle)';
const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

export default function Leaderboard({ rivals, currentUserId, defaultMetric = 'streak' }: LeaderboardProps) {
  const [metric, setMetric] = useState<LeaderboardMetric>(defaultMetric);

  const sorted = [...rivals].sort(
    (a, b) => getRivalMetricValue(b, metric) - getRivalMetricValue(a, metric),
  );
  const maxVal = Math.max(...sorted.map(r => getRivalMetricValue(r, metric)), 1);
  const activeTab = TABS.find(t => t.key === metric)!;

  return (
    <div
      style={{
        background: S1,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 0',
          borderBottom: `1px solid ${BSUB}`,
          gap: 12,
        }}
      >
        <div style={{ paddingBottom: 12 }}>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T3, marginBottom: 2 }}>
            Ranked by {activeTab.label.toLowerCase()}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: T1 }}>
            Friend leaderboard
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const isActive = metric === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMetric(tab.key)}
                style={{
                  height: 40,
                  padding: '0 12px',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${COBALT}` : '2px solid transparent',
                  background: 'transparent',
                  fontFamily: SANS,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: isActive ? '#6ea8fe' : T3,
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sorted.map((rival, idx) => {
          const rank = idx + 1;
          const cfg = RANK_CFG[rank];
          const val = getRivalMetricValue(rival, metric);
          const barPct = Math.round((val / maxVal) * 100);
          const isMe = rival.id === currentUserId || rival.isMe;
          const stageLabel = getMascotLabel(rival.mascot.stage);

          const rankColor = cfg ? cfg.color : T3;
          const barColor = isMe ? COBALT : cfg ? cfg.color : rival.avatarColor;

          return (
            <div
              key={rival.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                padding: '11px 16px',
                borderBottom: idx < sorted.length - 1 ? `1px solid ${BSUB}` : 'none',
                borderLeft: isMe ? `2px solid ${COBALT}` : cfg ? `2px solid ${cfg.color}66` : '2px solid transparent',
                background: isMe ? COBALT_DIM : cfg ? cfg.rowBg : 'transparent',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 30,
                  fontFamily: MONO,
                  fontSize: rank <= 3 ? 16 : 12,
                  fontWeight: rank <= 3 ? 700 : 500,
                  color: rankColor,
                  letterSpacing: '-0.02em',
                }}
              >
                {rank <= 3 ? `0${rank}` : rank}
              </div>

              <div
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `${rival.avatarColor}14`,
                  border: `1px solid ${rival.avatarColor}38`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  color: rival.avatarColor,
                  marginRight: 10,
                }}
              >
                {rival.avatarInitials}
              </div>

              <div style={{ flex: '0 0 130px', minWidth: 0, marginRight: 14 }}>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isMe ? '#6ea8fe' : T1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 1,
                  }}
                >
                  {rival.displayName}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: T3, letterSpacing: '0.02em' }}>
                  {stageLabel}
                </div>
              </div>

              <div style={{ flex: 1, marginRight: 16 }}>
                <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${barPct}%`,
                      borderRadius: 999,
                      background: barColor,
                      transition: 'width 0.4s cubic-bezier(.4,0,.2,1)',
                    }}
                  />
                </div>
              </div>

              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 40 }}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 16,
                    fontWeight: 600,
                    color: isMe ? '#6ea8fe' : cfg ? cfg.color : T2,
                    lineHeight: 1,
                    marginBottom: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {val}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: T3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {activeTab.unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
