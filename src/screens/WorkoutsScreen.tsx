import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { human, planTotal } from '../model';
import { useStore } from '../store';
import { C, PHASE_COLOR } from '../theme';

export default function WorkoutsScreen({ onEdit, onStart }: { onEdit: (id: string | null) => void; onStart: (id: string) => void }) {
  const { workouts } = useStore();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      {workouts.length === 0 && <Text style={st.empty}>운동이 없어요. 아래에서 만들어 보세요.</Text>}
      {workouts.map((w) => (
        <View key={w.id} style={st.card}>
          <Pressable onPress={() => onEdit(w.id)} style={st.edit} hitSlop={6} accessibilityLabel="편집">
            <Text style={{ color: C.text, fontSize: 17 }}>✎</Text>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => onEdit(w.id)}>
            <Text style={st.name} numberOfLines={1}>{w.name}</Text>
            <View style={st.meta}>
              <Meta color={PHASE_COLOR.work} text={`${w.work}초`} />
              <Meta color={PHASE_COLOR.rest} text={`${w.rest}초`} />
              <Text style={st.metaTxt}>× {w.rounds}라운드</Text>
              {w.cycles > 1 && <Text style={st.metaTxt}>× {w.cycles}사이클</Text>}
            </View>
            <Text style={st.total}>총 {human(planTotal(w))}</Text>
          </Pressable>
          <Pressable onPress={() => onStart(w.id)} style={({ pressed }) => [st.play, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityLabel="시작">
            <Text style={st.playIcon}>▶</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onEdit(null)} style={st.add}>
        <Text style={{ color: C.muted, fontWeight: '700', fontSize: 15 }}>＋ 새 운동 만들기</Text>
      </Pressable>
    </ScrollView>
  );
}

const Meta = ({ color, text }: { color: string; text: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text style={st.metaTxt}>{text}</Text>
  </View>
);

const st = StyleSheet.create({
  empty: { color: C.muted, textAlign: 'center', paddingVertical: 40 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 14 },
  edit: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  name: { color: C.text, fontSize: 19, fontWeight: '800' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  metaTxt: { color: C.muted, fontSize: 13 },
  total: { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
  play: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 22, marginLeft: 4 },
  add: { borderWidth: 2, borderStyle: 'dashed', borderColor: C.line, borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 6 },
});
