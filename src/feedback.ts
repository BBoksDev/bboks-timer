import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Linking, Platform } from 'react-native';
import TimerService from '../modules/timer-service';
import { AmbientId, Interval, PHASE_LABEL, Settings, SoundEvent, SoundId, mmss } from './model';

/* ---------- sounds ---------- */
const SOURCES: Record<Exclude<SoundId, 'none'>, number> = {
  beep_tick: require('../assets/sounds/beep_tick.wav'),
  beep_high: require('../assets/sounds/beep_high.wav'),
  beep_low: require('../assets/sounds/beep_low.wav'),
  beep_finish: require('../assets/sounds/beep_finish.wav'),
  bell_one: require('../assets/sounds/bell_one.wav'),
  bell_three: require('../assets/sounds/bell_three.wav'),
  bell_tick: require('../assets/sounds/bell_tick.wav'),
  gong: require('../assets/sounds/gong.wav'),
  gong_short: require('../assets/sounds/gong_short.wav'),
  whistle: require('../assets/sounds/whistle.wav'),
  whistle_double: require('../assets/sounds/whistle_double.wav'),
  chime: require('../assets/sounds/chime.wav'),
  digital: require('../assets/sounds/digital.wav'),
  digital_tick: require('../assets/sounds/digital_tick.wav'),
  wood_tick: require('../assets/sounds/wood_tick.wav'),
  wood_double: require('../assets/sounds/wood_double.wav'),
  horn: require('../assets/sounds/horn.wav'),
};
const SILENCE = require('../assets/sounds/silence.wav');
const players: Partial<Record<SoundId, AudioPlayer>> = {};

function player(id: SoundId) {
  if (id === 'none') return null;
  if (!players[id]) players[id] = createAudioPlayer(SOURCES[id]);
  return players[id]!;
}

/** Load the sounds chosen in settings ahead of time so the first play is instant. */
export function preloadSounds(s: Settings) {
  try { Object.values(s.sounds).forEach((id) => player(id)); } catch {}
}

export async function initAudio() {
  try {
    // play over the silent switch, on top of the user's music at full volume, keep running in background
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: true });
  } catch {}
}

/** Play the sound picked for an event. */
export function play(event: SoundEvent, s: Settings) {
  if (!s.sound) return;
  playSound(s.sounds[event]);
}

