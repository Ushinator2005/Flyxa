import type { LeaderboardMetric, MascotStage, MascotStats, Rival } from '../types/rivals.js';

const STAGE_THRESHOLDS: Record<MascotStage, number> = {
  seed: 0,
  rookie: 7,
  veteran: 30,
  elite: 90,
  apex: 180,
};

const STAGE_ORDER: MascotStage[] = ['seed', 'rookie', 'veteran', 'elite', 'apex'];

export function getMascotStage(streakDays: number): MascotStage {
  if (streakDays >= 180) return 'apex';
  if (streakDays >= 90) return 'elite';
  if (streakDays >= 30) return 'veteran';
  if (streakDays >= 7) return 'rookie';
  return 'seed';
}

export function getMascotXP(streakDays: number, stats: MascotStats): number {
  return (
    streakDays * 2 +
    stats.discipline +
    stats.psychology +
    stats.consistency +
    stats.backtestHours * 0.5
  );
}

export function getMascotLabel(stage: MascotStage): string {
  switch (stage) {
    case 'seed': return '🥚 Seed';
    case 'rookie': return '🐣 Rookie';
    case 'veteran': return '🐂 Veteran';
    case 'elite': return '⚡ Elite';
    case 'apex': return '👑 Apex';
  }
}

export function getStageProgress(streakDays: number): {
  current: MascotStage;
  next: MascotStage | null;
  progressPct: number;
} {
  const current = getMascotStage(streakDays);
  const currentIdx = STAGE_ORDER.indexOf(current);
  const next = currentIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIdx + 1] : null;

  if (!next) return { current, next: null, progressPct: 100 };

  const currentThreshold = STAGE_THRESHOLDS[current];
  const nextThreshold = STAGE_THRESHOLDS[next];
  const progressPct = Math.round(
    ((streakDays - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
  );
  return { current, next, progressPct: Math.min(100, Math.max(0, progressPct)) };
}

export function compareMetric(mine: number, theirs: number): 'winning' | 'losing' | 'tied' {
  if (Math.abs(mine - theirs) <= 2) return 'tied';
  return mine > theirs ? 'winning' : 'losing';
}

export function getMascotHealth(
  streakDays: number,
  lastJournalDate: string,
): 'healthy' | 'tired' | 'sick' | 'critical' {
  if (streakDays === 0) return 'critical';
  const last = new Date(`${lastJournalDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) return 'healthy';
  if (diffDays === 2) return 'tired';
  if (diffDays === 3) return 'sick';
  return 'critical';
}

export function getRivalMetricValue(rival: Rival, metric: LeaderboardMetric): number {
  switch (metric) {
    case 'streak': return rival.mascot.streakDays;
    case 'discipline': return rival.mascot.stats.discipline;
    case 'psychology': return rival.mascot.stats.psychology;
    case 'consistency': return rival.mascot.stats.consistency;
    case 'backtest': return rival.mascot.stats.backtestHours;
  }
}
