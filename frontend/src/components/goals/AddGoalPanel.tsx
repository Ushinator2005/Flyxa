import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Goal, GoalCategory, GoalColor, GoalInput } from '../../types/goals.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editGoal?: Goal | null;
  onSave: (data: GoalInput) => void;
}

type FormState = {
  title: string;
  category: GoalCategory;
  color: GoalColor;
  horizon: string;
  description: string;
  status: 'Active' | 'Paused';
};

const EMPTY: FormState = {
  title: '',
  category: 'Profitability',
  color: 'cobalt',
  horizon: '',
  description: '',
  status: 'Active',
};

const CATEGORY_ACTIVE: Record<GoalCategory, string> = {
  Profitability: 'border-amber-400/60 bg-amber-500/15 text-amber-200',
  Risk:          'border-red-400/60 bg-red-500/15 text-red-200',
  Mindset:       'border-purple-400/60 bg-purple-500/15 text-purple-200',
  Consistency:   'border-teal-400/60 bg-teal-500/15 text-teal-200',
  Discipline:    'border-blue-400/60 bg-blue-500/15 text-blue-200',
};

const COLOR_MAP: Record<GoalColor, { dot: string; label: string; active: string }> = {
  cobalt:  { dot: 'bg-[#1d6ef5]',  label: 'Cobalt',  active: 'border-[#1d6ef5]/50 bg-[#1d6ef5]/10 text-blue-200' },
  amber:   { dot: 'bg-[#f59e0b]',  label: 'Amber',   active: 'border-amber-400/50 bg-amber-500/10 text-amber-200' },
  teal:    { dot: 'bg-[#0d9488]',  label: 'Teal',    active: 'border-teal-400/50 bg-teal-500/10 text-teal-200' },
  purple:  { dot: 'bg-[#7c3aed]',  label: 'Purple',  active: 'border-purple-400/50 bg-purple-500/10 text-purple-200' },
  rose:    { dot: 'bg-[#e11d48]',  label: 'Rose',    active: 'border-rose-400/50 bg-rose-500/10 text-rose-200' },
};

export default function AddGoalPanel({ isOpen, onClose, editGoal, onSave }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editGoal) {
      setForm({
        title:       editGoal.title,
        category:    editGoal.category,
        color:       editGoal.color,
        horizon:     editGoal.horizon ?? '',
        description: editGoal.description ?? '',
        status:      editGoal.status === 'Achieved' ? 'Active' : (editGoal.status as 'Active' | 'Paused'),
      });
    } else {
      setForm(EMPTY);
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [editGoal, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      title:       form.title.trim(),
      category:    form.category,
      color:       form.color,
      horizon:     form.horizon,
      description: form.description.trim(),
      steps:       editGoal?.steps ?? [],
      status:      form.status,
    });
    onClose();
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(p => ({ ...p, [key]: value }));

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-slate-900 border-l border-slate-800 shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 mb-1">
              Vision Board
            </p>
            <h2
              className="text-xl font-normal text-slate-100"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              {editGoal ? 'Edit goal' : 'New goal'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="label">Goal title <span className="text-red-400/80">*</span></label>
            <input
              ref={titleRef}
              className="input-field"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Hit $10k profit month"
            />
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Profitability', 'Risk', 'Mindset', 'Consistency', 'Discipline'] as GoalCategory[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => set('category', cat)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition hover:border-slate-500 hover:text-slate-200 ${
                    form.category === cat ? CATEGORY_ACTIVE[cat] : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2">
              {(Object.keys(COLOR_MAP) as GoalColor[]).map(c => {
                const tok = COLOR_MAP[c];
                const active = form.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    title={tok.label}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      active ? tok.active : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${tok.dot}`} />
                    {tok.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target date */}
          <div>
            <label className="label">Horizon date</label>
            <input
              type="date"
              className="input-field"
              value={form.horizon}
              onChange={e => set('horizon', e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">
              Description{' '}
              <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does achieving this look like?"
            />
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {(['Active', 'Paused'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    form.status === s
                      ? s === 'Active'
                        ? 'border-[#1d6ef5]/50 bg-[#1d6ef5]/10 text-blue-200'
                        : 'border-slate-500 bg-slate-700/40 text-slate-200'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-600">
              Achieved is set automatically when all steps are complete.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.title.trim()}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editGoal ? 'Save changes' : 'Add to vision board'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-slate-600 hover:text-slate-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
