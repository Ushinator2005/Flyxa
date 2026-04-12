import { Trade } from '../types/index.js';

export interface StreakStats {
  currentWinStreak: number;
  bestWinStreak: number;
  currentLossStreak: number;
  worstLossStreak: number;
  currentDisciplineStreak: number;
  bestDisciplineStreak: number;
  currentGreenDayStreak: number;
  bestGreenDayStreak: number;
  maxConsecutiveTradingDays: number;
}

export type AchievementCategory = 'milestone' | 'streak' | 'discipline' | 'session' | 'consistency';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  check: (stats: StreakStats, trades: Trade[]) => boolean;
}

function sorted(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const da = `${a.trade_date}T${a.trade_time ?? '00:00'}`;
    const db = `${b.trade_date}T${b.trade_time ?? '00:00'}`;
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

function hasPerfectSession(trades: Trade[]): boolean {
  const byDate = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!byDate.has(t.trade_date)) byDate.set(t.trade_date, []);
    byDate.get(t.trade_date)!.push(t);
  }
  for (const dayTrades of byDate.values()) {
    if (dayTrades.length >= 3 && dayTrades.every(t => t.exit_reason === 'TP')) return true;
  }
  return false;
}

function maxConsecutiveDays(trades: Trade[]): number {
  const dates = Array.from(new Set(trades.map(t => t.trade_date))).sort();
  if (dates.length === 0) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round(
      (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86_400_000
    );
    if (diff <= 3) { current++; best = Math.max(best, current); }
    else current = 1;
  }
  return best;
}

