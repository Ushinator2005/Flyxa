import { useMemo, useState } from 'react';
import { Plus, SlidersHorizontal, Clock, CheckSquare, Pencil } from 'lucide-react';
import AddGoalPanel from '../components/goals/AddGoalPanel.js';
import { useGoals } from '../hooks/useGoals.js';
import type { Goal, GoalInput } from '../types/goals.js';

type Filter = 'All' | 'Active' | 'Achieved' | 'Paused';

const GOAL_THEME = {
  '--bg': 'var(--app-bg)',
  '--surface-1': 'var(--app-panel)',
  '--surface-2': 'var(--app-panel-strong)',
  '--surface-3': 'rgba(255,255,255,0.08)',
  '--border': 'var(--app-border)',
  '--border-sub': 'rgba(255,255,255,0.05)',
  '--txt': 'var(--app-text)',
  '--txt-2': 'var(--app-text-muted)',
  '--txt-3': 'var(--app-text-subtle)',
  '--cobalt': '#6EA8FE',
  '--cobalt-dim': 'rgba(110,168,254,0.14)',
  '--green': '#34D399',
  '--green-dim': 'rgba(52,211,153,0.14)',
  '--amber': '#FBBF24',
  '--amber-dim': 'rgba(251,191,36,0.14)',
  '--red': '#F87171',
  '--red-dim': 'rgba(248,113,113,0.14)',
} as React.CSSProperties;

type QuoteEntry = { pre: string; bold: string; post: string };

const MOTIVATION_QUOTES: QuoteEntry[] = [
  {
    pre: "Every losing day you journal is a brick between you and the trader who quit. You're ",
    bold: 'still here',
    post: '. Keep building.',
  },
  {
    pre: "The account size doesn't matter right now. ",
    bold: 'The habits do',
    post: '.',
  },
  {
    pre: "Discipline is doing the right thing when no one's watching — ",
    bold: 'including when the market is moving against you',
    post: '.',
  },
  {
    pre: 'One day you\'ll tell someone how hard this period was. ',
    bold: 'Make sure the story ends with how you got through it',
    post: '.',
  },
];

const CATEGORY_EMOJI: Record<string, string> = {
  Profitability: '💰',
  Risk: '🛡',
  Mindset: '🧠',
  Consistency: '📈',
  Discipline: '⚡',
};

const CATEGORY_BADGE_BG: Record<string, string> = {
  Profitability: 'var(--amber-dim)',
  Risk: 'var(--red-dim)',
  Mindset: 'var(--cobalt-dim)',
  Consistency: 'var(--green-dim)',
  Discipline: 'var(--surface-2)',
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
  const months = Math.round(days / 30);
  return `${months} mo left`;
}

interface CardProps {
  goal: Goal;
  onToggleStep: (goalId: string, stepId: string) => void;
  onEdit: (goal: Goal) => void;
}

