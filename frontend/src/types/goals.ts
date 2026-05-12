export type GoalColor = 'cobalt' | 'amber' | 'teal' | 'purple' | 'rose';

export type GoalCategory =
  | 'Profitability' | 'Risk' | 'Mindset' | 'Consistency' | 'Discipline'
  | 'financial' | 'discipline' | 'lifestyle' | 'skill';

export interface GoalStep {
  id: string;
  text: string;
  done: boolean;
}

export type GoalMilestone = GoalStep;

export type GoalStatus = 'Active' | 'Paused' | 'Achieved' | 'active' | 'paused' | 'achieved';

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  color: GoalColor;
  horizon: string;
  description: string;
  steps: GoalStep[];
  status?: GoalStatus;
  createdAt: string;
  // Extended fields for new Goals page
  icon?: string;
  targetValue?: number;
  targetUnit?: string;
  currentValue?: number;
  targetDate?: string;
  achievedAt?: string;
  target?: number;
}

export type GoalInput = Omit<Goal, 'id' | 'createdAt'>;
