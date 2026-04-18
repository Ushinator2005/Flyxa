import { useState } from 'react';
import type { Rival } from '../../types/rivals.js';
import { compareMetric, getMascotLabel } from '../../lib/mascotProgression.js';

interface RivalsListProps {
  rivals: Rival[];
  currentUser: Rival;
  onAddRival: (username: string) => void;
}

const COMPARE_COLOR = { winning: '#22c55e', losing: '#ef4444', tied: '#f59e0b' };

const COLS = ['Streak', 'Discipline', 'Consistency', 'Psychology'] as const;
type ColKey = typeof COLS[number];

const COBALT = '#1E6FFF';
const COBALT_DIM = 'rgba(30,111,255,0.10)';
const S1 = 'var(--app-panel)';
const S2 = 'var(--app-panel-strong)';
const BORDER = 'var(--app-border)';
const BSUB = 'rgba(255,255,255,0.04)';
const T1 = 'var(--app-text)';
const T2 = 'var(--app-text-muted)';
const T3 = 'var(--app-text-subtle)';
const MONO = 'var(--font-mono)';
const SANS = 'var(--font-sans)';

function getMetricVal(rival: Rival, col: ColKey): number {
  switch (col) {
    case 'Streak':
      return rival.mascot.streakDays;
    case 'Discipline':
      return rival.mascot.stats.discipline;
    case 'Consistency':
      return rival.mascot.stats.consistency;
    case 'Psychology':
      return rival.mascot.stats.psychology;
  }
}

export default function RivalsList({ rivals, currentUser, onAddRival }: RivalsListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [sent, setSent] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSend = () => {
    const username = usernameInput.trim();
    if (!username) return;
    onAddRival(username);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setUsernameInput('');
      setModalOpen(false);
    }, 1200);
  };

  return (
    <>
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
            display: 'grid',
            gridTemplateColumns: '1fr 76px 88px 92px 84px 52px',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid ${BSUB}`,
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: T3,
                  marginBottom: 2,
                }}
              >
                Head-to-head
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: T1 }}>
                Your rivals
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                marginLeft: 4,
                height: 24,
                padding: '0 10px',
                borderRadius: 5,
                border: '1px solid rgba(30,111,255,0.35)',
                background: COBALT_DIM,
                fontFamily: SANS,
                fontSize: 11,
                fontWeight: 600,
                color: '#6ea8fe',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
          </div>

          {COLS.map(col => (
            <div
              key={col}
              style={{
                textAlign: 'right',
                fontFamily: SANS,
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: T3,
              }}
            >
              {col}
            </div>
          ))}
          <div />
        </div>

        {rivals.map((rival, idx) => {
          const isMe = !!rival.isMe;
          const isHovered = hoveredId === rival.id;
          const isLast = idx === rivals.length - 1;

          return (
            <div
              key={rival.id}
              onMouseEnter={() => setHoveredId(rival.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 76px 88px 92px 84px 52px',
                alignItems: 'center',
                padding: '11px 16px',
                borderBottom: isLast ? 'none' : `1px solid ${BSUB}`,
                borderLeft: isMe ? `2px solid ${COBALT}` : '2px solid transparent',
                background: isMe ? COBALT_DIM : isHovered ? 'rgba(255,255,255,0.02)' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    letterSpacing: '0.04em',
                  }}
                >
                  {rival.avatarInitials}
                </div>
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: isMe ? '#6ea8fe' : T1, marginBottom: 1 }}>
                    {rival.displayName}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: T3, letterSpacing: '0.02em' }}>
                    @{rival.username} - {getMascotLabel(rival.mascot.stage)}
                  </div>
                </div>
              </div>

              {COLS.map(col => {
                const theirVal = getMetricVal(rival, col);
                const myVal = getMetricVal(currentUser, col);
                const result = isMe ? 'tied' : compareMetric(myVal, theirVal);
                const color = isMe ? T2 : COMPARE_COLOR[result];
                const suffix = isMe ? '' : result === 'winning' ? ' +' : result === 'losing' ? ' -' : ' =';

                return (
                  <div key={col} style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color, fontVariantNumeric: 'tabular-nums' }}>
                      {theirVal}
                      <span style={{ fontSize: 9 }}>{suffix}</span>
                    </span>
                  </div>
                );
              })}

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 20,
                    padding: '0 7px',
                    borderRadius: 4,
                    background: isMe ? COBALT_DIM : 'rgba(255,255,255,0.04)',
                    border: isMe ? '1px solid rgba(30,111,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    fontFamily: MONO,
                    fontSize: 9,
                    fontWeight: 700,
                    color: isMe ? '#6ea8fe' : T3,
                    letterSpacing: '0.06em',
                  }}
                >
                  {isMe ? 'YOU' : 'VS'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setModalOpen(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.60)' }} />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 380,
              background: S2,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T3, marginBottom: 6 }}>
              Rivals
            </p>
            <h2 style={{ fontFamily: SANS, fontSize: 18, color: T1, fontWeight: 600, margin: '0 0 6px' }}>
              Challenge someone
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 12, color: T2, margin: '0 0 16px', lineHeight: 1.5 }}>
              Enter their Flyxa username. They will get a rival request notification.
            </p>
            <input
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: '9px 12px',
                fontFamily: SANS,
                fontSize: 13,
                color: T1,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 12,
              }}
              placeholder="@username"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!usernameInput.trim() || sent}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 6,
                border: '1px solid rgba(30,111,255,0.40)',
                background: sent ? 'rgba(34,197,94,0.12)' : COBALT_DIM,
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 600,
                color: sent ? '#22c55e' : '#6ea8fe',
                cursor: usernameInput.trim() ? 'pointer' : 'not-allowed',
                opacity: usernameInput.trim() ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              {sent ? 'Request sent' : 'Send request'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
