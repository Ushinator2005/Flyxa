import type { Goal } from '../../types/goals.js';
import { Clock, CheckSquare, Pencil } from 'lucide-react';

interface GoalCardProps {
  goal: Goal;
  wide?: boolean;
  onToggleStep: (goalId: string, stepId: string) => void;
  onEdit: (goalId: string) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Profitability: '💰',
  Risk: '🛡',
  Mindset: '🧠',
  Consistency: '📈',
  Discipline: '⚡',
};

const CATEGORY_BADGE_BG: Record<string, string> = {
  Profitability: 'rgba(251,191,36,0.14)',
  Risk: 'rgba(248,113,113,0.14)',
  Mindset: 'rgba(110,168,254,0.14)',
  Consistency: 'rgba(52,211,153,0.14)',
  Discipline: 'rgba(255,255,255,0.08)',
};

function formatDeadline(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  if (days <= 30) return `${days} days left`;
  return `${Math.round(days / 30)} mo left`;
}

export default function GoalCard({ goal, onToggleStep, onEdit }: GoalCardProps) {
  const steps = goal.steps;
  const doneCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const status = goal.status ?? 'Active';
  const isPaused = status === 'Paused';

  const accentColor =
    status === 'Active' ? '#FBBF24'
    : status === 'Achieved' ? '#34D399'
    : 'rgba(92,87,81,1)';

  const progressFill =
    status === 'Active' ? '#FBBF24'
    : status === 'Achieved' ? '#34D399'
    : '#6EA8FE';

  const badgeBg =
    status === 'Active' ? 'rgba(251,191,36,0.14)'
    : status === 'Achieved' ? 'rgba(52,211,153,0.14)'
    : 'rgba(255,255,255,0.08)';

  const badgeColor =
    status === 'Active' ? '#FBBF24'
    : status === 'Achieved' ? '#34D399'
    : '#5c5751';

  const deadline = goal.horizon ? formatDeadline(goal.horizon) : null;
  const catBg = CATEGORY_BADGE_BG[goal.category] ?? 'rgba(255,255,255,0.08)';
  const catEmoji = CATEGORY_EMOJI[goal.category] ?? '🎯';

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--app-panel)',
        border: '1px solid var(--app-border)',
        borderRadius: 8,
        overflow: 'hidden',
        opacity: isPaused ? 0.65 : 1,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,138,26,0.22)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--app-border)';
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: accentColor,
        }}
      />

      {/* Main */}
      <div style={{ padding: '18px 20px 18px 22px', display: 'flex', gap: 16 }}>
        {/* Icon badge */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: catBg,
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          {catEmoji}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--app-text-subtle)',
              marginBottom: 4,
            }}
          >
            {goal.category}
          </div>

          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--app-text)',
              marginBottom: goal.description ? 4 : 12,
            }}
          >
            {goal.title}
          </div>

          {goal.description && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--app-text-muted)',
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              {goal.description}
            </div>
          )}

          {/* Progress bar */}
          <div
            style={{
              height: 3,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: progressFill,
                borderRadius: 2,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 5,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--app-text-muted)',
              }}
            >
              {progress}% complete
            </span>
            <span style={{ fontSize: 11, color: 'var(--app-text-subtle)' }}>
              {totalCount > 0 ? `${doneCount} / ${totalCount} steps` : deadline ?? ''}
            </span>
          </div>

          {/* Meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 3,
                background: badgeBg,
                color: badgeColor,
              }}
            >
              {status}
            </span>

            {deadline && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--app-text-subtle)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <Clock size={11} />
                {deadline}
              </span>
            )}

            {totalCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--app-text-subtle)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <CheckSquare size={11} />
                {doneCount}/{totalCount}
              </span>
            )}

            <div style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                aria-label="Edit goal"
                onClick={() => onEdit(goal.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--app-text-subtle)',
                  cursor: 'pointer',
                  padding: '3px 5px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 3,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    'var(--app-text-muted)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color =
                    'var(--app-text-subtle)';
                }}
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            padding: '12px 20px 12px 22px',
            background: 'rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}
        >
          {steps.map(step => (
            <div
              key={step.id}
              onClick={() => onToggleStep(goal.id, step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  flexShrink: 0,
                  background: step.done ? 'rgba(52,211,153,0.14)' : 'transparent',
                  border: step.done
                    ? '1px solid rgba(52,211,153,0.35)'
                    : '1px solid var(--app-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {step.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="#34D399"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                style={{
                  color: step.done
                    ? 'var(--app-text-subtle)'
                    : 'var(--app-text-muted)',
                  textDecoration: step.done ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(255,255,255,0.15)',
                }}
              >
                {step.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
