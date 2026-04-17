import { useState } from 'react';
import type { LeaderboardMetric, Rival } from '../../types/rivals.js';
import { getMascotLabel, getRivalMetricValue } from '../../lib/mascotProgression.js';

interface LeaderboardProps {
  rivals: Rival[];
  currentUserId: string;
  defaultMetric?: LeaderboardMetric;
}

const TABS: { key: LeaderboardMetric; label: string; unit: string }[] = [
  { key: 'streak',      label: 'Streak',     unit: 'days' },
  { key: 'discipline',  label: 'Discipline', unit: 'pts' },
  { key: 'backtest',    label: 'Backtest',   unit: 'hrs' },
  { key: 'psychology',  label: 'Psychology', unit: 'pts' },
];

const RANK_CFG: Record<number, { color: string; glow: string; rowBg: string }> = {
  1: { color: '#f59e0b', glow: 'rgba(245,158,11,0.5)',  rowBg: 'rgba(245,158,11,0.04)' },
  2: { color: '#94a3b8', glow: 'rgba(148,163,184,0.35)', rowBg: 'rgba(148,163,184,0.025)' },
  3: { color: '#b87333', glow: 'rgba(184,115,51,0.35)',  rowBg: 'rgba(184,115,51,0.03)' },
};

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
        background: '#0a1120',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 20px 0',
          background: 'rgba(255,255,255,0.015)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: 12,
        }}
      >
        <div style={{ paddingBottom: 13 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.35)', marginBottom: 2 }}>
            Ranked by {activeTab.label.toLowerCase()}
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: '#c8d4e8', letterSpacing: '-0.01em' }}>
            Friend leaderboard
          </div>
        </div>

        {/* Underline tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const isActive = metric === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMetric(tab.key)}
                style={{
                  height: 42,
                  padding: '0 13px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #1d6ef5' : '2px solid transparent',
                  background: 'transparent',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9.5,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: isActive ? '#4d8ef7' : 'rgba(148,163,184,0.40)',
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

      {/* Rows */}
      <div>
        {sorted.map((rival, idx) => {
          const rank = idx + 1;
          const cfg = RANK_CFG[rank];
          const val = getRivalMetricValue(rival, metric);
          const barPct = Math.round((val / maxVal) * 100);
          const isMe = rival.id === currentUserId || rival.isMe;
          const stageLabel = getMascotLabel(rival.mascot.stage);

          const rankColor = cfg ? cfg.color : 'rgba(148,163,184,0.25)';
          const barColor = isMe ? '#1d6ef5' : cfg ? cfg.color : rival.avatarColor;

          return (
            <div
              key={rival.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                padding: '13px 20px',
                borderBottom: idx < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                borderLeft: isMe
                  ? '2px solid #1d6ef5'
                  : cfg
                  ? `2px solid ${cfg.color}55`
                  : '2px solid transparent',
                background: isMe ? 'rgba(29,110,245,0.05)' : cfg ? cfg.rowBg : 'transparent',
              }}
            >
              {/* Rank number */}
              <div
                style={{
                  flexShrink: 0,
                  width: 30,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: rank <= 3 ? 16 : 12,
                  fontWeight: rank <= 3 ? 700 : 400,
                  color: rankColor,
                  textShadow: cfg ? `0 0 14px ${cfg.glow}` : 'none',
                  letterSpacing: '-0.02em',
                }}
              >
                {rank <= 3 ? `0${rank}` : rank}
              </div>

              {/* Avatar — rounded square */}
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: `${rival.avatarColor}14`,
                  border: `1.5px solid ${rival.avatarColor}38`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  color: rival.avatarColor,
                  marginRight: 10,
                }}
              >
                {rival.avatarInitials}
              </div>

              {/* Name + stage */}
              <div style={{ flex: '0 0 130px', minWidth: 0, marginRight: 14 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isMe ? '#4d8ef7' : '#dde6f5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 1,
                  }}
                >
                  {rival.displayName}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'rgba(148,163,184,0.38)', letterSpacing: '0.02em' }}>
                  {stageLabel}
                </div>
              </div>

              {/* Full-width bar */}
              <div style={{ flex: 1, marginRight: 16 }}>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${barPct}%`,
                      borderRadius: 3,
                      background: barColor,
                      transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
                      boxShadow: rank === 1 ? `0 0 10px ${barColor}90` : undefined,
                    }}
                  />
                </div>
              </div>

              {/* Score */}
              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 38 }}>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 17,
                    fontWeight: 600,
                    color: isMe ? '#4d8ef7' : cfg ? cfg.color : '#64748b',
                    lineHeight: 1,
                    marginBottom: 1,
                    textShadow: cfg && rank === 1 ? `0 0 16px ${cfg.glow}` : 'none',
                  }}
                >
                  {val}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: 'rgba(148,163,184,0.30)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
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
