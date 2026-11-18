import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Interval, PHASE_LABEL, Settings, SoundEvent, SoundId, mmss } from './model';

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

export function sayWith(text: string, voiceId: string | null, rate: number) {
  Speech.stop();
  Speech.speak(text, { language: 'ko-KR', rate, ...(voiceId ? { voice: voiceId } : {}) });
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

/* ---------- keep running with the screen off ---------- */
/**
 * While a workout runs we loop an inaudible track and register it for the
 * lock screen. That keeps the app alive in the background (Android media
 * foreground service / iOS audio background mode), so the timer, beeps and
 * voice keep working exactly like in the foreground.
 */
let keepAlive: AudioPlayer | null = null;

export function startBackgroundSession(title: string, subtitle: string): boolean {
  try {
    if (!keepAlive) {
      keepAlive = createAudioPlayer(SILENCE);
      keepAlive.loop = true;
      keepAlive.volume = 0.01;
    }
    keepAlive.play();
    keepAlive.setActiveForLockScreen(true, { title, artist: subtitle, albumTitle: '뽁타이머' }, { showSeekForward: false, showSeekBackward: false });
    return true;
  } catch {
    return false;
  }
}

export function updateBackgroundSession(title: string, subtitle: string) {
  try { keepAlive?.updateLockScreenMetadata({ title, artist: subtitle, albumTitle: '뽁타이머' }); } catch {}
}

export function stopBackgroundSession() {
  try {
    keepAlive?.pause();
    keepAlive?.clearLockScreenControls();
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
