export type TradeDirection = 'LONG' | 'SHORT';
export type TradeResult = 'win' | 'loss' | 'open';
export type RuleState = 'ok' | 'fail' | 'unchecked';
export type EmotionState = 'neutral' | 'green' | 'amber' | 'red';

export interface TradeReflection {
  thesis: string;
  execution: string;
  adjustment: string;
  processGrade: number;
  followedPlan: boolean | null;
}

export interface Trade {
  id: string;
  entryId: string;
  date: string;
  symbol: string;
  direction: TradeDirection;
  entry: number;
  sl: number;
  tp: number;
  exit: number | null;
  contracts: number;
  rr: number;
  pnl: number;
  result: TradeResult;
  time: string;
  exitTime: string | null;
  duration: number | null;
  screenshots: string[];
  scannedImageUrl: string | null;
  reflection: TradeReflection;
  account: string;
  createdAt: string;
}

export interface JournalEntryReflection {
  pre: string;
  post: string;
  lessons: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  trades: Trade[];
  screenshots: string[];
  reflection: JournalEntryReflection;
  rules: Array<{ text: string; state: RuleState }>;
  psychology: {
    setupQuality: number;
    discipline: number;
    execution: number;
  };
  emotions: Array<{ label: string; state: EmotionState }>;
  grade: string;
  account: string;
  scannedImageUrl?: string;
}

export interface Account {
  id: string;
  name: string;
  firm: string;
  size: number;
  type: 'live' | 'eval' | 'paper';
  phase: 'eval' | 'funded';
  balance: number;
  dailyLossLimit: number;
  maxDrawdown: number;
  profitTarget: number | null;
  startingBalance: number;
  isActive: boolean;
  color?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  progress: number;
  condition: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  color: string;
  horizon: string;
  description: string;
  steps: Array<{ id: string; text: string; done: boolean }>;
  status?: 'Active' | 'Paused' | 'Achieved';
  createdAt: string;
  type?: 'financial' | 'discipline' | 'consistency' | 'trade_count' | 'funded';
  target?: number;
}

export interface Setup {
  id: string;
  name: string;
  description: string;
  rank: 'A+' | 'A' | 'B';
  timeframe: string;
  market: string;
  avgRR: string;
  confluences: string[];
  isExpanded?: boolean;
}

export interface RiskRule {
  id: string;
  label: string;
  value: string;
  unit: string;
  color?: 'amber' | 'red' | 'green' | 'cobalt' | 'neutral';
}

export interface ChecklistItem {
  id: string;
  text: string;
  done?: boolean;
}

export interface PlanBlock {
  id: string;
  name: string;
  hint: string;
  content: string;
  isOpen?: boolean;
}

export interface PropFirm {
  id: string;
  name: string;
  params: Array<{ id: string; label: string; value: string }>;
}

export type BillingAccountStatus = 'Active' | 'Passed' | 'Blown' | 'Reset';

export interface BillingAccount {
  id: string;
  firm: string;
  size: string;
  listPrice: number;
  discountCode: string;
  discountPct: number;
  actualPrice: number;
  purchaseDate: string;
  status: BillingAccountStatus;
  payoutReceived: number;
  roi?: number;
}

export interface ScannerColors {
  entry: string;
  stopLoss: string;
  takeProfit: string;
}