/** Play a specific sound (also used for previews in settings). */
export function playSound(id: SoundId) {
  try {
    // stop any other alert still ringing (e.g. a long gong) so sounds don't pile up
    Object.entries(players).forEach(([k, p]) => { if (k !== id) p?.pause(); });
    const p = player(id);
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch {}
}

export function speak(text: string, s: Settings) {
  if (!s.sound || !s.voice) return;
  sayWith(text, s.voiceId, s.voiceRate);
}

/** What happened to the last thing we tried to say; shown in settings to diagnose silent voices. */
export type SpeechStatus = { state: 'idle' | 'waiting' | 'speaking' | 'done' | 'error' | 'no-response'; detail?: string; retried?: boolean };
let speechStatus: SpeechStatus = { state: 'idle' };
const speechListeners = new Set<(s: SpeechStatus) => void>();
function setSpeechStatus(s: SpeechStatus) {
  speechStatus = s;
  speechListeners.forEach((l) => l(s));
}
export function onSpeechStatus(l: (s: SpeechStatus) => void) {
  speechListeners.add(l);
  l(speechStatus);
  return () => { speechListeners.delete(l); };
}

let speechSeq = 0;
export function sayWith(text: string, voiceId: string | null, rate: number) {
  const seq = ++speechSeq;
  // Android's TTS only understands a bare language code ("ko", not "ko-KR").
  const full = { language: Platform.OS === 'android' ? 'ko' : 'ko-KR', rate, ...(voiceId ? { voice: voiceId } : {}) };

  const attempt = (opts: Speech.SpeechOptions, isRetry: boolean) => {
    let started = false;
    const retry = (why: string) => {
      if (seq !== speechSeq) return; // a newer phrase replaced this one
      if (!isRetry) attempt({ rate }, true); // try again with the phone's default voice and language
      else setSpeechStatus({ state: why === 'timeout' ? 'no-response' : 'error', detail: why, retried: true });
    };
    const guard = setTimeout(() => {
      if (started) return;
      // double-check with the engine before retrying, so we never say a phrase twice
      Speech.isSpeakingAsync()
        .then((speaking) => (speaking ? setSpeechStatus({ state: 'speaking', retried: isRetry }) : retry('timeout')))
        .catch(() => retry('timeout'));
    }, 2500);
    setSpeechStatus({ state: 'waiting', retried: isRetry });
    try {
      Speech.speak(text, {
        ...opts,
        onStart: () => { started = true; clearTimeout(guard); setSpeechStatus({ state: 'speaking', retried: isRetry }); },
        onDone: () => { clearTimeout(guard); if (seq === speechSeq) setSpeechStatus({ state: 'done', retried: isRetry }); },
        onError: (e) => { started = true; clearTimeout(guard); retry(String((e as { message?: string })?.message ?? e ?? 'error')); },
      });
    } catch (e) {
      clearTimeout(guard);
      retry(String((e as Error)?.message ?? e));
    }
  };

  // Wait for stop() to finish: on Android stop and speak run on separate native
  // threads, so an un-awaited stop() can land after speak() and cut the voice off.
  Speech.stop()
    .catch(() => {})
    .then(() => { if (seq === speechSeq) attempt(full, false); });
}

/** Counts of all / Korean voices the phone's speech engine reports. */
export async function voiceCounts() {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    return { total: all.length, korean: all.filter((v) => v.language?.toLowerCase().startsWith('ko')).length };
  } catch {
    return { total: -1, korean: 0 };
  }
}

/** Opens Android's text-to-speech settings so the user can pick an engine / download Korean. */
export function openTtsSettings() {
  if (Platform.OS !== 'android') return;
  Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings());
}

export type VoiceOption = { id: string; name: string; enhanced: boolean; note?: string };
/** Korean voices installed on this phone. */
export async function koreanVoices(): Promise<VoiceOption[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    return all
      .filter((v) => v.language?.toLowerCase().replace('_', '-').startsWith('ko'))
      .map((v) => ({ id: v.identifier, name: v.name || v.identifier, enhanced: v.quality === Speech.VoiceQuality.Enhanced }))
      .sort((a, b) => Number(b.enhanced) - Number(a.enhanced) || a.name.localeCompare(b.name))
      // Android reports raw ids like "ko-kr-x-kod-local" as names; give them friendly labels
      .map((v, i) => (/^ko[-_]kr[-_]x[-_]/i.test(v.name) || v.name === v.id && v.id.includes('-')
        ? { ...v, name: `한국어 목소리 ${i + 1}`, note: v.id.includes('network') ? '인터넷 연결 필요' : undefined }
        : v));
  } catch {
    return [];
  }
}

