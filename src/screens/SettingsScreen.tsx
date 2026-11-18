import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { VoiceOption, ensureNotificationPermission, koreanVoices, playSound, sayWith } from '../feedback';
import { DEFAULT_WORKOUTS, SOUND_EVENTS, SOUND_IDS, SOUND_LABEL, Settings, SoundEvent, SoundId } from '../model';
import { useStore } from '../store';
import { C } from '../theme';
import { Button, Chooser, OptionSheet, Row, Section, Stepper, Toggle } from '../ui';

const SAMPLE = '시작! 운동. 휴식. 셋, 둘, 하나. 종료!';

export default function SettingsScreen() {
  const { settings, setSettings, setWorkouts } = useStore();
  const [sheet, setSheet] = useState<SoundEvent | 'voice' | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => { koreanVoices().then(setVoices); }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
    if (k === 'backgroundAlerts' && v) ensureNotificationPermission().catch(() => {});
  };
  const setSound = (ev: SoundEvent, id: SoundId) => {
    setSettings((s) => ({ ...s, sounds: { ...s.sounds, [ev]: id } }));
    playSound(id);
  };
  const voiceName = (id: string | null) => (id ? voices.find((v) => v.id === id)?.name ?? '선택한 목소리' : '기본 목소리');

  const restore = () =>
    Alert.alert('기본 운동 복원', '기본 운동(타바타 등)을 목록에 다시 추가할까요? 내가 만든 운동은 그대로 남아요.', [
      { text: '취소', style: 'cancel' },
      { text: '추가', onPress: () => setWorkouts((ws) => [...ws, ...DEFAULT_WORKOUTS.filter((d) => !ws.some((w) => w.id === d.id))]) },
    ]);

  const soundEvent = sheet && sheet !== 'voice' ? SOUND_EVENTS.find((e) => e.k === sheet) : null;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <Section title="알림음" />
      <Row label="소리" hint="모든 알림음·음성 켜기/끄기">
        <Toggle on={settings.sound} onChange={(v) => set('sound', v)} />
      </Row>
      {SOUND_EVENTS.map((e) => (
        <Row key={e.k} label={e.label} hint={e.hint}>
          <Chooser value={SOUND_LABEL[settings.sounds[e.k]]} onPress={() => setSheet(e.k)} />
        </Row>
      ))}
      <Row label="카운트다운 시간" hint="구간이 끝나기 몇 초 전부터 알려줄지">
        <Stepper value={settings.countdown} format={(v) => `${v}초`}
          onStep={(d) => setSettings((s) => ({ ...s, countdown: Math.min(10, Math.max(0, s.countdown + d)) }))} />
      </Row>

      <Section title="음성 안내" />
      <Row label="음성 안내" hint='"시작", "운동", "휴식", "종료"를 말해줘요'>
        <Toggle on={settings.voice} onChange={(v) => set('voice', v)} />
      </Row>
      <Row label="목소리" hint={voices.length ? `이 폰의 한국어 목소리 ${voices.length}개` : '폰에 설치된 한국어 목소리'}>
        <Chooser value={voiceName(settings.voiceId)} onPress={() => setSheet('voice')} />
      </Row>
      <Row label="말 빠르기" hint="1.0이 보통">
        <Stepper value={settings.voiceRate} format={(v) => v.toFixed(1)}
          onStep={(d) => setSettings((s) => ({ ...s, voiceRate: Math.round(Math.min(2, Math.max(0.5, s.voiceRate + d * 0.1)) * 10) / 10 }))} />
      </Row>
      <Row label="숫자 세기" hint='카운트다운 때 "셋, 둘, 하나"'>
        <Toggle on={settings.voiceCount} onChange={(v) => set('voiceCount', v)} />
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <Button title="🔊 목소리 들어보기" onPress={() => sayWith(SAMPLE, settings.voiceId, settings.voiceRate)} />
      </View>

      <Section title="기타" />
      <Row label="진동" hint="구간이 바뀔 때 진동">
        <Toggle on={settings.haptics} onChange={(v) => set('haptics', v)} />
      </Row>
      <Row label="화면 켜두기" hint="타이머 중에 화면이 꺼지지 않게">
        <Toggle on={settings.keepAwake} onChange={(v) => set('keepAwake', v)} />
      </Row>
      <Row label="화면 꺼져도 계속" hint="화면을 끄거나 다른 앱으로 가도 알림음·음성이 그대로 나와요">
        <Toggle on={settings.backgroundAlerts} onChange={(v) => set('backgroundAlerts', v)} />
      </Row>
      <View style={{ flexDirection: 'row', marginTop: 14 }}><Button title="기본 운동 다시 불러오기" kind="danger" onPress={restore} /></View>
      <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, margin: 8, marginTop: 18 }}>
        💡 큰 숫자를 탭하면 일시정지/재개돼요. 폰을 가로로 돌리면 가로 화면이 나와요.{'\n'}
        💡 목소리가 하나뿐이면 폰 설정 → 텍스트 음성 변환(TTS)에서 한국어 음성을 추가로 받을 수 있어요.{'\n'}
        💡 기록과 운동은 이 기기에만 저장돼요.
      </Text>

      <OptionSheet
        visible={!!soundEvent}
        title={soundEvent ? `${soundEvent.label} 소리` : ''}
        options={SOUND_IDS.map((id) => ({ id, label: SOUND_LABEL[id] }))}
        selected={soundEvent ? settings.sounds[soundEvent.k] : ''}
        onSelect={(id) => soundEvent && setSound(soundEvent.k, id as SoundId)}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'voice'}
        title="목소리 고르기"
        options={[
          { id: '', label: '기본 목소리', sub: '폰 기본 설정을 따라요' },
          ...voices.map((v) => ({ id: v.id, label: v.name, sub: [v.enhanced && '고음질', v.note].filter(Boolean).join(' · ') || undefined })),
        ]}
        selected={settings.voiceId ?? ''}
        onSelect={(id) => {
          const v = id || null;
          set('voiceId', v);
          sayWith('시작! 운동. 휴식.', v, settings.voiceRate);
        }}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}