function GoalCardView({ goal, onToggleStep, onEdit }: CardProps) {
  const steps = goal.steps;
  const doneCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const status = goal.status ?? 'Active';
  const isPaused = status === 'Paused';

  const accentColor =
    status === 'Active' ? 'var(--amber)'
    : status === 'Achieved' ? 'var(--green)'
    : 'var(--txt-3)';

  const progressFill =
    status === 'Active' ? 'var(--amber)'
    : status === 'Achieved' ? 'var(--green)'
    : 'var(--cobalt)';

  const badgeBg =
    status === 'Active' ? 'var(--amber-dim)'
    : status === 'Achieved' ? 'var(--green-dim)'
    : 'var(--surface-2)';

  const badgeColor =
    status === 'Active' ? 'var(--amber)'
    : status === 'Achieved' ? 'var(--green)'
    : 'var(--txt-3)';

  const deadline = goal.horizon ? formatDeadline(goal.horizon) : null;
  const catBg = CATEGORY_BADGE_BG[goal.category] ?? 'var(--surface-2)';
  const catEmoji = CATEGORY_EMOJI[goal.category] ?? '🎯';

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        opacity: isPaused ? 0.65 : 1,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,138,26,0.22)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
    >
      {/* Left status accent */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: accentColor,
          flexShrink: 0,
        }}
      />

      {/* Main content */}
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
          {/* Category label */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--txt-3)',
              marginBottom: 4,
            }}
          >
            {goal.category}
          </div>

          {/* Title */}
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--txt)',
              marginBottom: goal.description ? 4 : 12,
            }}
          >
            {goal.title}
          </div>

          {/* Description */}
          {goal.description && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--txt-2)',
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
              background: 'var(--surface-3)',
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

          {/* Progress labels */}
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
                color: 'var(--txt-2)',
              }}
            >
              {progress}% complete
            </span>
            <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
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
            {/* Status badge */}
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
                  color: 'var(--txt-3)',
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
                  color: 'var(--txt-3)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <CheckSquare size={11} />
                {doneCount}/{totalCount}
              </span>
            )}

            {/* Actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              <button
                type="button"
                aria-label="Edit goal"
                onClick={() => onEdit(goal)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--txt-3)',
                  cursor: 'pointer',
                  padding: '3px 5px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 3,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt-3)'; }}
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-goals section */}
      {steps.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border-sub)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          {/* Section label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 6px 22px',
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--txt-3)',
              }}
            >
              Sub-goals
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: doneCount === totalCount && totalCount > 0 ? 'var(--green)' : 'var(--txt-3)',
              }}
            >
              {doneCount}/{totalCount}
            </span>
          </div>

          {/* Steps list */}
          <div style={{ padding: '0 20px 12px 22px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {steps.map((step, i) => (
              <div
                key={step.id}
                onClick={() => onToggleStep(goal.id, step.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {/* Step number / check */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    flexShrink: 0,
                    marginTop: 1,
                    background: step.done ? 'var(--green-dim)' : 'transparent',
                    border: step.done
                      ? '1px solid rgba(52,211,153,0.35)'
                      : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  {step.done ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="var(--green)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 8,
                        color: 'var(--txt-3)',
                        lineHeight: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Text */}
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: step.done ? 'var(--txt-3)' : 'var(--txt-2)',
                    textDecoration: step.done ? 'line-through' : 'none',
                    textDecorationColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 56,
        paddingBottom: 56,
      }}
    >
      <p
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 22,
          color: 'var(--txt-2)',
          maxWidth: 480,
          lineHeight: 1.6,
          textAlign: 'center',
          margin: '0 auto 12px',
          fontWeight: 400,
        }}
      >
        Set the target. Break it down.{' '}
        <em style={{ fontStyle: 'normal', color: 'var(--amber)' }}>
          Come back on hard days
        </em>{' '}
        to remember why.
      </p>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
          color: 'var(--txt-3)',
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        — Add your first goal below
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--amber)',
          color: '#0a0909',
          border: 'none',
          borderRadius: 5,
          padding: '10px 20px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <Plus size={14} />
        Add your first goal
      </button>
    </div>
  );
}

