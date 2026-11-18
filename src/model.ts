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
  backgroundAlerts: boolean; // keep running when the screen is off / app is in the background
  sounds: Record<SoundEvent, SoundId>;
  voiceId: string | null; // null = system default Korean voice
  voiceRate: number; // 0.5 ~ 2.0
  voiceCount: boolean; // say "셋, 둘, 하나" during the countdown
  ambient: { work: AmbientId; rest: AmbientId }; // background loop during work / rest phases
  ambientVolume: number; // 0 ~ 1
};

/** Looping background sounds that fill the silence during an interval. */
export type AmbientId = 'none' | 'clock' | 'clock_fast' | 'metronome' | 'heart_slow' | 'heart_fast' | 'drums' | 'electro' | 'rain';
export const AMBIENT_LABEL: Record<AmbientId, string> = {
  none: '없음',
  clock: '째깍째깍',
  clock_fast: '빠른 째깍',
  metronome: '메트로놈',
  heart_slow: '심장박동 (느리게)',
  heart_fast: '심장박동 (빠르게)',
  drums: '드럼 비트',
  electro: '일렉 비트',
  rain: '빗소리',
};
export const AMBIENT_IDS = Object.keys(AMBIENT_LABEL) as AmbientId[];

/** Moments that can each have their own alert sound. */
export type SoundEvent = 'work' | 'rest' | 'tick' | 'finish';
export const SOUND_EVENTS: { k: SoundEvent; label: string; hint: string }[] = [
  { k: 'work', label: '운동 시작', hint: '운동 구간이 시작될 때' },
  { k: 'rest', label: '휴식·준비 시작', hint: '휴식·준비·정리 구간이 시작될 때' },
  { k: 'tick', label: '카운트다운', hint: '구간이 끝나기 몇 초 전부터 매초' },
  { k: 'finish', label: '운동 완료', hint: '모든 구간이 끝났을 때' },
];

export type SoundId =
  | 'none' | 'beep_tick' | 'beep_high' | 'beep_low' | 'beep_finish'
  | 'bell_one' | 'bell_three' | 'bell_tick' | 'gong' | 'gong_short'
  | 'whistle' | 'whistle_double' | 'chime' | 'digital' | 'digital_tick'
  | 'wood_tick' | 'wood_double' | 'horn';

export const SOUND_LABEL: Record<SoundId, string> = {
  none: '소리 없음',
  beep_tick: '삑 (짧게)',
  beep_high: '삐- (길게)',
  beep_low: '삐뽀',
  beep_finish: '빰빰빰~',
  bell_one: '복싱 종 (땡)',
  bell_three: '복싱 종 (땡땡땡)',
  bell_tick: '종 (짧게)',
  gong: '징',
  gong_short: '징 (짧게)',
  whistle: '호루라기',
  whistle_double: '호루라기 두 번',
  chime: '딩동',
  digital: '전자음',
  digital_tick: '전자음 (짧게)',
  wood_tick: '딱 (목탁)',
  wood_double: '딱딱',
  horn: '에어혼',
};
export const SOUND_IDS = Object.keys(SOUND_LABEL) as SoundId[];

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  voice: true,
  haptics: true,
  keepAwake: true,
  countdown: 3,
  backgroundAlerts: true,
  sounds: { work: 'bell_three', rest: 'bell_one', tick: 'beep_tick', finish: 'gong' },
  voiceId: null,
  voiceRate: 1.0,
  voiceCount: false,
  ambient: { work: 'clock_fast', rest: 'clock' },
  ambientVolume: 0.5,
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
  prepare: '준비',
  work: '운동',
  rest: '휴식',
  cyclerest: '세트 휴식',
  cooldown: '정리 운동',
};
export const SPEECH_START = '시작';
export const SPEECH_END = '종료! 수고하셨습니다';
export const SPEECH_COUNT: Record<number, string> = { 1: '하나', 2: '둘', 3: '셋', 4: '넷', 5: '다섯' };

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
