import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, Flag, Plus, Search, Sparkles, Target, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ProfitabilityStatus, useOnboarding } from '../contexts/OnboardingContext.js';

type GoalType = 'Performance' | 'Process' | 'Mindset';
type GoalHorizon = 'Daily' | 'Weekly' | 'Monthly';
type GoalStatus = 'open' | 'completed';

interface GoalItem {
  id: string;
  title: string;
  details: string;
  type: GoalType;
  horizon: GoalHorizon;
  targetDate: string;
  progress: number;
  status: GoalStatus;
  createdAt: string;
  completedAt?: string;
}

const GOAL_TYPES: GoalType[] = ['Performance', 'Process', 'Mindset'];
const GOAL_HORIZONS: GoalHorizon[] = ['Daily', 'Weekly', 'Monthly'];
const PROFILE_IMPROVEMENT_OPTIONS = [
  'Risk management',
  'Patience and waiting for setups',
  'Entry timing',
  'Exit discipline',
  'Revenge trading control',
  'Consistency and routines',
  'Confidence under pressure',
  'Following my plan',
];

function storageKey(userId: string) {
  return `tw_goals_${userId}`;
}

function loadGoals(userId: string): GoalItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as GoalItem[]) : [];
  } catch {
    return [];
  }
}

function saveGoals(userId: string, goals: GoalItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(goals));
}

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function typeStyles(type: GoalType) {
  switch (type) {
    case 'Performance':
      return {
        badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/25',
        accent: 'from-emerald-400/35 via-emerald-300/15 to-transparent',
        bar: 'bg-emerald-400',
      };
    case 'Process':
      return {
        badge: 'text-blue-300 bg-blue-500/15 border-blue-400/25',
        accent: 'from-blue-400/35 via-blue-300/15 to-transparent',
        bar: 'bg-blue-400',
      };
    default:
      return {
        badge: 'text-violet-300 bg-violet-500/15 border-violet-400/25',
        accent: 'from-violet-400/35 via-violet-300/15 to-transparent',
        bar: 'bg-violet-400',
      };
  }
}