export function haptic(kind: 'light' | 'heavy' | 'success', s: Settings) {
  if (!s.haptics) return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/* ---------- background loops (째깍째깍 etc.) ---------- */
const AMBIENT_SOURCES: Record<Exclude<AmbientId, 'none'>, number> = {
  clock: require('../assets/ambient/clock.wav'),
  clock_fast: require('../assets/ambient/clock_fast.wav'),
  metronome: require('../assets/ambient/metronome.wav'),
  heart_slow: require('../assets/ambient/heart_slow.wav'),
  heart_fast: require('../assets/ambient/heart_fast.wav'),
  drums: require('../assets/ambient/drums.wav'),
  electro: require('../assets/ambient/electro.wav'),
  rain: require('../assets/ambient/rain.wav'),
};
const ambientPlayers: Partial<Record<AmbientId, AudioPlayer>> = {};
let ambientNow: AmbientId = 'none';

function ambientPlayer(id: AmbientId) {
  if (id === 'none') return null;
  if (!ambientPlayers[id]) {
    const p = createAudioPlayer(AMBIENT_SOURCES[id]);
    p.loop = true;
    ambientPlayers[id] = p;
  }
  return ambientPlayers[id]!;
}

/** Switch the background loop. Keeps playing (without restarting) if it's already the same loop. */
export function setAmbient(id: AmbientId, volume: number) {
  try {
    if (id !== ambientNow) {
      const old = ambientPlayer(ambientNow);
      old?.pause();
      const p = ambientPlayer(id);
      if (p) { p.seekTo(0); }
      ambientNow = id;
    }
    const p = ambientPlayer(id);
    if (p) { p.volume = volume; p.play(); }
  } catch {}
}

export function pauseAmbient() {
  try { ambientPlayer(ambientNow)?.pause(); } catch {}
}

export function stopAmbient() {
  pauseAmbient();
  ambientNow = 'none';
}

/* ---------- keep running with the screen off ---------- */
/**
 * React Native pauses its JavaScript timers (setInterval) once the app leaves
 * the screen, so while a workout runs we need a native clock that keeps calling
 * `onTick` in the background:
 * - Android: our own foreground service (modules/timer-service) shows a plain
 *   timer notification, holds a CPU wake lock and ticks every 200 ms.
 * - iOS: an inaudible looping track keeps the app alive (audio background mode)
 *   and its native status updates tick every 200 ms. No lock screen player.
 */
let keepAlive: AudioPlayer | null = null;
let clockSub: { remove: () => void } | null = null;

export function startBackgroundSession(title: string, subtitle: string, onTick: () => void): boolean {
  try {
    clockSub?.remove();
    clockSub = null;
    if (Platform.OS === 'android') {
      if (!TimerService) return false;
      clockSub = TimerService.addListener('onTick', () => onTick());
      TimerService.start(title, subtitle);
      return true;
    }
    if (!keepAlive) {
      keepAlive = createAudioPlayer(SILENCE, { updateInterval: 200 });
      keepAlive.loop = true;
      keepAlive.volume = 0.01;
    }
    clockSub = keepAlive.addListener('playbackStatusUpdate', () => onTick());
    keepAlive.play();
    return true;
  } catch {
    return false;
  }
}

export function updateBackgroundSession(title: string, subtitle: string) {
  try { if (Platform.OS === 'android') TimerService?.update(title, subtitle); } catch {}
}

export function stopBackgroundSession() {
  try {
    clockSub?.remove();
    clockSub = null;
    if (Platform.OS === 'android') TimerService?.stop();
    else keepAlive?.pause();
  } catch {}
}

/* ---------- background notifications (fallback) ---------- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'phase';
export async function initNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: '구간 알림',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300],
    }).catch(() => {});
  }
}

export async function ensureNotificationPermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

/**
 * When the app goes to the background the JS timer pauses, so schedule one
 * local notification for every upcoming phase change instead.
 * iOS keeps at most 64 pending notifications, so cap at 60.
 */
export async function scheduleUpcoming(plan: Interval[], idx: number, leftSec: number, workoutName: string) {
  await cancelUpcoming();
  let at = leftSec;
  const jobs: Promise<string>[] = [];
  for (let i = idx + 1; i <= plan.length && jobs.length < 60; i++) {
    const next = plan[i];
    const title = next ? `${PHASE_LABEL[next.type]} ${mmss(next.dur)}` : '운동 완료! 🎉';
    const body = next
      ? next.type === 'work' ? `${workoutName} · ${next.round}라운드` : workoutName
      : `${workoutName} 수고하셨어요`;
    if (at >= 1) {
      jobs.push(
        Notifications.scheduleNotificationAsync({
          content: { title, body, sound: 'default' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(at), channelId: CHANNEL },
        }),
      );
    }
    if (!next) break;
    at += next.dur;
  }
  await Promise.all(jobs).catch(() => {});
}

export async function cancelUpcoming() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
