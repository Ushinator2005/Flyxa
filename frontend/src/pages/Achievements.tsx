import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Trophy,
  Flame,
  Zap,
  Crown,
  Shield,
  ShieldCheck,
  Target,
  Award,
  TrendingUp,
  CheckCircle,
  Star,
  Calendar,
  CalendarDays,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAchievements } from '../hooks/useAchievements.js';
import type { Achievement as AchievementItem } from '../hooks/useAchievements.js';
import type { AchievementCategory, AchievementRarity } from '../utils/streaks.js';
import './Achievements.css';

const ICON_MAP: Record<string, LucideIcon> = {
  Zap,
  Flame,
  Crown,
  Shield,
  ShieldCheck,
  Target,
  Award,
  TrendingUp,
  CheckCircle,
  Star,
  Calendar,
  CalendarDays,
  Trophy,
};

const CATEGORIES: Array<{ value: AchievementCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'streak', label: 'Streak' },
  { value: 'discipline', label: 'Discipline' },
  { value: 'session', label: 'Session' },
  { value: 'consistency', label: 'Consistency' },
];

type Tone = 'green' | 'blue' | 'purple' | 'amber';
type RarityClass = 'common' | 'rare' | 'epic' | 'legendary';

function AchievementIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Trophy;
  return <Icon size={size} strokeWidth={1.8} />;
}

function formatUnlockedDate(unlockedAt?: string | null): string | null {
  if (!unlockedAt) return null;
  return new Date(unlockedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRarityClass(rarity?: AchievementRarity): RarityClass {
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') return rarity;
  return 'common';
}

function StreakCard({
  label,
  value,
  best,
  icon,
  tone,
}: {
  label: string;
  value: number;
  best: number;
  icon: ReactNode;
  tone: Tone;
}) {
  return (
    <article className={`achv-streak-card achv-tone-${tone}`}>
      <header className="achv-streak-head">
        <span className="achv-streak-label">{label}</span>
        <span className="achv-streak-icon">{icon}</span>
      </header>
      <p className="achv-streak-value">{value}</p>
      <p className="achv-streak-meta">
        Best ever: <span>{best}</span>
      </p>
    </article>
  );
}

function AchievementBadge({ achievement }: { achievement: AchievementItem }) {
  const rarityClass = getRarityClass(achievement.rarity as AchievementRarity);
  const unlockedDate = formatUnlockedDate(achievement.unlockedAt);

  if (!achievement.unlocked) {
    return (
      <article className="achv-badge achv-badge-locked">
        <div className="achv-badge-icon-wrap">
          <Lock size={18} />
        </div>
        <h3 className="achv-badge-title">{achievement.label}</h3>
        <p className="achv-badge-desc">{achievement.description}</p>
      </article>
    );
  }

  return (
    <article className={`achv-badge achv-rarity-${rarityClass}`}>
      <div className="achv-badge-icon-wrap">
        <AchievementIcon name={achievement.icon} />
      </div>
      <h3 className="achv-badge-title">{achievement.label}</h3>
      <p className="achv-badge-desc">{achievement.description}</p>
      <footer className="achv-badge-foot">
        <span className="achv-rarity-pill">{rarityClass}</span>
        {unlockedDate ? <span className="achv-unlocked-date">Unlocked {unlockedDate}</span> : null}
      </footer>
    </article>
  );
}

export default function Achievements() {
  const { stats, achievements, unlockedCount, totalCount, loading } = useAchievements();
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');
  const [showLocked, setShowLocked] = useState(true);

  const visibleAchievements = useMemo(() => {
    const filtered = achievements.filter(achievement => {
      if (category !== 'all' && achievement.category !== category) return false;
      if (!showLocked && !achievement.unlocked) return false;
      return true;
    });

    return [
      ...filtered.filter(achievement => achievement.unlocked),
      ...filtered.filter(achievement => !achievement.unlocked),
    ];
  }, [achievements, category, showLocked]);

  const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;
  const progressLabel = `${Math.round(progress)}%`;

  return (
    <div className="achv-page animate-fade-in">
      <header className="achv-header">
        <div>
          <h1 className="achv-title">
            <Trophy size={26} />
            Streaks &amp; Achievements
          </h1>
          <p className="achv-subtitle">
            Track your consistency, discipline, and milestones.
          </p>
        </div>
        <div className="achv-count">
          <p className="achv-count-value">
            {unlockedCount}
            <span>/{totalCount}</span>
          </p>
          <p className="achv-count-label">Achievements unlocked</p>
        </div>
      </header>

      <section className="achv-progress-card" aria-label="Overall progress">
        <div className="achv-progress-head">
          <span>
            <Sparkles size={12} />
            Overall Progress
          </span>
          <strong>{progressLabel}</strong>
        </div>
        <div className="achv-progress-track">
          <div className="achv-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="achv-section">
        <h2 className="achv-section-title">Live Streaks</h2>
        {loading ? (
          <div className="achv-streak-grid achv-streak-grid-loading">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="achv-skeleton" />
            ))}
          </div>
        ) : (
          <div className="achv-streak-grid">
            <StreakCard
              label="Win Streak"
              value={stats.currentWinStreak}
              best={stats.bestWinStreak}
              icon={<Flame size={14} />}
              tone="green"
            />
            <StreakCard
              label="Best Win Streak"
              value={stats.bestWinStreak}
              best={stats.bestWinStreak}
              icon={<Zap size={14} />}
              tone="blue"
            />
            <StreakCard
              label="Discipline Streak"
              value={stats.currentDisciplineStreak}
              best={stats.bestDisciplineStreak}
              icon={<ShieldCheck size={14} />}
              tone="purple"
            />
            <StreakCard
              label="Green Day Streak"
              value={stats.currentGreenDayStreak}
              best={stats.bestGreenDayStreak}
              icon={<TrendingUp size={14} />}
              tone="amber"
            />
          </div>
        )}
      </section>

      <section className="achv-section">
        <div className="achv-toolbar">
          <div className="achv-filters">
            {CATEGORIES.map(option => (
              <button
                key={option.value}
                type="button"
                className={`achv-chip ${category === option.value ? 'is-active' : ''}`}
                onClick={() => setCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="achv-chip"
            onClick={() => setShowLocked(value => !value)}
          >
            {showLocked ? 'Hide Locked' : 'Show Locked'}
          </button>
        </div>

        {loading ? (
          <div className="achv-grid">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="achv-skeleton achv-skeleton-badge" />
            ))}
          </div>
        ) : visibleAchievements.length === 0 ? (
          <div className="achv-empty">
            <Trophy size={28} />
            <p>No achievements in this category yet.</p>
          </div>
        ) : (
          <div className="achv-grid">
            {visibleAchievements.map(achievement => (
              <AchievementBadge key={achievement.key} achievement={achievement} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
