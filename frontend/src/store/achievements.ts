import type { Achievement, BillingAccount, JournalEntry, Trade } from './types.js';

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_trade',
    title: 'First Blood',
    description: 'Log your first trade',
    icon: 'target',
    condition: 'trades >= 1',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'first_win',
    title: 'On the Board',
    description: 'Record your first winning trade',
    icon: 'check',
    condition: 'wins >= 1',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'streak_5',
    title: 'On a Roll',
    description: '5 consecutive winning days',
    icon: 'flame',
    condition: 'winStreak >= 5',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'streak_3',
    title: 'Momentum',
    description: '3 consecutive winning days',
    icon: 'flame',
    condition: 'winStreak >= 3',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'streak_10',
    title: 'Locked In',
    description: '10 consecutive winning days',
    icon: 'bolt',
    condition: 'winStreak >= 10',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'streak_15',
    title: 'Relentless',
    description: '15 consecutive winning days',
    icon: 'crown',
    condition: 'winStreak >= 15',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'streak_30',
    title: 'The Grind',
    description: '30 consecutive journal entries',
    icon: 'journal',
    condition: 'journalStreak >= 30',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'rr_master',
    title: 'R:R Disciplined',
    description: '20 trades all with R:R >= 2.0',
    icon: 'ruler',
    condition: 'tradesAbove2R >= 20',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'rr_master_50',
    title: 'R:R Specialist',
    description: '50 trades with R:R >= 2.0',
    icon: 'ruler',
    condition: 'tradesAbove2R >= 50',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'first_1k',
    title: 'First Grand',
    description: 'Reach $1,000 total profit',
    icon: 'cash',
    condition: 'totalPnL >= 1000',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'first_10k',
    title: 'Five Figures',
    description: 'Reach $10,000 total profit',
    icon: 'gem',
    condition: 'totalPnL >= 10000',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'first_2500',
    title: 'Quarter Way',
    description: 'Reach $2,500 total profit',
    icon: 'cash',
    condition: 'totalPnL >= 2500',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'first_25k',
    title: 'Twenty-Five K',
    description: 'Reach $25,000 total profit',
    icon: 'gem',
    condition: 'totalPnL >= 25000',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'no_revenge',
    title: 'Ice Cold',
    description: '30 trades with no revenge trading emotion tag',
    icon: 'snow',
    condition: 'cleanTrades >= 30',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'no_revenge_60',
    title: 'Emotionless Edge',
    description: '60 trades with no revenge trading emotion tag',
    icon: 'snow',
    condition: 'cleanTrades >= 60',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'plan_follower',
    title: 'By the Book',
    description: 'Follow your trading plan for 10 consecutive trades',
    icon: 'clipboard',
    condition: 'followedPlanStreak >= 10',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'plan_follower_25',
    title: 'Process Over Outcome',
    description: 'Follow your trading plan for 25 consecutive trades',
    icon: 'clipboard',
    condition: 'followedPlanStreak >= 25',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'rules_perfect',
    title: 'Rule Keeper',
    description: 'Complete rule checklist 100% for 7 straight days',
    icon: 'checklist',
    condition: 'perfectRuleDays >= 7',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'rules_perfect_14',
    title: 'Rule Guardian',
    description: 'Complete rule checklist 100% for 14 straight days',
    icon: 'checklist',
    condition: 'perfectRuleDays >= 14',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'a_plus_day',
    title: 'A-Game',
    description: 'Achieve an A+ grade day',
    icon: 'star',
    condition: 'aPlusDays >= 1',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'a_grade_10',
    title: 'Professional Standard',
    description: 'Achieve 10 A or A+ grade days',
    icon: 'star',
    condition: 'aGradeDays >= 10',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'green_days_20',
    title: 'Green Machine',
    description: 'Finish 20 green days',
    icon: 'check',
    condition: 'greenDays >= 20',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'psych_discipline_20',
    title: 'Mental Discipline',
    description: 'Record 20 days with discipline score >= 4',
    icon: 'shield',
    condition: 'disciplineStrongDays >= 20',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'psych_balance_10',
    title: 'Composed Trader',
    description: 'Record 10 days with average psychology score >= 4',
    icon: 'target',
    condition: 'psychStrongDays >= 10',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'execution_20',
    title: 'Execution Focus',
    description: 'Record 20 days with execution score >= 4',
    icon: 'check',
    condition: 'executionStrongDays >= 20',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'funded',
    title: 'Funded',
    description: 'Pass your first prop firm evaluation',
    icon: 'trophy',
    condition: 'fundedAccounts >= 1',
    unlockedAt: null,
    progress: 0,
  },
  {
    id: 'journaled_50',
    title: 'Committed',
    description: 'Write 50 journal entries',
    icon: 'pen',
    condition: 'journalEntries >= 50',
    unlockedAt: null,
    progress: 0,
  },
];

