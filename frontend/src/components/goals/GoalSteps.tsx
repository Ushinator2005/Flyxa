import { useRef, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { GoalStep } from '../../types/goals.js';

interface Props {
  goalId: string;
  steps: GoalStep[];
  progress: number;
  onToggleStep: (goalId: string, stepId: string) => void;
  onAddStep: (goalId: string, title: string) => void;
  onDeleteStep: (goalId: string, stepId: string) => void;
}


export default function GoalSteps({ goalId, steps, progress, onToggleStep, onAddStep, onDeleteStep }: Props) {
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const title = newTitle.trim();
    if (!title) return;
    onAddStep(goalId, title);
    setNewTitle('');
  };

  return (
    <div className="border-t border-slate-700/50 pt-4 mt-4">
      {/* Section header + progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Milestones</span>
        <span className="text-[11px] font-semibold text-slate-400">{progress}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-slate-800 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#1d6ef5] relative overflow-hidden"
          style={{ width: `${progress}%`, transition: 'width 600ms ease-out' }}
        >
          <div className="absolute inset-0 goal-progress-shimmer" />
        </div>
      </div>

      {/* Step list */}
      {steps.length > 0 && (
        <div className="space-y-2 mb-3">
          {steps.map(step => (
            <div key={step.id} className="group flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => onToggleStep(goalId, step.id)}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all duration-150 active:scale-110 ${
                  step.done
                    ? 'bg-[#1d6ef5] border border-[#1d6ef5]'
                    : 'border border-slate-600 hover:border-[#1d6ef5]/60'
                }`}
              >
                {step.done && <Check size={9} className="text-white" strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-5 transition-colors ${step.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                  {step.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteStep(goalId, step.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 pt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add step inline input */}
      <div className="flex items-center gap-2 pt-1">
        <Plus size={13} className="shrink-0 text-slate-600" />
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
          }}
          onBlur={commit}
          placeholder="Add a step… press Enter to save"
          className="flex-1 bg-transparent text-sm text-slate-400 placeholder-slate-600 outline-none"
        />
      </div>
    </div>
  );
}
