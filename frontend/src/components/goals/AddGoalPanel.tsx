import { useEffect, useRef, useState } from 'react';
import { Image, X } from 'lucide-react';
import type { Goal, GoalInput } from '../../hooks/useGoals.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editGoal?: Goal | null;
  onSave: (data: GoalInput) => void;
}

type FormState = {
  title: string;
  category: Goal['category'];
  target_date: string;
  description: string;
  cover_image: string;
  status: 'Active' | 'Paused';
};

const EMPTY: FormState = {
  title: '',
  category: 'Financial',
  target_date: '',
  description: '',
  cover_image: '',
  status: 'Active',
};

const CATEGORY_ACTIVE: Record<Goal['category'], string> = {
  Financial:  'border-amber-400/60 bg-amber-500/15 text-amber-200',
  Discipline: 'border-blue-400/60 bg-blue-500/15 text-blue-200',
  Lifestyle:  'border-emerald-400/60 bg-emerald-500/15 text-emerald-200',
  Skill:      'border-purple-400/60 bg-purple-500/15 text-purple-200',
};

export default function AddGoalPanel({ isOpen, onClose, editGoal, onSave }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form when editing or reset when adding
  useEffect(() => {
    if (!isOpen) return;
    if (editGoal) {
      setForm({
        title:        editGoal.title,
        category:     editGoal.category,
        target_date:  editGoal.target_date ?? '',
        description:  editGoal.description ?? '',
        cover_image:  editGoal.cover_image ?? '',
        status:       editGoal.status === 'Achieved' ? 'Active' : editGoal.status,
      });
    } else {
      setForm(EMPTY);
    }
  }, [editGoal, isOpen]);

  // Close on Escape
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
      target_date: form.target_date || undefined,
      description: form.description.trim() || undefined,
      cover_image: form.cover_image || undefined,
      status:      form.status,
    });
    onClose();
  };

  const readImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setForm(p => ({ ...p, cover_image: (e.target?.result as string) ?? '' }));
    };
    reader.readAsDataURL(file);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(p => ({ ...p, [key]: value }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-in panel */}
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

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-slate-900">
          {/* Title */}
          <div>
            <label className="label">Goal title <span className="text-red-400/80">*</span></label>
            <input
              className="input-field"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Hit $10k profit month"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Financial', 'Discipline', 'Lifestyle', 'Skill'] as const).map(cat => {
                const active = form.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('category', cat)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition hover:border-slate-500 hover:text-slate-200 ${
                      active ? CATEGORY_ACTIVE[cat] : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target date */}
          <div>
            <label className="label">Target date</label>
            <input
              type="date"
              className="input-field"
              value={form.target_date}
              onChange={e => set('target_date', e.target.value)}
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

          {/* Cover image */}
          <div>
            <label className="label">
              Cover image{' '}
              <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <div
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[#1d6ef5]/60 bg-[#1d6ef5]/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith('image/')) readImage(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {form.cover_image ? (
                <>
                  <img
                    src={form.cover_image}
                    alt="cover preview"
                    className="h-28 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); set('cover_image', ''); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove image
                  </button>
                </>
              ) : (
                <>
                  <Image size={22} className="text-slate-600" />
                  <p className="mt-2 text-sm text-slate-500">Drag &amp; drop or click to upload</p>
                  <p className="text-xs text-slate-600">JPG, PNG, WEBP</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) readImage(file);
                }}
              />
            </div>
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

        {/* Footer CTA */}
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
