import type { Rival } from '../types/rivals.js';
import { getMascotXP } from '../lib/mascotProgression.js';

const me: Rival = {
  id: 'me',
  username: 'you',
  displayName: 'Alex Chen',
  avatarInitials: 'AC',
  avatarColor: '#1d6ef5',
  isMe: true,
  mascot: {
    stage: 'veteran',
    name: 'The Iron Bull',
    streakDays: 45,
    stats: { discipline: 72, psychology: 65, consistency: 78, backtestHours: 24 },
    xp: 0,
  },
};
me.mascot.xp = getMascotXP(me.mascot.streakDays, me.mascot.stats);

const maya: Rival = {
  id: 'rival-1',
  username: 'mayaross',
  displayName: 'Maya Ross',
  avatarInitials: 'MR',
  avatarColor: '#e11d48',
  mascot: {
    stage: 'elite',
    name: 'Storm Breaker',
    streakDays: 63,
    stats: { discipline: 88, psychology: 82, consistency: 85, backtestHours: 48 },
    xp: 0,
  },
};
maya.mascot.xp = getMascotXP(maya.mascot.streakDays, maya.mascot.stats);

const jake: Rival = {
  id: 'rival-2',
  username: 'jakekim',
  displayName: 'Jake Kim',
  avatarInitials: 'JK',
  avatarColor: '#f59e0b',
  mascot: {
    stage: 'veteran',
    name: 'Golden Horn',
    streakDays: 34,
    stats: { discipline: 70, psychology: 73, consistency: 68, backtestHours: 18 },
    xp: 0,
  },
};
jake.mascot.xp = getMascotXP(jake.mascot.streakDays, jake.mascot.stats);

const tyler: Rival = {
  id: 'rival-3',
  username: 'tylerng',
  displayName: 'Tyler Ng',
  avatarInitials: 'TN',
  avatarColor: '#0d9488',
  mascot: {
    stage: 'rookie',
    name: 'Rising Calf',
    streakDays: 12,
    stats: { discipline: 45, psychology: 50, consistency: 42, backtestHours: 8 },
    xp: 0,
  },
};
tyler.mascot.xp = getMascotXP(tyler.mascot.streakDays, tyler.mascot.stats);

export const mockRivals: Rival[] = [me, maya, jake, tyler];
