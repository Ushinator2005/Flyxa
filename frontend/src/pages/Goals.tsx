import { useMemo, useState } from 'react';
import { Plus, SlidersHorizontal, Clock, CheckSquare, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import AddGoalPanel from '../components/goals/AddGoalPanel.js';
import { useGoals } from '../hooks/useGoals.js';
import type { Goal, GoalInput } from '../types/goals.js';
import './Goals.css';

type Filter = 'All' | 'Active' | 'Achieved' | 'Paused';
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
    pre: "Discipline is doing the right thing when no one's watching - ",
    bold: 'including when the market is moving against you',
    post: '.',
  },
  {
    pre: "One day you'll tell someone how hard this period was. ",
    bold: 'Make sure the story ends with how you got through it',
    post: '.',
  },
];

const CATEGORY_EMOJI: Record<string, string> = {
  Profitability: 'P',
  Risk: 'R',
  Mindset: 'M',
  Consistency: 'C',
  Discipline: 'D',
};

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  Profitability: 'profitability',
  Risk: 'risk',
  Mindset: 'mindset',
  Consistency: 'consistency',
  Discipline: 'discipline',
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
  expanded: boolean;
  onToggleExpanded: (goalId: string) => void;
}

function GoalCardView({ goal, onToggleStep, onEdit, expanded, onToggleExpanded }: CardProps) {
  const steps = goal.steps;
  const doneCount = steps.filter(s => s.done).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const status = goal.status ?? 'Active';
  const isPaused = status === 'Paused';
  const visibleSteps = expanded ? steps : steps.slice(0, 3);
  const hiddenStepsCount = Math.max(0, steps.length - visibleSteps.length);
  const deadline = goal.horizon ? formatDeadline(goal.horizon) : null;
  const categoryClass = CATEGORY_BADGE_CLASS[goal.category] ?? 'discipline';
  const categoryBadge = CATEGORY_EMOJI[goal.category] ?? 'G';
  const cardStateClass = status.toLowerCase();

  return (
    <article className={`goals-card is-${cardStateClass}${isPaused ? ' is-paused' : ''}`}>
      <div className="goals-card-main">
        <div className={`goals-category-badge ${categoryClass}`}>{categoryBadge}</div>

        <div className="goals-card-body">
          <p className="goals-card-category">{goal.category}</p>
          <h3 className="goals-card-title">{goal.title}</h3>

          {goal.description ? <p className="goals-card-description">{goal.description}</p> : null}

          <div className="goals-progress-track">
            <span className="goals-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="goals-progress-meta">
            <span>{progress}% complete</span>
            <span>{totalCount > 0 ? `${doneCount} / ${totalCount} steps` : deadline ?? ''}</span>
          </div>

          <div className="goals-card-meta-row">
            <span className={`goals-status-pill is-${cardStateClass}`}>{status}</span>

            {deadline ? (
              <span className="goals-card-meta-item">
                <Clock size={12} />
                {deadline}
              </span>
            ) : null}

            {totalCount > 0 ? (
              <span className="goals-card-meta-item">
                <CheckSquare size={12} />
                {doneCount}/{totalCount}
              </span>
            ) : null}

            <div className="goals-card-actions">
              {steps.length > 0 ? (
                <button type="button" className="goals-icon-btn" onClick={() => onToggleExpanded(goal.id)} aria-label={expanded ? 'Collapse steps' : 'Expand steps'}>
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              ) : null}
              <button type="button" className="goals-icon-btn" onClick={() => onEdit(goal)} aria-label="Edit goal">
                <Pencil size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {steps.length > 0 ? (
        <section className="goals-subgoals">
          <header className="goals-subgoals-head">
            <span>Sub-goals</span>
            <span className="goals-subgoals-count">{doneCount}/{totalCount}</span>
          </header>

          <div className="goals-subgoals-list">
            {visibleSteps.map((step, i) => (
              <button key={step.id} type="button" className="goals-step" onClick={() => onToggleStep(goal.id, step.id)}>
                <span className={`goals-step-check${step.done ? ' is-done' : ''}`}>{step.done ? '✓' : i + 1}</span>
                <span className={`goals-step-text${step.done ? ' is-done' : ''}`}>{step.text}</span>
              </button>
            ))}

            {!expanded && hiddenStepsCount > 0 ? (
              <button type="button" className="goals-more-btn" onClick={() => onToggleExpanded(goal.id)}>
                +{hiddenStepsCount} more
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="goals-empty">
      <p className="goals-empty-title">
        Set the target. Break it down. <span>Come back on hard days</span> to remember why.
      </p>
      <p className="goals-empty-sub">Add your first goal below</p>
      <button type="button" onClick={onAdd} className="goals-add-btn primary">
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
  const [expandedGoalIds, setExpandedGoalIds] = useState<string[]>([]);

  const quote = useMemo(() => MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)], []);

  const stats = useMemo(
    () => ({
      active: goals.filter(g => g.status === 'Active').length,
      achieved: goals.filter(g => g.status === 'Achieved').length,
      stepsDone: goals.reduce((n, g) => n + g.steps.filter(s => s.done).length, 0),
    }),
    [goals],
  );

  const filteredGoals = useMemo(
    () => (filter === 'All' ? goals : goals.filter(g => (g.status ?? 'Active') === filter)),
    [goals, filter],
  );

  const openAdd = () => {
    setEditingGoal(null);
    setPanelOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setPanelOpen(true);
  };

  const toggleExpanded = (goalId: string) => {
    setExpandedGoalIds(prev => (prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]));
  };

  const handleSave = (data: GoalInput) => {
    if (editingGoal) {
      updateGoal({ ...editingGoal, ...data });
      return;
    }

    addGoal({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="goals-page">
      <section className="goals-hero">
        <p className="goals-eyebrow">Vision Board</p>
        <h1 className="goals-hero-title">
          Your <span>why</span> lives here.
        </h1>
        <p className="goals-hero-copy">
          Every funded account, every car, every freedom - set the target, break it into steps, and come back on hard days to remember what all the discipline is actually for.
        </p>

        <div className="goals-stat-chips">
          <div className="goals-stat-chip">
            <span className="dot amber" />
            <strong>{stats.active}</strong>
            <span>active goals</span>
          </div>
          <div className="goals-stat-chip">
            <span className="dot green" />
            <strong>{stats.achieved}</strong>
            <span>achieved</span>
          </div>
          <div className="goals-stat-chip">
            <span className="dot cobalt" />
            <strong>{stats.stepsDone}</strong>
            <span>steps done</span>
          </div>
        </div>

        <div className="goals-hero-actions">
          <button type="button" onClick={openAdd} className="goals-add-btn primary">
            <Plus size={14} />
            New Goal
          </button>
          <button type="button" onClick={() => setFilter('Achieved')} className="goals-add-btn ghost">
            View achieved
          </button>
        </div>
      </section>

      <section className="goals-quote">
        <p>
          {quote.pre}
          <strong>{quote.bold}</strong>
          {quote.post}
        </p>
        <small>Flyxa - daily reminder</small>
      </section>

      <section className="goals-toolbar">
        <div className="goals-filters">
          {(['All', 'Active', 'Achieved', 'Paused'] as Filter[]).map(f => (
            <button key={f} type="button" className={`goals-filter${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        <button type="button" className="goals-sort-btn">
          <SlidersHorizontal size={14} />
          Sort
        </button>
      </section>

      {goals.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : filteredGoals.length === 0 ? (
        <p className="goals-none-msg">No {filter.toLowerCase()} goals.</p>
      ) : (
        <section className="goals-grid">
          {filteredGoals.map(goal => (
            <GoalCardView
              key={goal.id}
              goal={goal}
              onToggleStep={toggleStep}
              onEdit={openEdit}
              expanded={expandedGoalIds.includes(goal.id)}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </section>
      )}

      <AddGoalPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} editGoal={editingGoal} onSave={handleSave} />
    </div>
  );
}
