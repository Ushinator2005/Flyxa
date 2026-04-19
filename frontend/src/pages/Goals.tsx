import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import GoalCard from '../components/goals/GoalCard.js';
import AddGoalPanel from '../components/goals/AddGoalPanel.js';
import { useGoals } from '../hooks/useGoals.js';
import type { Goal, GoalInput } from '../types/goals.js';

type Filter = 'All' | 'Active' | 'Achieved' | 'Paused';

const GHOST_CARDS = [
  { lines: ['w-3/4', 'w-1/2', 'w-2/3'],        barW: '75%' },
  { lines: ['w-1/2', 'w-3/4'],                   barW: '45%' },
  { lines: ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5'], barW: '60%' },
];

export default function Goals() {
  const { goals, addGoal, updateGoal, toggleStep } = useGoals();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<Filter>('All');

  const stats = useMemo(() => ({
    active:         goals.filter(g => g.status === 'Active').length,
    achieved:       goals.filter(g => g.status === 'Achieved').length,
    totalStepsDone: goals.reduce((n, g) => n + g.steps.filter(s => s.done).length, 0),
  }), [goals]);

  const filteredGoals = useMemo(
    () => filter === 'All' ? goals : goals.filter(g => g.status === filter),
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
    <>
      {/* Ambient blur — behind everything */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[700px] rounded-full bg-blue-600/[0.04] blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[500px] rounded-full bg-indigo-600/[0.03] blur-[100px]" />
      </div>

      <div className="relative animate-fade-in">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 mb-2">
              Vision Board
            </p>
            <h1
              className="text-4xl font-normal text-slate-100 leading-none tracking-tight"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Your Goals
            </h1>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:border-blue-400/50"
          >
            <Plus size={15} />
            New Goal
          </button>
        </div>

        {/* Stats strip + filter tabs */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3.5 py-2">
            <span className="text-lg font-semibold text-slate-100">{stats.active}</span>
            <span className="text-xs text-slate-500">active</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-2">
            <span className="text-lg font-semibold text-amber-300">{stats.achieved}</span>
            <span className="text-xs text-slate-500">achieved</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3.5 py-2">
            <span className="text-lg font-semibold text-slate-400">{stats.totalStepsDone}</span>
            <span className="text-xs text-slate-500">steps completed</span>
          </div>

          {/* Filter tabs — pushed to the right */}
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
            {(['All', 'Active', 'Achieved', 'Paused'] as Filter[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f
                    ? 'bg-slate-700/80 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {goals.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : filteredGoals.length === 0 ? (
          <p className="text-sm text-slate-600 pt-4">
            No {filter.toLowerCase()} goals.
          </p>
        ) : (
          <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={(id) => openEdit(goals.find(g => g.id === id)!)}
                onToggleStep={toggleStep}
              />
            ))}
          </div>
        )}
      </div>

      <AddGoalPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        editGoal={editingGoal}
        onSave={handleSave}
      />
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-start pt-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-700 mb-4">
        No goals yet
      </p>
      <h2
        className="text-2xl font-normal text-slate-300 mb-2"
        style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      >
        What are you working towards?
      </h2>
      <p className="text-sm text-slate-600 mb-8 max-w-sm leading-relaxed">
        Every funded account, every discipline goal, every lifestyle milestone —
        track it here. Break it into steps. Watch it happen.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 hover:border-slate-600"
      >
        <Plus size={15} />
        Add your first goal
      </button>

      {/* Ghost card grid — shows shape of populated board at low opacity */}
      <div className="mt-12 w-full columns-1 md:columns-2 xl:columns-3 gap-5 opacity-[0.18] pointer-events-none select-none">
        {GHOST_CARDS.map((card, i) => (
          <div key={i} className="break-inside-avoid mb-5 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4">
            <div className="mb-4 h-2 w-16 rounded-full bg-slate-800" />
            <div className="space-y-2 mb-4">
              <div className={`h-4 rounded bg-slate-800 ${card.lines[0]}`} />
              {card.lines.slice(1).map((w, j) => (
                <div key={j} className={`h-2.5 rounded bg-slate-800/70 ${w}`} />
              ))}
            </div>
            <div className="h-[3px] rounded-full bg-slate-800 w-full">
              <div className="h-[3px] rounded-full bg-slate-700" style={{ width: card.barW }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
