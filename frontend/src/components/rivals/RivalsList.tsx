import { useState } from 'react';
import type { Rival } from '../../types/rivals.js';
import { compareMetric, getMascotLabel } from '../../lib/mascotProgression.js';

interface RivalsListProps {
  rivals: Rival[];
  currentUser: Rival;
  onAddRival: (username: string) => void;
}

const COMPARE_COLOR = { winning: '#22c55e', losing: '#ef4444', tied: '#fbbf24' };

const COLS = ['Streak', 'Discipline', 'Consistency', 'Psychology'] as const;
type ColKey = typeof COLS[number];

function getMetricVal(rival: Rival, col: ColKey): number {
  switch (col) {
    case 'Streak':      return rival.mascot.streakDays;
    case 'Discipline':  return rival.mascot.stats.discipline;
    case 'Consistency': return rival.mascot.stats.consistency;
    case 'Psychology':  return rival.mascot.stats.psychology;
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
    setTimeout(() => { setSent(false); setUsernameInput(''); setModalOpen(false); }, 1200);
  };

  return (
    <>
      <div
        style={{
          background: '#0a1120',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {/* Column header bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 76px 88px 92px 84px 52px',
            alignItems: 'center',
            padding: '13px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          {/* Title + add button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.35)', marginBottom: 2 }}>
                Head-to-head
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: '#c8d4e8', letterSpacing: '-0.01em' }}>
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
                borderRadius: 6,
                border: '1px solid rgba(29,110,245,0.30)',
                background: 'rgba(29,110,245,0.08)',
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                letterSpacing: '0.06em',
                color: '#4d8ef7',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
          </div>

          {/* Metric column headers */}
          {COLS.map(col => (
            <div
              key={col}
              style={{
                textAlign: 'right',
                fontFamily: "'DM Mono', monospace",
                fontSize: 8.5,
                textTransform: 'uppercase',
                letterSpacing: '0.13em',
                color: 'rgba(148,163,184,0.30)',
              }}
            >
              {col}
            </div>
          ))}
          <div />
        </div>

        {/* Data rows */}
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
                padding: '12px 20px',
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                borderLeft: isMe ? '2px solid #1d6ef5' : '2px solid transparent',
                background: isMe
                  ? 'rgba(29,110,245,0.05)'
                  : isHovered
                  ? 'rgba(255,255,255,0.018)'
                  : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              {/* Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    letterSpacing: '0.04em',
                  }}
                >
                  {rival.avatarInitials}
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: isMe ? '#4d8ef7' : '#dde6f5', marginBottom: 1 }}>
                    {rival.displayName}
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'rgba(148,163,184,0.38)', letterSpacing: '0.03em' }}>
                    @{rival.username} · {getMascotLabel(rival.mascot.stage)}
                  </div>
                </div>
              </div>

              {/* Metric columns */}
              {COLS.map(col => {
                const theirVal = getMetricVal(rival, col);
                const myVal = getMetricVal(currentUser, col);
                const result = isMe ? 'tied' : compareMetric(myVal, theirVal);
                const color = isMe ? 'rgba(148,163,184,0.6)' : COMPARE_COLOR[result];
                const arrow = isMe ? '' : result === 'winning' ? ' ↑' : result === 'losing' ? ' ↓' : '';

                return (
                  <div key={col} style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color }}>
                      {theirVal}
                      <span style={{ fontSize: 9 }}>{arrow}</span>
                    </span>
                  </div>
                );
              })}

              {/* Badge */}
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 20,
                    padding: '0 7px',
                    borderRadius: 4,
                    background: isMe ? 'rgba(29,110,245,0.14)' : 'rgba(255,255,255,0.04)',
                    border: isMe ? '1px solid rgba(29,110,245,0.28)' : '1px solid rgba(255,255,255,0.07)',
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 8.5,
                    fontWeight: 700,
                    color: isMe ? '#4d8ef7' : 'rgba(148,163,184,0.38)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {isMe ? 'YOU' : 'VS'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Rival Modal */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setModalOpen(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }} />
          <div
            style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#0e1526', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1d6ef5', marginBottom: 6 }}>Rivals</p>
            <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 20, color: '#e2e8f0', fontWeight: 400, margin: '0 0 6px' }}>Challenge someone</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(148,163,184,0.60)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Enter their Flyxa username. They'll get a rival request notification.
            </p>
            <input
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '9px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
              placeholder="@username"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!usernameInput.trim() || sent}
              style={{ width: '100%', height: 42, borderRadius: 9, border: '1px solid rgba(29,110,245,0.35)', background: sent ? 'rgba(74,222,128,0.12)' : 'rgba(29,110,245,0.14)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: sent ? '#4ade80' : '#4d8ef7', cursor: usernameInput.trim() ? 'pointer' : 'not-allowed', opacity: usernameInput.trim() ? 1 : 0.5, transition: 'all 0.2s' }}
            >
              {sent ? '✓ Request sent!' : 'Send request'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
