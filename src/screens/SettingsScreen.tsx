import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { ensureNotificationPermission, play, speak } from '../feedback';
import { DEFAULT_WORKOUTS, Settings } from '../model';
import { useStore } from '../store';
import { C } from '../theme';
import { Button, Row, Stepper, Toggle } from '../ui';

const TOGGLES: [keyof Settings, string, string][] = [
  ['sound', '소리', '구간 전환·카운트다운 비프음'],
  ['voice', '음성 안내', '"운동 시작", "휴식" 등을 말해줘요'],
  ['haptics', '진동', '구간이 바뀔 때 진동'],
  ['keepAwake', '화면 켜두기', '타이머 중에 화면이 꺼지지 않게'],
  ['backgroundAlerts', '백그라운드 알림', '앱을 나가거나 화면을 꺼도 구간 전환을 알림으로'],
];

export default function SettingsScreen() {
  const { settings, setSettings, setWorkouts } = useStore();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
    if (k === 'backgroundAlerts' && v) ensureNotificationPermission().catch(() => {});
  };

  const test = () => {
    play('tick', settings);
    setTimeout(() => play('tick', settings), 600);
    setTimeout(() => { play('work', settings); speak('운동 시작', settings); }, 1200);
  };
  const restore = () =>
    Alert.alert('기본 운동 복원', '기본 운동(타바타 등)을 목록에 다시 추가할까요? 내가 만든 운동은 그대로 남아요.', [
      { text: '취소', style: 'cancel' },
      { text: '추가', onPress: () => setWorkouts((ws) => [...ws, ...DEFAULT_WORKOUTS.filter((d) => !ws.some((w) => w.id === d.id))]) },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      {TOGGLES.map(([k, label, hint]) => (
        <Row key={k} label={label} hint={hint}>
          <Toggle on={settings[k] as boolean} onChange={(v) => set(k, v)} />
        </Row>
      ))}
      <Row label="카운트다운 비프" hint="구간이 끝나기 몇 초 전부터 삑삑">
        <Stepper value={settings.countdown} format={(v) => `${v}초`}
          onStep={(d) => setSettings((s) => ({ ...s, countdown: Math.min(10, Math.max(0, s.countdown + d)) }))} />
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 14 }}><Button title="🔔 소리 테스트" onPress={test} /></View>
      <View style={{ flexDirection: 'row', marginTop: 10 }}><Button title="기본 운동 다시 불러오기" kind="danger" onPress={restore} /></View>
      <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, margin: 8, marginTop: 18 }}>
        💡 큰 숫자를 탭하면 일시정지/재개돼요. 폰을 가로로 돌리면 가로 화면이 나와요.{'\n'}
        💡 기록과 운동은 이 기기에만 저장돼요.
      </Text>
    </ScrollView>
  );
}
