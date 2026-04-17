export type GoalColor = 'cobalt' | 'amber' | 'teal' | 'purple' | 'rose';

export type GoalCategory = 'Profitability' | 'Risk' | 'Mindset' | 'Consistency' | 'Discipline';

export interface GoalStep {
  id: string;
  text: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  color: GoalColor;
  horizon: string;
  description: string;
  steps: GoalStep[];
  createdAt: string;
}
