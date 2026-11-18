import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LogEntry, human } from '../model';
import { useStore } from '../store';
import { C } from '../theme';

const dayKey = (t: number) => new Date(t).toDateString();

function dayLabel(t: number) {
  const today = new Date();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const k = dayKey(t);
  if (k === today.toDateString()) return '오늘';
  if (k === y.toDateString()) return '어제';
  const d = new Date(t);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

function timeLabel(t: number) {
  const d = new Date(t);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LogScreen() {
  const { logs, setLogs } = useStore();
  const weekAgo = Date.now() - 7 * 864e5;
  const week = logs.filter((l) => l.at >= weekAgo);
  const days = new Set(logs.map((l) => dayKey(l.at)));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }

  const remove = (l: LogEntry) =>
    Alert.alert('기록 삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => setLogs((ls) => ls.filter((x) => x.id !== l.id)) },
    ]);

  let last = '';
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={st.stats}>
        <Stat n={`${week.length}`} label="이번 주 운동" />
        <Stat n={`${Math.round(week.reduce((a, l) => a + l.secs, 0) / 60)}분`} label="이번 주 시간" />
        <Stat n={`${streak}일`} label="연속 운동" />
      </View>
      <Text style={st.note}>전체 {logs.length}회 · {human(logs.reduce((a, l) => a + l.secs, 0))}</Text>
      {logs.length === 0 && <Text style={st.empty}>아직 기록이 없어요. 첫 운동을 시작해 보세요! 💪</Text>}
      {logs.map((l) => {
        const k = dayKey(l.at);
        const header = k !== last ? <Text style={st.day}>{dayLabel(l.at)}</Text> : null;
        last = k;
        return (
          <View key={l.id}>
            {header}
            <View style={st.item}>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{l.name}</Text>
                <Text style={st.sub}>{timeLabel(l.at)} · {human(l.secs)} · 운동 {l.rounds}/{l.totalRounds}회</Text>
              </View>
              <View style={[st.badge, !l.complete && { backgroundColor: 'rgba(255,176,32,0.18)' }]}>
                <Text style={[st.badgeTxt, !l.complete && { color: '#ffb020' }]}>{l.complete ? '완료' : '중단'}</Text>
              </View>
              <Pressable onPress={() => remove(l)} hitSlop={8} style={{ padding: 4 }}>
                <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const Stat = ({ n, label }: { n: string; label: string }) => (
  <View style={st.stat}>
    <Text style={st.statN}>{n}</Text>
    <Text style={st.statL}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10, marginTop: 6 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  statN: { color: C.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statL: { color: C.muted, fontSize: 12, marginTop: 2 },
  note: { color: C.muted, fontSize: 13, margin: 8 },
  empty: { color: C.muted, textAlign: 'center', paddingVertical: 40 },
  day: { color: C.muted, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 2, marginLeft: 4 },
  item: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: C.text, fontWeight: '800', fontSize: 15 },
  sub: { color: C.muted, fontSize: 13, marginTop: 3 },
  badge: { backgroundColor: 'rgba(25,195,166,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeTxt: { color: '#19c3a6', fontSize: 11, fontWeight: '800' },
});