function formatDate(value: string) {
  if (!value) return 'No date set';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Goals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { survey, saveSurvey } = useOnboarding();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GoalStatus>('all');
  const [profileWhy, setProfileWhy] = useState(survey.whyJournaling);
  const [profileImprovements, setProfileImprovements] = useState<string[]>(survey.improvementAreas);
  const [profileProfitability, setProfileProfitability] = useState<ProfitabilityStatus | null>(survey.profitabilityStatus);
  const [profileRules, setProfileRules] = useState<string[]>(survey.goldenRules.length > 0 ? survey.goldenRules : ['', '', '']);
  const [profileSaved, setProfileSaved] = useState(false);
  const [form, setForm] = useState({
    title: '',
    details: '',
    type: 'Process' as GoalType,
    horizon: 'Weekly' as GoalHorizon,
    targetDate: '',
  });

  useEffect(() => {
    if (!user?.id) {
      setGoals([]);
      return;
    }
    const loaded = loadGoals(user.id);
    setGoals(loaded);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    saveGoals(user.id, goals);
  }, [goals, user?.id]);

  useEffect(() => {
    setProfileWhy(survey.whyJournaling);
    setProfileImprovements(survey.improvementAreas);
    setProfileProfitability(survey.profitabilityStatus);
    setProfileRules(survey.goldenRules.length > 0 ? survey.goldenRules : ['', '', '']);
  }, [survey]);

  const filteredGoals = useMemo(() => {
    return goals
      .filter(goal => statusFilter === 'all' || goal.status === statusFilter)
      .filter(goal => {
        if (!query.trim()) return true;
        const haystack = `${goal.title} ${goal.details} ${goal.type} ${goal.horizon}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [goals, query, statusFilter]);

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter(goal => goal.status === 'completed').length;
    const open = total - completed;
    const averageProgress = total > 0
      ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / total)
      : 0;
    return { total, completed, open, averageProgress };
  }, [goals]);

  const addGoal = () => {
    const title = form.title.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const newGoal: GoalItem = {
      id: crypto.randomUUID(),
      title,
      details: form.details.trim(),
      type: form.type,
      horizon: form.horizon,
      targetDate: form.targetDate,
      progress: 0,
      status: 'open',
      createdAt: now,
    };
    setGoals(current => [newGoal, ...current]);
    setForm(current => ({
      ...current,
      title: '',
      details: '',
      targetDate: '',
    }));
  };

  const updateGoal = (id: string, updater: (goal: GoalItem) => GoalItem) => {
    setGoals(current => current.map(goal => (goal.id === id ? updater(goal) : goal)));
  };

  const toggleCompletion = (id: string) => {
    updateGoal(id, goal => {
      const nextCompleted = goal.status === 'open';
      return {
        ...goal,
        status: nextCompleted ? 'completed' : 'open',
        progress: nextCompleted ? 100 : Math.min(goal.progress, 95),
        completedAt: nextCompleted ? new Date().toISOString() : undefined,
      };
    });
  };

  const deleteGoal = (id: string) => {
    setGoals(current => current.filter(goal => goal.id !== id));
  };

  const toggleProfileImprovement = (option: string) => {
    setProfileSaved(false);
    setProfileImprovements(current => (
      current.includes(option)
        ? current.filter(item => item !== option)
        : [...current, option]
    ));
  };

  const updateProfileRule = (index: number, value: string) => {
    setProfileSaved(false);
    setProfileRules(current => current.map((rule, i) => (i === index ? value : rule)));
  };

  const addProfileRule = () => {
    setProfileSaved(false);
    setProfileRules(current => [...current, '']);
  };

  const saveTradingProfile = () => {
    saveSurvey({
      whyJournaling: profileWhy,
      improvementAreas: profileImprovements,
      profitabilityStatus: profileProfitability,
      goldenRules: profileRules,
    });
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_48%),linear-gradient(180deg,rgba(2,12,24,0.9),rgba(2,6,23,0.8))] p-6">
        <div className="absolute -top-12 right-0 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/80">Goals Tab</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Build your edge with intentional goals</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300/80">
              Set clear targets, track progress, and keep your weekly priorities visible so your journaling turns into action.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:w-[360px]">
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Open</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{stats.open}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Completed</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">{stats.completed}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Goals</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/65 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Avg Progress</p>
              <p className="mt-1 text-2xl font-semibold text-cyan-300">{stats.averageProgress}%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Trading Profile</p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">Your Why, Focus, and Golden Rules</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/onboarding')}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Full survey
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Why are you journaling?</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={profileWhy}
                  onChange={event => {
                    setProfileSaved(false);
                    setProfileWhy(event.target.value);
                  }}
                  placeholder="What is the core reason behind your journal?"
                />
              </div>
              <div>
                <label className="label">Improve areas</label>
                <div className="flex flex-wrap gap-2">
                  {PROFILE_IMPROVEMENT_OPTIONS.map(option => {
                    const selected = profileImprovements.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleProfileImprovement(option)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${
                          selected
                            ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                            : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">Profitability status</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['profitable', 'Profitable'],
                    ['breakeven', 'Breakeven'],
                    ['not_profitable', 'Not profitable'],
                  ] as const).map(([value, label]) => {
                    const active = profileProfitability === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setProfileSaved(false);
                          setProfileProfitability(value);
                        }}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">Golden rules</label>
                <div className="space-y-2">
                  {profileRules.map((rule, index) => (
                    <input
                      key={`profile-rule-${index}`}
                      className="input-field"
                      value={rule}
                      onChange={event => updateProfileRule(index, event.target.value)}
                      placeholder={`Rule ${index + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addProfileRule}
                  className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/90 hover:text-cyan-200"
                >
                  + Add rule
                </button>
              </div>
              <button
                type="button"
                onClick={saveTradingProfile}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/20"
              >
                Save trading profile
              </button>
              {profileSaved && <p className="text-xs text-emerald-300">Trading profile saved.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-5">
            <div className="flex items-center gap-2 text-slate-100">
              <Target size={16} className="text-cyan-300" />
              <h2 className="text-base font-semibold">Add New Goal</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">Write a goal that is specific, measurable, and tied to your process.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Goal title</label>
                <input
                  className="input-field"
                  value={form.title}
                  onChange={e => setForm(current => ({ ...current, title: e.target.value }))}
                  placeholder="Example: No impulsive entries this week"
                />
              </div>
              <div>
                <label className="label">Details</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.details}
                  onChange={e => setForm(current => ({ ...current, details: e.target.value }))}
                  placeholder="Define what success looks like and how you will measure it."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select
                    className="input-field"
                    value={form.type}
                    onChange={e => setForm(current => ({ ...current, type: e.target.value as GoalType }))}
                  >
                    {GOAL_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Horizon</label>
                  <select
                    className="input-field"
                    value={form.horizon}
                    onChange={e => setForm(current => ({ ...current, horizon: e.target.value as GoalHorizon }))}
                  >
                    {GOAL_HORIZONS.map(horizon => (
                      <option key={horizon} value={horizon}>{horizon}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Target date</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.targetDate}
                  onChange={e => setForm(current => ({ ...current, targetDate: e.target.value }))}
                />
              </div>
              <button
                type="button"
                onClick={addGoal}
                disabled={!form.title.trim()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/70 disabled:text-slate-500"
              >
                <Plus size={15} />
                Add Goal
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input-field pl-9"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search goals"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'open', 'completed'] as const).map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                    statusFilter === filter
                      ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredGoals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/55 px-5 py-10 text-center">
                <Sparkles size={20} className="mx-auto text-cyan-300/80" />
                <p className="mt-3 text-sm font-medium text-slate-200">No goals found</p>
                <p className="mt-1 text-xs text-slate-500">Create your first goal to start tracking your progress.</p>
              </div>
            ) : (
              filteredGoals.map(goal => {
                const style = typeStyles(goal.type);
                return (
                  <article key={goal.id} className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4">
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.accent}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${style.badge}`}>
                            {goal.type}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-400">
                            <Flag size={10} />
                            {goal.horizon}
                          </span>
                          {goal.targetDate && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                              <CalendarDays size={10} />
                              {formatDate(goal.targetDate)}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-100">{goal.title}</h3>
                        {goal.details && <p className="mt-1 text-sm leading-relaxed text-slate-400">{goal.details}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCompletion(goal.id)}
                          className={`rounded-lg border p-1.5 transition ${
                            goal.status === 'completed'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}
                          title={goal.status === 'completed' ? 'Mark as open' : 'Mark as completed'}
                        >
                          {goal.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGoal(goal.id)}
                          className="rounded-lg border border-slate-700 p-1.5 text-slate-500 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                          title="Delete goal"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-semibold text-slate-300">{goal.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div className={`h-2 rounded-full transition-all ${style.bar}`} style={{ width: `${goal.progress}%` }} />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={goal.progress}
                        disabled={goal.status === 'completed'}
                        onChange={event => {
                          const nextProgress = clampProgress(Number(event.target.value));
                          updateGoal(goal.id, current => ({
                            ...current,
                            progress: nextProgress,
                            status: nextProgress >= 100 ? 'completed' : 'open',
                            completedAt: nextProgress >= 100 ? new Date().toISOString() : undefined,
                          }));
                        }}
                        className="mt-2 w-full accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
