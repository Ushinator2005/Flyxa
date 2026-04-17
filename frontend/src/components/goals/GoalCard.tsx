import { useMemo, useState } from 'react';
import type { Goal } from '../../types/goals.js';
import { goalColorMap } from '../../lib/goalColors.js';

if (typeof document !== 'undefined' && !document.getElementById('goal-kf')) {
  const s = document.createElement('style');
  s.id = 'goal-kf';
  s.textContent = `
    @keyframes checkPop {
      0%   { transform: scale(0.5); }
      60%  { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
    .check-pop { animation: checkPop 250ms cubic-bezier(.4,0,.2,1) forwards; }
  `;
  document.head.appendChild(s);
}

interface GoalCardProps {
  goal: Goal;
  wide?: boolean;
  onToggleStep: (goalId: string, stepId: string) => void;
  onEdit: (goalId: string) => void;
}

function formatHorizon(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isNearDeadline(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff <= 14 * 24 * 60 * 60 * 1000;
}

function renderTitle(title: string) {
  const words = title.trim().split(' ');
  if (words.length <= 1) return <>{title}</>;
  const last = words.pop()!;
  return (
    <>
      {words.join(' ')}{' '}
      <em style={{ fontStyle: 'italic' }}>{last}</em>
    </>
  );
}

function ProgressRing({ pct, accent, wide }: { pct: number; accent: string; wide: boolean }) {
  const size = wide ? 88 : 72;
  const r = wide ? 36 : 28;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference - (circumference * pct) / 100;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)', display: 'block' }}
      >
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: wide ? 22 : 18,
            fontWeight: 500,
            color: accent,
            lineHeight: 1,
          }}
        >
          {pct}%
        </span>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 8,
            color: 'rgba(148,163,184,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: 2,
          }}
        >
          done
        </span>
      </div>
    </div>
  );
}

export default function GoalCard({ goal, wide = false, onToggleStep, onEdit }: GoalCardProps) {
  const colors = goalColorMap[goal.color];
  const [poppingStepId, setPoppingStepId] = useState<string | null>(null);

  const doneCount = goal.steps.filter(s => s.done).length;
  const totalCount = goal.steps.length;
  const progress = useMemo(
    () => (totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0),
    [doneCount, totalCount],
  );

  const stepsLeft = totalCount - doneCount;
  const near = goal.horizon ? isNearDeadline(goal.horizon) : false;

  const handleToggle = (stepId: string, wasDone: boolean) => {
    if (!wasDone) {
      setPoppingStepId(stepId);
      setTimeout(() => setPoppingStepId(null), 260);
    }
    onToggleStep(goal.id, stepId);
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#0c1422',
        border: '1px solid rgba(255,255,255,0.055)',
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 5,
          height: '100%',
          background: colors.accent,
          borderRadius: '14px 0 0 14px',
          zIndex: 1,
        }}
      />

      {/* Color wash */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '60%',
          height: '100%',
          background: `linear-gradient(90deg, ${colors.accent}0a 0%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ padding: wide ? '20px 22px 22px 26px' : '18px 18px 20px 24px', position: 'relative', zIndex: 2 }}>
        {/* Top row: left content + ring */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          {/* Left side */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Category pill + edit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 100,
                  background: colors.categoryBg,
                  color: colors.categoryText,
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors.accent, flexShrink: 0 }} />
                {goal.category}
              </span>

              <button
                type="button"
                onClick={() => onEdit(goal.id)}
                title="Edit goal"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'rgba(148,163,184,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.8)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.35)')}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M9.5 1.5a1.5 1.5 0 0 1 2 2L4 11H1.5V8.5L9.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Title */}
            <h3
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: wide ? 28 : 22,
                lineHeight: 1.25,
                color: '#e4eaf8',
                margin: '0 0 8px',
                fontWeight: 400,
              }}
            >
              {renderTitle(goal.title)}
            </h3>

            {/* Description */}
            {goal.description && (
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: '#3a4a65',
                  lineHeight: 1.65,
                  margin: 0,
                  maxWidth: 380,
                }}
              >
                {goal.description}
              </p>
            )}
          </div>

          {/* Progress ring */}
          <ProgressRing pct={progress} accent={colors.accent} wide={wide} />
        </div>

        {/* Milestones */}
        {goal.steps.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(148,163,184,0.40)',
                marginBottom: 10,
              }}
            >
              Milestones
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {goal.steps.map(step => (
                <div
                  key={step.id}
                  onClick={() => handleToggle(step.id, step.done)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '7px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.035)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div
                    className={poppingStepId === step.id ? 'check-pop' : undefined}
                    style={{
                      flexShrink: 0,
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: step.done ? `1.5px solid ${colors.accent}` : '1.5px solid rgba(255,255,255,0.14)',
                      background: step.done ? colors.accent : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s, border 0.15s',
                    }}
                  >
                    {step.done && (
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13.5,
                      color: step.done ? '#2e3f60' : '#7a8ea8',
                      textDecoration: step.done ? 'line-through' : 'none',
                      lineHeight: 1.4,
                    }}
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
          }}
        >
          {goal.horizon ? (
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 20,
                border: near ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.07)',
                color: near ? '#fbbf24' : '#2e3f60',
                background: near ? 'rgba(245,158,11,0.06)' : 'transparent',
              }}
            >
              {near ? '⚡ ' : ''}{formatHorizon(goal.horizon)}
            </span>
          ) : (
            <span />
          )}
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              color: stepsLeft === 0 ? colors.accentText : 'rgba(148,163,184,0.4)',
            }}
          >
            {stepsLeft === 0 ? 'All done!' : `${stepsLeft} step${stepsLeft !== 1 ? 's' : ''} left`}
          </span>
        </div>
      </div>
    </div>
  );
}
