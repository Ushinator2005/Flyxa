import type { Mascot, MascotStage } from '../../types/rivals.js';
import { getMascotHealth, getMascotLabel, getStageProgress } from '../../lib/mascotProgression.js';
import MascotCharacter from './MascotCharacter.js';

interface MascotPanelProps {
  mascot: Mascot;
  lastJournalDate?: string;
}

const STAGE_ORDER: MascotStage[] = ['seed', 'rookie', 'veteran', 'elite', 'apex'];

const STAGE_EMOJI: Record<MascotStage, string> = {
  seed: '🥚',
  rookie: '🐣',
  veteran: '🐂',
  elite: '⚡',
  apex: '👑',
};

const STAT_BARS = [
  { key: 'discipline' as const, label: 'Discipline', color: '#1d6ef5', max: 100 },
  { key: 'psychology' as const, label: 'Psychology', color: '#7c3aed', max: 100 },
  { key: 'consistency' as const, label: 'Consistency', color: '#0d9488', max: 100 },
  { key: 'backtestHours' as const, label: 'Backtest hrs', color: '#f59e0b', max: 100 },
];

const HEALTH_BADGE: Record<string, { dot: string; label: string }> = {
  healthy: { dot: '#4ade80', label: 'Healthy' },
  tired: { dot: '#fbbf24', label: 'Tired — journal today' },
  sick: { dot: '#f97316', label: 'Getting weak — come back!' },
  critical: { dot: '#f87171', label: 'Streak broken — rebuild now' },
};

const labelStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'rgba(148,163,184,0.50)',
};

export default function MascotPanel({ mascot, lastJournalDate }: MascotPanelProps) {
  const today = new Date().toISOString().split('T')[0];
  const journalDate = lastJournalDate ?? today;
  const health = getMascotHealth(mascot.streakDays, journalDate);
  const { current, next, progressPct } = getStageProgress(mascot.streakDays);
  const healthBadge = HEALTH_BADGE[health];

  return (
    <div
      style={{
        background: '#0c1422',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>Your Mascot</div>
        <div
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 17,
            color: '#e2e8f0',
            fontWeight: 400,
            marginBottom: 6,
          }}
        >
          {mascot.name}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: '#4d8ef7',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          {getMascotLabel(mascot.stage)}
        </div>
        {/* Health badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 100,
            background: `${healthBadge.dot}14`,
            border: `1px solid ${healthBadge.dot}30`,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: healthBadge.dot, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              color: healthBadge.dot,
              letterSpacing: '0.06em',
            }}
          >
            {healthBadge.label}
          </span>
        </div>
      </div>

      {/* Mascot character */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 18px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <MascotCharacter stage={mascot.stage} health={health} size={160} />

        {/* Streak badge */}
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 14px',
            borderRadius: 100,
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.22)',
          }}
        >
          <span style={{ fontSize: 14 }}>🔥</span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 16,
              fontWeight: 500,
              color: '#fbbf24',
            }}
          >
            {mascot.streakDays}
          </span>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              color: 'rgba(148,163,184,0.55)',
            }}
          >
            day streak
          </span>
        </div>
      </div>

      {/* Stat bars */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STAT_BARS.map(bar => {
            const raw = mascot.stats[bar.key];
            const pct = Math.min(100, Math.round((raw / bar.max) * 100));
            return (
              <div key={bar.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={labelStyle}>{bar.label}</span>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      color: bar.color,
                      fontWeight: 500,
                    }}
                  >
                    {raw}
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.055)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: bar.color,
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage progression */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Stage progression</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          {/* Connecting line */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              right: 14,
              height: 1,
              background: 'rgba(255,255,255,0.07)',
            }}
          />
          {STAGE_ORDER.map((stage, idx) => {
            const currentIdx = STAGE_ORDER.indexOf(current);
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const bg = isPast ? 'rgba(74,222,128,0.12)' : isCurrent ? 'rgba(29,110,245,0.15)' : 'rgba(255,255,255,0.03)';
            const border = isPast ? 'rgba(74,222,128,0.35)' : isCurrent ? 'rgba(29,110,245,0.45)' : 'rgba(255,255,255,0.07)';
            const textColor = isPast ? 'rgba(74,222,128,0.7)' : isCurrent ? '#4d8ef7' : 'rgba(148,163,184,0.30)';

            return (
              <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: bg,
                    border: `1px solid ${border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                  }}
                >
                  {STAGE_EMOJI[stage]}
                </div>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 7.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: textColor,
                    textAlign: 'center',
                  }}
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
        {/* Progress to next stage */}
        {next && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...labelStyle, fontSize: 8.5 }}>
                Progress to {next}
              </span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4d8ef7' }}>
                {progressPct}%
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.055)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: '#1d6ef5',
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