export default function Goals() {
  const { goals, addGoal, updateGoal, toggleStep } = useGoals();
  const [filter, setFilter] = useState<Filter>('All');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const quote = useMemo(
    () => MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)],
    [],
  );

  const stats = useMemo(
    () => ({
      active: goals.filter(g => g.status === 'Active').length,
      achieved: goals.filter(g => g.status === 'Achieved').length,
      stepsDone: goals.reduce((n, g) => n + g.steps.filter(s => s.done).length, 0),
    }),
    [goals],
  );

  const filteredGoals = useMemo(
    () =>
      filter === 'All'
        ? goals
        : goals.filter(g => (g.status ?? 'Active') === filter),
    [goals, filter],
  );

  const openAdd = () => { setEditingGoal(null); setPanelOpen(true); };
  const openEdit = (goal: Goal) => { setEditingGoal(goal); setPanelOpen(true); };

  const handleSave = (data: GoalInput) => {
    if (editingGoal) {
      updateGoal({ ...editingGoal, ...data });
    } else {
      addGoal({
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div style={GOAL_THEME}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          minHeight: 260,
          padding: '48px 40px 40px',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
          marginBottom: 28,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        {/* Amber radial wash — left side only */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse at 0% 50%, rgba(255,138,26,0.06) 0%, transparent 60%)',
          }}
        />

        {/* Dot grid with right-side fade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage:
              'linear-gradient(to right, black 0%, black 60%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, black 0%, black 60%, transparent 100%)',
          }}
        />

        {/* Horizontal hairline at vertical center */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 1,
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,138,26,0.10) 20%, rgba(255,138,26,0.18) 50%, rgba(255,138,26,0.10) 80%, transparent 100%)',
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--txt-3)',
              marginBottom: 10,
            }}
          >
            Vision Board
          </div>

          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 40,
              fontWeight: 400,
              lineHeight: 1.15,
              color: 'var(--txt)',
              margin: '0 0 10px',
            }}
          >
            Your{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--amber)' }}>why</em>{' '}
            lives here.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--txt-2)',
              maxWidth: 480,
              lineHeight: 1.65,
              margin: '0 0 20px',
            }}
          >
            Every funded account, every car, every freedom — set the target,
            break it into steps, and come back on hard days to remember what all
            the discipline is actually for.
          </p>

          {/* Stat chips */}
          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}
          >
            {[
              { dot: 'var(--amber)', count: stats.active, label: 'active goals' },
              { dot: 'var(--green)', count: stats.achieved, label: 'achieved' },
              { dot: 'var(--cobalt)', count: stats.stepsDone, label: 'steps done' },
            ].map(chip => (
              <div
                key={chip.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '6px 12px',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: chip.dot,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--txt)',
                  }}
                >
                  {chip.count}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    color: 'var(--txt-3)',
                  }}
                >
                  {chip.label}
                </span>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={openAdd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--amber)',
                color: '#0a0909',
                border: '1px solid transparent',
                borderRadius: 5,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Plus size={14} />
              New Goal
            </button>
            <button
              type="button"
              onClick={() => setFilter('Achieved')}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 5,
                padding: '8px 16px',
                fontSize: 13,
                color: 'var(--txt-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              View achieved
            </button>
          </div>
        </div>
      </div>

      {/* ── Motivation stripe ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '18px 22px 18px 28px',
          marginBottom: 24,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: 'linear-gradient(to bottom, var(--amber), rgba(255,138,26,0.15))',
            borderRadius: '0 2px 2px 0',
          }}
        />
        <p
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--txt-2)',
            lineHeight: 1.6,
            margin: '0 0 5px',
          }}
        >
          {quote.pre}
          <em style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--amber)' }}>
            {quote.bold}
          </em>
          {quote.post}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            color: 'var(--txt-3)',
            margin: 0,
          }}
        >
          — Flyxa · Daily reminder
        </p>
      </div>

      {/* ── Filter row ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {(['All', 'Active', 'Achieved', 'Paused'] as Filter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                fontSize: 12,
                padding: '5px 14px',
                borderRadius: 4,
                border: filter === f ? '1px solid var(--border)' : '1px solid transparent',
                background: filter === f ? 'var(--surface-2)' : 'transparent',
                color: filter === f ? 'var(--txt)' : 'var(--txt-3)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => {
                if (filter !== f)
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt-2)';
              }}
              onMouseLeave={e => {
                if (filter !== f)
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt-3)';
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'transparent',
            border: 'none',
            color: 'var(--txt-3)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <SlidersHorizontal size={13} />
          Sort
        </button>
      </div>

      {/* ── Goal list ────────────────────────────────────────────────────── */}
      {goals.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : filteredGoals.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: 'var(--txt-3)',
            paddingTop: 16,
            fontFamily: 'var(--font-sans)',
          }}
        >
          No {filter.toLowerCase()} goals.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredGoals.map(goal => (
            <GoalCardView
              key={goal.id}
              goal={goal}
              onToggleStep={toggleStep}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      <AddGoalPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        editGoal={editingGoal}
        onSave={handleSave}
      />
    </div>
  );
}