export function mergeAchievementCatalog(existing: Achievement[]): Achievement[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  return DEFAULT_ACHIEVEMENTS.map((base) => {
    const prior = byId.get(base.id);
    if (!prior) return { ...base };
    return {
      ...base,
      unlockedAt: prior.unlockedAt ?? null,
      progress: Number.isFinite(prior.progress) ? prior.progress : 0,
    };
  });
}

export interface AchievementRefreshResult {
  next: Achievement[];
  newlyUnlocked: Achievement[];
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function computeFollowedPlanStreak(trades: Trade[]): number {
  const ordered = [...trades].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  let best = 0;
  let current = 0;
  for (const trade of ordered) {
    if (trade.reflection?.followedPlan === true) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export function computeJournalStreak(entries: JournalEntry[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateSet = new Set(entries.map(entry => entry.date));
  let streak = 0;
  for (let i = 0; i < 366; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = isoDate(d);
    if (!dateSet.has(iso)) break;
    streak += 1;
  }
  return streak;
}

export function computeWinStreakDays(entries: JournalEntry[]): number {
  const ordered = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const entry of ordered) {
    if (entry.trades.length === 0) break;
    const hasLoss = entry.trades.some(trade => trade.result === 'loss');
    if (hasLoss) break;
    streak += 1;
  }
  return streak;
}

function buildValueMap(trades: Trade[], entries: JournalEntry[], billingAccounts: BillingAccount[]): Record<string, number> {
  const wins = trades.filter(trade => trade.result === 'win');
  const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const winStreak = computeWinStreakDays(entries);
  const journalStreak = computeJournalStreak(entries);
  const greenDays = entries.filter((entry) => entry.trades.reduce((sum, trade) => sum + trade.pnl, 0) > 0).length;
  const aGradeDays = entries.filter((entry) => entry.grade === 'A' || entry.grade === 'A+').length;
  const disciplineStrongDays = entries.filter((entry) => entry.psychology.discipline >= 4).length;
  const executionStrongDays = entries.filter((entry) => entry.psychology.execution >= 4).length;
  const psychStrongDays = entries.filter((entry) => {
    const avg = (entry.psychology.setupQuality + entry.psychology.discipline + entry.psychology.execution) / 3;
    return avg >= 4;
  }).length;

  return {
    trades: trades.length,
    wins: wins.length,
    winStreak,
    journalStreak,
    journalEntries: entries.length,
    totalPnL,
    tradesAbove2R: trades.filter(trade => trade.rr >= 2.0).length,
    cleanTrades: trades.filter(trade => {
      const entry = entries.find(candidate => candidate.date === trade.date);
      return !entry?.emotions.some(emotion => emotion.label === 'Revenge trading' && emotion.state !== 'neutral');
    }).length,
    followedPlanStreak: computeFollowedPlanStreak(trades),
    perfectRuleDays: entries.filter(entry => entry.rules.length > 0 && entry.rules.every(rule => rule.state === 'ok')).length,
    aPlusDays: entries.filter(entry => entry.grade === 'A+').length,
    aGradeDays,
    greenDays,
    disciplineStrongDays,
    executionStrongDays,
    psychStrongDays,
    fundedAccounts: billingAccounts.filter(account => account.status === 'Passed').length,
  };
}

export function computeAchievementProgress(
  achievement: Achievement,
  trades: Trade[],
  entries: JournalEntry[],
  billingAccounts: BillingAccount[]
): Achievement {
  const values = buildValueMap(trades, entries, billingAccounts);
  const [key, op, val] = achievement.condition.split(' ');
  const current = values[key] ?? 0;
  const target = Number.parseFloat(val);
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const progress = Math.max(0, Math.min(100, (current / safeTarget) * 100));
  const isUnlocked = op === '>=' ? current >= safeTarget : current > safeTarget;

  return {
    ...achievement,
    progress,
    unlockedAt: isUnlocked && !achievement.unlockedAt
      ? new Date().toISOString()
      : achievement.unlockedAt,
  };
}

export function refreshAchievements(
  achievements: Achievement[],
  trades: Trade[],
  entries: JournalEntry[],
  billingAccounts: BillingAccount[]
): AchievementRefreshResult {
  const next = achievements.map(achievement => computeAchievementProgress(achievement, trades, entries, billingAccounts));
  const newlyUnlocked = next.filter(updated => {
    const previous = achievements.find(item => item.id === updated.id);
    return Boolean(updated.unlockedAt && !previous?.unlockedAt);
  });
  return { next, newlyUnlocked };
}
