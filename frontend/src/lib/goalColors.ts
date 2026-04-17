import type { GoalColor } from '../types/goals.js';

export interface GoalColorTokens {
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  categoryBg: string;
  categoryText: string;
  checkBg: string;
}

export const goalColorMap: Record<GoalColor, GoalColorTokens> = {
  cobalt: {
    accent: '#1d6ef5',
    accentBg: 'rgba(29,110,245,0.10)',
    accentBorder: 'rgba(29,110,245,0.20)',
    accentText: '#4d8ef7',
    categoryBg: 'rgba(29,110,245,0.12)',
    categoryText: '#7aacf9',
    checkBg: '#1d6ef5',
  },
  amber: {
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.10)',
    accentBorder: 'rgba(245,158,11,0.20)',
    accentText: '#fbbf24',
    categoryBg: 'rgba(245,158,11,0.12)',
    categoryText: '#fcd34d',
    checkBg: '#d97706',
  },
  teal: {
    accent: '#0d9488',
    accentBg: 'rgba(13,148,136,0.10)',
    accentBorder: 'rgba(13,148,136,0.20)',
    accentText: '#2dd4bf',
    categoryBg: 'rgba(13,148,136,0.12)',
    categoryText: '#5eead4',
    checkBg: '#0d9488',
  },
  purple: {
    accent: '#7c3aed',
    accentBg: 'rgba(124,58,237,0.10)',
    accentBorder: 'rgba(124,58,237,0.20)',
    accentText: '#a78bfa',
    categoryBg: 'rgba(124,58,237,0.12)',
    categoryText: '#c4b5fd',
    checkBg: '#7c3aed',
  },
  rose: {
    accent: '#e11d48',
    accentBg: 'rgba(225,29,72,0.10)',
    accentBorder: 'rgba(225,29,72,0.20)',
    accentText: '#fb7185',
    categoryBg: 'rgba(225,29,72,0.12)',
    categoryText: '#fda4af',
    checkBg: '#e11d48',
  },
};