export function computeStreaks(trades: Trade[]): StreakStats {
  const s = sorted(trades);

  // Current win/loss streak (scan backwards until streak breaks)
  let currentWinStreak = 0, currentLossStreak = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const pnl = s[i].pnl;
    if (currentWinStreak === 0 && currentLossStreak === 0) {
      if (pnl > 0) currentWinStreak = 1;
      else if (pnl < 0) currentLossStreak = 1;
      else break;
    } else if (currentWinStreak > 0) {
      if (pnl > 0) currentWinStreak++; else break;
    } else {
      if (pnl < 0) currentLossStreak++; else break;
    }
  }

  // Best win / worst loss streaks (full scan)
  let bestWinStreak = 0, worstLossStreak = 0, tw = 0, tl = 0;
  for (const t of s) {
    if (t.pnl > 0)      { tw++; tl = 0; bestWinStreak  = Math.max(bestWinStreak,  tw); }
    else if (t.pnl < 0) { tl++; tw = 0; worstLossStreak = Math.max(worstLossStreak, tl); }
    else                 { tw = 0; tl = 0; }
  }

  // Discipline (followed_plan)
  let currentDisciplineStreak = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i].followed_plan) currentDisciplineStreak++; else break;
  }
  let bestDisciplineStreak = 0, td = 0;
  for (const t of s) {
    if (t.followed_plan) { td++; bestDisciplineStreak = Math.max(bestDisciplineStreak, td); }
    else td = 0;
  }

  // Green day streak (net PnL per calendar date)
  const byDate = new Map<string, number>();
  for (const t of s) byDate.set(t.trade_date, (byDate.get(t.trade_date) ?? 0) + t.pnl);
  const dates = Array.from(byDate.keys()).sort();

  let currentGreenDayStreak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if ((byDate.get(dates[i]) ?? 0) > 0) currentGreenDayStreak++; else break;
  }
  let bestGreenDayStreak = 0, tg = 0;
  for (const d of dates) {
    if ((byDate.get(d) ?? 0) > 0) { tg++; bestGreenDayStreak = Math.max(bestGreenDayStreak, tg); }
    else tg = 0;
  }

  return {
    currentWinStreak,
    bestWinStreak,
    currentLossStreak,
    worstLossStreak,
    currentDisciplineStreak,
    bestDisciplineStreak,
    currentGreenDayStreak,
    bestGreenDayStreak,
    maxConsecutiveTradingDays: maxConsecutiveDays(trades),
  };
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Milestone ────────────────────────────────────────────────────────────
  { key: 'first_trade',  label: 'First Trade',     description: 'Log your first trade',    icon: 'Zap',        category: 'milestone', rarity: 'common',    check: (_, t) => t.length >= 1   },
  { key: 'trades_10',    label: 'Getting Started',  description: 'Log 10 trades',           icon: 'TrendingUp', category: 'milestone', rarity: 'common',    check: (_, t) => t.length >= 10  },
  { key: 'trades_50',    label: 'Committed',        description: 'Log 50 trades',           icon: 'Target',     category: 'milestone', rarity: 'common',    check: (_, t) => t.length >= 50  },
  { key: 'trades_100',   label: 'Century',          description: 'Log 100 trades',          icon: 'Award',      category: 'milestone', rarity: 'rare',      check: (_, t) => t.length >= 100 },
  { key: 'trades_250',   label: 'Veteran',          description: 'Log 250 trades',          icon: 'Shield',     category: 'milestone', rarity: 'epic',      check: (_, t) => t.length >= 250 },
  { key: 'trades_500',   label: 'Elite',            description: 'Log 500 trades',          icon: 'Crown',      category: 'milestone', rarity: 'legendary', check: (_, t) => t.length >= 500 },

  // ── Streak ───────────────────────────────────────────────────────────────
  { key: 'win_streak_3',  label: 'On Fire',        description: '3 wins in a row',         icon: 'Flame',  category: 'streak', rarity: 'common',    check: s => s.bestWinStreak >= 3  },
  { key: 'win_streak_5',  label: 'Hot Streak',     description: '5 wins in a row',         icon: 'Flame',  category: 'streak', rarity: 'rare',      check: s => s.bestWinStreak >= 5  },
  { key: 'win_streak_10', label: 'Unstoppable',    description: '10 wins in a row',        icon: 'Zap',    category: 'streak', rarity: 'epic',      check: s => s.bestWinStreak >= 10 },
  { key: 'win_streak_20', label: 'Legendary Run',  description: '20 wins in a row',        icon: 'Crown',  category: 'streak', rarity: 'legendary', check: s => s.bestWinStreak >= 20 },

  // ── Discipline ────────────────────────────────────────────────────────────
  { key: 'plan_5',  label: 'Rule Follower',      description: '5 plan-compliant trades in a row',  icon: 'CheckCircle', category: 'discipline', rarity: 'common',    check: s => s.bestDisciplineStreak >= 5  },
  { key: 'plan_10', label: 'Ironclad',           description: '10 plan-compliant trades in a row', icon: 'ShieldCheck', category: 'discipline', rarity: 'rare',      check: s => s.bestDisciplineStreak >= 10 },
  { key: 'plan_25', label: 'Master of Process',  description: '25 plan-compliant trades in a row', icon: 'Trophy',      category: 'discipline', rarity: 'legendary', check: s => s.bestDisciplineStreak >= 25 },

  // ── Session ───────────────────────────────────────────────────────────────
  { key: 'perfect_session', label: 'Perfect Session', description: 'All trades hit TP in a single day (3+ trades)', icon: 'Star',        category: 'session', rarity: 'rare', check: (_, t) => hasPerfectSession(t) },
  { key: 'green_days_5',    label: 'Green Week',      description: '5 consecutive green trading days',               icon: 'TrendingUp',  category: 'session', rarity: 'rare', check: s => s.bestGreenDayStreak >= 5  },
  { key: 'green_days_10',   label: 'Green Fortnight', description: '10 consecutive green trading days',              icon: 'TrendingUp',  category: 'session', rarity: 'epic', check: s => s.bestGreenDayStreak >= 10 },

  // ── Consistency ───────────────────────────────────────────────────────────
  { key: 'journal_7',  label: 'Showing Up', description: 'Trade on 7 consecutive days',  icon: 'Calendar',    category: 'consistency', rarity: 'common',    check: s => s.maxConsecutiveTradingDays >= 7  },
  { key: 'journal_30', label: 'Devoted',    description: 'Trade on 30 consecutive days', icon: 'CalendarDays', category: 'consistency', rarity: 'legendary', check: s => s.maxConsecutiveTradingDays >= 30 },
];

export function computeUnlockedKeys(trades: Trade[]): Set<string> {
  const stats = computeStreaks(trades);
  return new Set(
    ACHIEVEMENT_DEFS.filter(def => def.check(stats, trades)).map(def => def.key)
  );
}
