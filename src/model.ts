export type Workout = {
  id: string;
  name: string;
  prepare: number; // seconds
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
  cycleRest: number;
  cooldown: number;
};

export type PhaseType = 'prepare' | 'work' | 'rest' | 'cyclerest' | 'cooldown';

export type Interval = { type: PhaseType; dur: number; round: number; cycle: number };

export type LogEntry = {
  id: string;
  workoutId: string;
  name: string;
  at: number; // start timestamp (ms)
  secs: number; // active seconds
  rounds: number; // work intervals completed
  totalRounds: number;
  complete: boolean;
};

export type Settings = {
  sound: boolean;
  voice: boolean;
  haptics: boolean;
  keepAwake: boolean;
  countdown: number; // beep for the last N seconds of an interval
  backgroundAlerts: boolean; // notifications when the app is in the background
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  voice: true,
  haptics: true,
  keepAwake: true,
  countdown: 3,
  backgroundAlerts: true,
};

export const DEFAULT_WORKOUTS: Workout[] = [
  { id: 'tabata', name: '타바타 기본', prepare: 10, work: 20, rest: 10, rounds: 8, cycles: 1, cycleRest: 60, cooldown: 0 },
  { id: 'hiit', name: 'HIIT 40/20', prepare: 10, work: 40, rest: 20, rounds: 6, cycles: 3, cycleRest: 60, cooldown: 60 },
  { id: 'plank', name: '플랭크 1분×3', prepare: 5, work: 60, rest: 30, rounds: 3, cycles: 1, cycleRest: 0, cooldown: 0 },
];

export const PHASE_LABEL: Record<PhaseType, string> = {
  prepare: '준비',
  work: '운동',
  rest: '휴식',
  cyclerest: '세트 휴식',
  cooldown: '정리',
};

export const PHASE_SPEECH: Record<PhaseType, string> = {
  prepare: '준비하세요',
  work: '운동 시작',
  rest: '휴식',
  cyclerest: '세트 휴식',
  cooldown: '정리 운동',
};

/** Ordered list of intervals for a workout. No rest after the very last work interval. */
export function buildPlan(w: Workout): Interval[] {
  const p: Interval[] = [];
  if (w.prepare > 0) p.push({ type: 'prepare', dur: w.prepare, round: 0, cycle: 1 });
  for (let c = 1; c <= w.cycles; c++) {
    for (let r = 1; r <= w.rounds; r++) {
      p.push({ type: 'work', dur: w.work, round: r, cycle: c });
      const lastRound = r === w.rounds;
      const lastCycle = c === w.cycles;
      if (!lastRound && w.rest > 0) p.push({ type: 'rest', dur: w.rest, round: r, cycle: c });
      if (lastRound && !lastCycle) {
        if (w.cycleRest > 0) p.push({ type: 'cyclerest', dur: w.cycleRest, round: r, cycle: c });
        else if (w.rest > 0) p.push({ type: 'rest', dur: w.rest, round: r, cycle: c });
      }
    }
  }
  if (w.cooldown > 0) p.push({ type: 'cooldown', dur: w.cooldown, round: w.rounds, cycle: w.cycles });
  return p;
}

export const planTotal = (w: Workout) => buildPlan(w).reduce((a, b) => a + b.dur, 0);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function mmss(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function human(sec: number) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}시간 ${m}분`;
  if (m) return r ? `${m}분 ${r}초` : `${m}분`;
  return `${r}초`;
}
