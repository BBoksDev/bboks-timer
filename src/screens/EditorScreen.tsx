import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Workout, human, mmss, planTotal, uid } from '../model';
import { useStore } from '../store';
import { C, PHASE_COLOR } from '../theme';
import { Button, Card, Row, Stepper } from '../ui';

type Field = { k: keyof Workout; label: string; hint: string; dot?: string; unit: 's' | 'n'; min: number };
const FIELDS: Field[] = [
  { k: 'prepare', label: '준비', hint: '시작 전 카운트다운', dot: PHASE_COLOR.prepare, unit: 's', min: 0 },
  { k: 'work', label: '운동', hint: '한 라운드 운동 시간', dot: PHASE_COLOR.work, unit: 's', min: 1 },
  { k: 'rest', label: '휴식', hint: '라운드 사이 휴식', dot: PHASE_COLOR.rest, unit: 's', min: 0 },
  { k: 'rounds', label: '라운드', hint: '운동+휴식 반복 횟수', unit: 'n', min: 1 },
  { k: 'cycles', label: '사이클', hint: '라운드 묶음 반복 횟수', unit: 'n', min: 1 },
  { k: 'cycleRest', label: '사이클 휴식', hint: '사이클 사이 긴 휴식', dot: PHASE_COLOR.cyclerest, unit: 's', min: 0 },
  { k: 'cooldown', label: '정리', hint: '마무리 운동/스트레칭', dot: PHASE_COLOR.cooldown, unit: 's', min: 0 },
];

/** Step size grows with the value so long durations stay quick to set. */
function stepped(cur: number, dir: 1 | -1, unit: 's' | 'n', min: number) {
  if (unit === 'n') return Math.min(99, Math.max(min, cur + dir));
  const size = (v: number) => (v < 60 ? 5 : v < 300 ? 15 : 30);
  let nv: number;
  if (dir > 0) nv = cur + size(cur) - (cur % size(cur));
  else { const s = size(Math.max(0, cur - 1)); nv = cur % s ? cur - (cur % s) : cur - s; }
  return Math.min(5999, Math.max(min, nv));
}

export default function EditorScreen({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { workouts, setWorkouts } = useStore();
  const src = id ? workouts.find((w) => w.id === id) : undefined;
  const [d, setD] = useState<Workout>(
    src ?? { id: '', name: '', prepare: 10, work: 30, rest: 15, rounds: 8, cycles: 1, cycleRest: 60, cooldown: 0 },
  );

  const save = () => {
    const w = { ...d, name: d.name.trim() || '내 운동' };
    if (src) setWorkouts((ws) => ws.map((x) => (x.id === src.id ? w : x)));
    else setWorkouts((ws) => [...ws, { ...w, id: uid() }]);
    onClose();
  };
  const remove = () =>
    Alert.alert('운동 삭제', `'${d.name}' 운동을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { setWorkouts((ws) => ws.filter((x) => x.id !== d.id)); onClose(); } },
    ]);
  const duplicate = () => { setWorkouts((ws) => [...ws, { ...d, id: uid(), name: `${d.name || '운동'} 복사본` }]); onClose(); };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <TextInput
          value={d.name}
          onChangeText={(name) => setD({ ...d, name })}
          placeholder="운동 이름"
          placeholderTextColor={C.muted}
          maxLength={30}
          style={{ color: C.text, fontSize: 19, fontWeight: '800', padding: 0 }}
        />
      </Card>
      {FIELDS.map((f) => (
        <Row key={f.k} label={f.label} hint={f.hint} dot={f.dot}>
          <Stepper
            value={d[f.k] as number}
            format={(v) => (f.unit === 's' ? mmss(v) : String(v))}
            onStep={(dir) => setD((p) => ({ ...p, [f.k]: stepped(p[f.k] as number, dir, f.unit, f.min) }))}
          />
        </Row>
      ))}
      <Text style={{ color: C.muted, textAlign: 'center', marginTop: 12 }}>
        운동 {d.rounds * d.cycles}회 · 총 {human(planTotal(d))}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        {src && <Button title="삭제" kind="danger" onPress={remove} />}
        <Button title="저장" kind="primary" onPress={save} />
      </View>
      {src && (
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <Button title="복제" onPress={duplicate} />
        </View>
      )}
    </ScrollView>
  );
}
