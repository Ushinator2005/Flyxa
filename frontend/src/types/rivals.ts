export type MascotStage = 'seed' | 'rookie' | 'veteran' | 'elite' | 'apex';

export interface MascotStats {
  discipline: number;
  psychology: number;
  consistency: number;
  backtestHours: number;
}

export interface Mascot {
  stage: MascotStage;
  name: string;
  streakDays: number;
  stats: MascotStats;
  xp: number;
}

export interface Rival {
  id: string;
  username: string;
  displayName: string;
  avatarInitials: string;
  avatarColor: string;
  mascot: Mascot;
  isMe?: boolean;
}

export type LeaderboardMetric = 'streak' | 'discipline' | 'psychology' | 'consistency' | 'backtest';
