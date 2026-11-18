import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Interval, PHASE_LABEL, Settings, mmss } from './model';

/* ---------- sounds ---------- */
const SOURCES = {
  tick: require('../assets/sounds/tick.wav'),
  work: require('../assets/sounds/work.wav'),
  rest: require('../assets/sounds/rest.wav'),
  finish: require('../assets/sounds/finish.wav'),
};
const SILENCE = require('../assets/sounds/silence.wav');
export type SoundName = keyof typeof SOURCES;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

export async function initAudio() {
  try {
    // play over the silent switch, lower the user's music briefly, keep running in background
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true });
    (Object.keys(SOURCES) as SoundName[]).forEach((k) => {
      players[k] = createAudioPlayer(SOURCES[k]);
    });
  } catch {}
}

export function play(name: SoundName, s: Settings) {
  if (!s.sound) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}

export function speak(text: string, s: Settings) {
  if (!s.sound || !s.voice) return;
  Speech.stop();
  Speech.speak(text, { language: 'ko-KR', rate: 1.05 });
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
