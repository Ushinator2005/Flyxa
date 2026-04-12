import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Trophy, Flame, Zap, Crown, Shield, ShieldCheck, Target, Award,
  TrendingUp, CheckCircle, Star, Calendar, CalendarDays, Lock,
  Sparkles,
} from 'lucide-react';
import { useAchievements } from '../hooks/useAchievements.js';
import type { AchievementCategory, AchievementRarity } from '../utils/streaks.js';

// ── icon map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Zap, Flame, Crown, Shield, ShieldCheck, Target, Award, TrendingUp,
  CheckCircle, Star, Calendar, CalendarDays, Trophy,
};

function AchievementIcon({ name, size = 26, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Trophy;
  return <Icon size={size} className={className} />;
}

// ── rarity config ────────────────────────────────────────────────────────────

const RARITY: Record<AchievementRarity, {
  border: string; bg: string; iconColor: string; glow: string; badge: string; label: string;
}> = {
  common: {
    border: 'border-slate-600/60',
    bg: 'bg-slate-800/60',
    iconColor: 'text-slate-300',
    glow: '',
    badge: 'bg-slate-700 text-slate-300',
    label: 'Common',
  },
  rare: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-950/30',
    iconColor: 'text-blue-300',
    glow: 'shadow-[0_0_18px_rgba(59,130,246,0.18)]',
    badge: 'bg-blue-500/20 text-blue-300',
    label: 'Rare',
  },
  epic: {
    border: 'border-purple-500/50',
    bg: 'bg-purple-950/30',
    iconColor: 'text-purple-300',
    glow: 'shadow-[0_0_18px_rgba(168,85,247,0.18)]',
    badge: 'bg-purple-500/20 text-purple-300',
    label: 'Epic',
  },
  legendary: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-950/20',
    iconColor: 'text-amber-300',
    glow: 'shadow-[0_0_22px_rgba(245,158,11,0.22)]',
    badge: 'bg-amber-500/20 text-amber-300',
    label: 'Legendary',
  },
};

// ── streak card ──────────────────────────────────────────────────────────────

function StreakCard({
  label, value, best, icon, color,
}: {
  label: string;
  value: number;
  best: number;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}) {
  const colors = {
    emerald: { num: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: value > 0 ? 'shadow-[0_0_24px_rgba(16,185,129,0.15)]' : '' },
    blue:    { num: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    glow: value > 0 ? 'shadow-[0_0_24px_rgba(59,130,246,0.15)]'  : '' },
    purple:  { num: 'text-purple-300',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  glow: value > 0 ? 'shadow-[0_0_24px_rgba(168,85,247,0.15)]'  : '' },
    amber:   { num: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   glow: value > 0 ? 'shadow-[0_0_24px_rgba(245,158,11,0.15)]'  : '' },
  }[color];

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${colors.border} ${colors.bg} ${colors.glow}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</span>
        <span className={`${colors.num} opacity-70`}>{icon}</span>
      </div>
      <div className={`text-5xl font-bold tracking-tight ${colors.num}`}>
        {value}
      </div>
      <p className="text-xs text-slate-500">
        Best ever: <span className="text-slate-400 font-medium">{best}</span>
      </p>
    </div>
  );
}

// ── achievement badge ────────────────────────────────────────────────────────

function AchievementBadge({ achievement }: {
  achievement: {
    key: string; label: string; description: string; icon: string;
    rarity: string; unlocked: boolean; unlockedAt: string | null;
  };
}) {
  const r = RARITY[achievement.rarity as AchievementRarity] ?? RARITY.common;

  const formattedDate = achievement.unlockedAt
    ? new Date(achievement.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  if (!achievement.unlocked) {
    return (
      <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 flex flex-col items-center text-center gap-3 relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-slate-700/40 flex items-center justify-center">
          <Lock size={22} className="text-slate-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600">{achievement.label}</p>
          <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{achievement.description}</p>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${r.badge} opacity-50`}>
          {r.label}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 flex flex-col items-center text-center gap-3 relative overflow-hidden transition-all ${r.border} ${r.bg} ${r.glow}`}>
      {/* Subtle shimmer top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${r.border} ${r.bg}`}>
        <AchievementIcon name={achievement.icon} size={26} className={r.iconColor} />
      </div>

      <div>
        <p className="text-sm font-bold text-white">{achievement.label}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{achievement.description}</p>
      </div>

      <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${r.badge}`}>
        {r.label}
      </span>

      {formattedDate && (
        <p className="text-[10px] text-slate-600">Unlocked {formattedDate}</p>
      )}
    </div>
  );
}

// ── category labels ──────────────────────────────────────────────────────────

const CATEGORIES: { value: AchievementCategory | 'all'; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'milestone',   label: 'Milestone'   },
  { value: 'streak',      label: 'Streak'      },
  { value: 'discipline',  label: 'Discipline'  },
  { value: 'session',     label: 'Session'     },
  { value: 'consistency', label: 'Consistency' },
];

// ── page ─────────────────────────────────────────────────────────────────────

export default function Achievements() {
  const { stats, achievements, unlockedCount, totalCount, loading } = useAchievements();
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');
  const [showLocked, setShowLocked] = useState(true);

  const filtered = achievements.filter(a => {
    if (category !== 'all' && a.category !== category) return false;
    if (!showLocked && !a.unlocked) return false;
    return true;
  });

  const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy size={28} className="text-amber-400" />
            Streaks & Achievements
          </h1>
          <p className="text-slate-400 text-base mt-1">Track your consistency, discipline, and milestones.</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white">{unlockedCount}<span className="text-slate-500 text-lg font-normal">/{totalCount}</span></p>
          <p className="text-xs text-slate-500 mt-0.5">achievements unlocked</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
            <Sparkles size={11} /> Overall Progress
          </span>
          <span className="text-xs font-semibold text-slate-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Streak cards */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 mb-3">Live Streaks</p>
        {loading ? (
          <div className="h-32 rounded-2xl border border-slate-700/40 bg-slate-800/30 animate-pulse" />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StreakCard
              label="Win Streak"
              value={stats.currentWinStreak}
              best={stats.bestWinStreak}
              icon={<Flame size={18} />}
              color="emerald"
            />
            <StreakCard
              label="Best Win Streak"
              value={stats.bestWinStreak}
              best={stats.bestWinStreak}
              icon={<Zap size={18} />}
              color="blue"
            />
            <StreakCard
              label="Discipline Streak"
              value={stats.currentDisciplineStreak}
              best={stats.bestDisciplineStreak}
              icon={<ShieldCheck size={18} />}
              color="purple"
            />
            <StreakCard
              label="Green Day Streak"
              value={stats.currentGreenDayStreak}
              best={stats.bestGreenDayStreak}
              icon={<TrendingUp size={18} />}
              color="amber"
            />
          </div>
        )}
      </div>

      {/* Achievements */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  category === c.value
                    ? 'bg-blue-600/30 border border-blue-500/40 text-blue-300'
                    : 'bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Show locked toggle */}
          <button
            onClick={() => setShowLocked(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showLocked
                ? 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-slate-300'
                : 'bg-slate-700/60 border-slate-600 text-slate-200'
            }`}
          >
            {showLocked ? 'Hide Locked' : 'Show Locked'}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 py-16 text-center">
            <Trophy size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No achievements in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* Unlocked first, then locked */}
            {[...filtered.filter(a => a.unlocked), ...filtered.filter(a => !a.unlocked)].map(a => (
              <AchievementBadge key={a.key} achievement={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
