import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Alert, AppState, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelUpcoming, ensureNotificationPermission, haptic, play, scheduleUpcoming, speak,
  startBackgroundSession, stopBackgroundSession, updateBackgroundSession,
} from '../feedback';
import { PHASE_LABEL, PHASE_SPEECH, SPEECH_COUNT, SPEECH_END, SPEECH_START, Workout, buildPlan, human, mmss, uid } from '../model';
import { useStore } from '../store';
import { C, PHASE_COLOR } from '../theme';

type Engine = {
  idx: number;
  running: boolean;
  phaseStart: number; // ms timestamp when current interval (virtually) started
  pausedLeft: number; // seconds left, valid while paused
  activeMs: number;
  lastTick: number;
  lastBeep: number | null;
  startedAt: number;
  done: boolean;
  logged: boolean;
};

const releaseAwake = () => { deactivateKeepAwake('run').catch(() => {}); };

const fresh = (): Engine => ({
  idx: 0, running: true, phaseStart: Date.now(), pausedLeft: 0, activeMs: 0,
  lastTick: Date.now(), lastBeep: null, startedAt: Date.now(), done: false, logged: false,
});

export default function RunScreen({ workout, onClose }: { workout: Workout; onClose: (toLog: boolean) => void }) {
  const { settings, setSettings, setLogs } = useStore();
  const plan = useMemo(() => buildPlan(workout), [workout]);
  const totalWork = plan.filter((p) => p.type === 'work').length;
  const e = useRef<Engine>(fresh());
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const sref = useRef(settings);
  sref.current = settings;
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const insets = useSafeAreaInsets();

  const leftSec = () => {
    const r = e.current;
    return r.running ? plan[r.idx].dur - (Date.now() - r.phaseStart) / 1000 : r.pausedLeft;
  };

  const bgActive = useRef(false);
  const bgStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startBg = useCallback(() => {
    if (bgStopTimer.current) clearTimeout(bgStopTimer.current);
    // keep the timer, beeps and voice alive when the screen is off / app is in the background
    if (!sref.current.backgroundAlerts) return;
    const p = plan[0];
    bgActive.current = startBackgroundSession(`${PHASE_LABEL[p.type]} ${mmss(p.dur)}`, workout.name);
  }, [plan, workout.name]);
  const stopBg = () => { if (bgActive.current) stopBackgroundSession(); bgActive.current = false; };

  const announce = useCallback((i: number) => {
    const p = plan[i];
    const s = sref.current;
    e.current.lastBeep = null;
    if (bgActive.current) {
      updateBackgroundSession(`${PHASE_LABEL[p.type]} ${mmss(p.dur)}`, p.type === 'work' ? `${workout.name} · ${p.round}라운드` : workout.name);
    }
    play(p.type === 'work' ? 'work' : 'rest', s);
    haptic('heavy', s);
    let line = PHASE_SPEECH[p.type];
    if (p.type === 'work') {
      const firstWork = plan.findIndex((x) => x.type === 'work') === i;
      const lastWork = plan.length - 1 - [...plan].reverse().findIndex((x) => x.type === 'work') === i;
      line = firstWork ? SPEECH_START : lastWork && totalWork > 1 ? `마지막, ${PHASE_SPEECH.work}` : PHASE_SPEECH.work;
    }
    speak(line, s);
  }, [plan, totalWork, workout.name]);

  const workDone = () => plan.slice(0, e.current.idx).filter((p) => p.type === 'work').length;

  const saveLog = (complete: boolean) => {
    const r = e.current;
    const secs = Math.round(r.activeMs / 1000);
    if (r.logged || secs < 5) return;
    r.logged = true;
    setLogs((l) => [{ id: uid(), workoutId: workout.id, name: workout.name, at: r.startedAt, secs,
      rounds: complete ? totalWork : workDone(), totalRounds: totalWork, complete }, ...l]);
  };

  const finish = () => {
    const r = e.current;
    if (r.done) return;
    r.done = true;
    r.running = false;
    saveLog(true);
    const s = sref.current;
    play('finish', s);
    haptic('success', s);
    speak(SPEECH_END, s);
    releaseAwake();
    bgStopTimer.current = setTimeout(stopBg, 4000); // let the finish sound/voice play out first
    redraw();
  };

  /** Advance through any intervals whose time has passed (also catches up after background). */
  const tick = useCallback((quiet = false) => {
    const r = e.current;
    if (r.done) return;
    const now = Date.now();
    if (r.running) {
      r.activeMs += now - r.lastTick;
      let left = leftSec();
      let moved = false;
      while (left <= 0) {
        if (r.idx + 1 >= plan.length) { r.lastTick = now; finish(); return; }
        r.phaseStart = now + left * 1000; // carry the overshoot
        r.idx++;
        moved = true;
        left = leftSec();
      }
      if (moved && !quiet) announce(r.idx);
      const whole = Math.ceil(left);
      if (!quiet && whole <= sref.current.countdown && whole > 0 && r.lastBeep !== whole && plan[r.idx].dur > whole) {
        r.lastBeep = whole;
        play('tick', sref.current);
        haptic('light', sref.current);
        if (sref.current.voiceCount && SPEECH_COUNT[whole]) speak(SPEECH_COUNT[whole], sref.current);
      }
    }
    r.lastTick = now;
    redraw();
  }, [plan, announce]);

  // start + main loop
  useEffect(() => {
    e.current = fresh();
    startBg();
    announce(0);
    const t = setInterval(() => tick(), 100);
    return () => { clearInterval(t); cancelUpcoming(); releaseAwake(); stopBg(); };
  }, [tick, announce, startBg]);

  const awake = settings.keepAwake && e.current.running && !e.current.done;
  useEffect(() => {
    if (awake) activateKeepAwakeAsync('run').catch(() => {});
    else releaseAwake();
  }, [awake]);

  // background: if the background audio session could not start, fall back to notifications
  useEffect(() => {
    if (sref.current.backgroundAlerts) ensureNotificationPermission().catch(() => {});
    const sub = AppState.addEventListener('change', (st) => {
      const r = e.current;
      if (st === 'background') {
        if (r.running && !r.done && sref.current.backgroundAlerts && !bgActive.current) scheduleUpcoming(plan, r.idx, leftSec(), workout.name);
      } else if (st === 'active') {
        cancelUpcoming();
        const before = r.idx;
        tick(true); // catch up silently
        if (r.idx !== before && !r.done) announce(r.idx);
      }
    });
    return () => sub.remove();
  }, [plan, tick, announce, workout.name]);

  const toggle = () => {
    const r = e.current;
    if (r.done) { e.current = fresh(); startBg(); announce(0); redraw(); return; }
    if (r.running) { r.pausedLeft = leftSec(); r.running = false; }
    else { r.phaseStart = Date.now() - (plan[r.idx].dur - r.pausedLeft) * 1000; r.running = true; r.lastTick = Date.now(); }
    haptic('light', sref.current);
    redraw();
  };
  const goto = (i: number) => {
    const r = e.current;
    if (r.done) return;
    if (i >= plan.length) { finish(); return; }
    r.idx = Math.max(0, i);
    r.phaseStart = Date.now();
    r.pausedLeft = plan[r.idx].dur;
    announce(r.idx);
    redraw();
  };
  const prev = () => {
    const r = e.current;
    const elapsed = plan[r.idx].dur - leftSec();
    goto(elapsed > 2 ? r.idx : r.idx - 1); // restart this interval, or go back if it just started
  };
  const close = () => {
    const r = e.current;
    if (r.done) { onClose(true); return; }
    const quit = () => { saveLog(false); onClose(false); };
    if (!r.running) { quit(); return; }
    Alert.alert('운동 종료', '운동을 끝낼까요? 지금까지 한 만큼 기록에 남아요.', [
      { text: '계속하기', style: 'cancel' },
      { text: '끝내기', style: 'destructive', onPress: quit },
    ]);
  };

  const r = e.current;
  const p = plan[r.idx];
  const left = leftSec();

  if (r.done) {
    return (
      <View style={[st.root, { backgroundColor: C.bg, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <StatusBar barStyle="light-content" />
        <View style={st.center}>
          <Text style={{ fontSize: 64 }}>🎉</Text>
          <Text style={{ color: C.text, fontSize: 40, fontWeight: '900', marginTop: 8 }}>완료!</Text>
          <Text style={st.doneTxt}>{workout.name}</Text>
          <Text style={st.doneTxt}>운동 {totalWork}회 · {human(r.activeMs / 1000)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24 }}>
          <Pressable style={[st.doneBtn, { backgroundColor: C.card2 }]} onPress={toggle}><Text style={st.doneBtnTxt}>한 번 더</Text></Pressable>
          <Pressable style={[st.doneBtn, { backgroundColor: C.accent }]} onPress={() => onClose(true)}><Text style={st.doneBtnTxt}>기록 보기</Text></Pressable>
        </View>
      </View>
    );
  }

  const color = PHASE_COLOR[p.type];
  const next = plan[r.idx + 1];
  const roundsLeft = p.type === 'prepare' ? workout.rounds : p.type === 'cooldown' ? 0 : workout.rounds - p.round + (p.type === 'work' ? 1 : 0);
  const cyclesLeft = p.type === 'prepare' ? workout.cycles : p.type === 'cooldown' ? 0 : workout.cycles - p.cycle + 1;
  const remaining = Math.max(0, left) + plan.slice(r.idx + 1).reduce((a, b) => a + b.dur, 0);
  const progress = Math.min(1, Math.max(0, 1 - left / p.dur));
  const bigSize = landscape ? Math.min(height * 0.42, width * 0.2) : Math.min(width * 0.3, 200);

  const counters = (
    <View style={[st.counters, landscape && { flexDirection: 'column', gap: 18 }]}>
      <Counter n={roundsLeft} label="남은 라운드" />
      {workout.cycles > 1 && <Counter n={cyclesLeft} label="남은 사이클" />}
    </View>
  );
  const controls = (
    <View style={[st.controls, landscape && { gap: 12 }]}>
      <CBtn onPress={prev} label="이전" glyph="⏮" />
      <Pressable onPress={toggle} style={[st.main, { backgroundColor: C.ink }]} accessibilityLabel={r.running ? '일시정지' : '재개'}>
        <Text style={{ color, fontSize: 34, fontWeight: '900', marginLeft: r.running ? 0 : 5 }}>{r.running ? 'Ⅱ' : '▶'}</Text>
      </Pressable>
      <CBtn onPress={() => goto(r.idx + 1)} label="다음" glyph="⏭" />
    </View>
  );

  return (
    <View style={[st.root, { backgroundColor: color, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 14, paddingLeft: insets.left + 18, paddingRight: insets.right + 18 }]}>
      <StatusBar barStyle="dark-content" />
      <View style={st.top}>
        <Pressable onPress={close} style={st.round} accessibilityLabel="닫기"><Text style={st.roundTxt}>✕</Text></Pressable>
        <Text style={st.wname} numberOfLines={1}>{workout.name}</Text>
        <Text style={st.remain}>{mmss(remaining)}</Text>
        <Pressable onPress={() => setSettings((s) => ({ ...s, sound: !s.sound }))} style={st.round} accessibilityLabel="소리">
          <Text style={{ fontSize: 18 }}>{settings.sound ? '🔊' : '🔇'}</Text>
        </Pressable>
      </View>

      <View style={[{ flex: 1 }, landscape && { flexDirection: 'row', alignItems: 'center', gap: 20 }]}>
        <Pressable style={st.center} onPress={toggle}>
          <Text style={st.phase}>{PHASE_LABEL[p.type]}</Text>
          <Text style={[st.big, { fontSize: bigSize, lineHeight: bigSize * 1.08 }]} adjustsFontSizeToFit numberOfLines={1}>{mmss(left)}</Text>
          <View style={st.bar}><View style={[st.barFill, { width: `${progress * 100}%` }]} /></View>
          <Text style={st.next}>{next ? `다음: ${PHASE_LABEL[next.type]} ${mmss(next.dur)}` : '마지막 구간!'}</Text>
          {!r.running && <View style={st.paused}><Text style={st.pausedTxt}>일시정지</Text></View>}
        </Pressable>
        {landscape ? (
          <View style={{ justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 10 }}>{counters}{controls}</View>
        ) : null}
      </View>

      {!landscape && (<>{counters}{controls}</>)}
    </View>
  );
}

const Counter = ({ n, label }: { n: number; label: string }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={st.cnum}>{n}</Text>
    <Text style={st.clabel}>{label}</Text>
  </View>
);
const CBtn = ({ onPress, label, glyph }: { onPress: () => void; label: string; glyph: string }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [st.cbtn, pressed && { opacity: 0.6 }]} accessibilityLabel={label}>
    <Text style={{ fontSize: 22, color: C.ink }}>{glyph}</Text>
  </Pressable>
);

const st = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.14)', alignItems: 'center', justifyContent: 'center' },
  roundTxt: { fontSize: 18, fontWeight: '900', color: C.ink },
  wname: { flex: 1, fontSize: 15, fontWeight: '800', color: C.ink, opacity: 0.75 },
  remain: { fontSize: 15, fontWeight: '800', color: C.ink, opacity: 0.75, fontVariant: ['tabular-nums'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  phase: { fontSize: 44, fontWeight: '900', color: C.ink, letterSpacing: 4 },
  big: { fontWeight: '900', color: C.ink, fontVariant: ['tabular-nums'], letterSpacing: -3 },
  bar: { width: '100%', maxWidth: 520, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.16)', marginTop: 12, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.ink, borderRadius: 5 },
  next: { marginTop: 14, fontSize: 19, fontWeight: '800', color: C.ink, opacity: 0.8 },
  paused: { position: 'absolute', backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, transform: [{ rotate: '-8deg' }] },
  pausedTxt: { color: '#fff', fontWeight: '900', fontSize: 20, letterSpacing: 2 },
  counters: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  cnum: { fontSize: 50, fontWeight: '900', color: C.ink, fontVariant: ['tabular-nums'], lineHeight: 54 },
  clabel: { fontSize: 12, fontWeight: '800', color: C.ink, opacity: 0.7 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
  cbtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.14)', alignItems: 'center', justifyContent: 'center' },
  main: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  doneTxt: { color: C.muted, fontSize: 16, marginTop: 6 },
  doneBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  doneBtnTxt: { color: C.text, fontSize: 16, fontWeight: '800' },
});
