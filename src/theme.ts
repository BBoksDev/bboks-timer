import type { PhaseType } from './model';

export const C = {
  bg: '#111318',
  card: '#1b1e26',
  card2: '#262a35',
  line: '#2f3441',
  text: '#f2f3f7',
  muted: '#9097a8',
  ink: '#111318',
  accent: '#ff4d5e',
};

export const PHASE_COLOR: Record<PhaseType, string> = {
  prepare: '#ffb020',
  work: '#ff4d5e',
  rest: '#19c3a6',
  cyclerest: '#4c8dff',
  cooldown: '#9b6bff',
};
