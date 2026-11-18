import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Row with label + hint on the left and a control on the right. */
export function Row({ label, hint, dot, children }: { label: string; hint?: string; dot?: string; children: React.ReactNode }) {
  return (
    <Card style={s.row}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {dot ? <View style={[s.dot, { backgroundColor: dot }]} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{label}</Text>
          {hint ? <Text style={s.hint}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

/** − value ＋ with press-and-hold repeat. */
export function Stepper({ value, onStep, format }: { value: number; onStep: (dir: 1 | -1) => void; format: (v: number) => string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    if (repeat.current) clearInterval(repeat.current);
    timer.current = repeat.current = null;
  };
  const start = (d: 1 | -1) => {
    onStep(d);
    timer.current = setTimeout(() => { repeat.current = setInterval(() => onStep(d), 90); }, 400);
  };
  const Btn = ({ d, t }: { d: 1 | -1; t: string }) => (
    <Pressable onPressIn={() => start(d)} onPressOut={stop} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]} hitSlop={4}>
      <Text style={s.stepTxt}>{t}</Text>
    </Pressable>
  );
  return (
    <View style={s.stepper}>
      <Btn d={-1} t="−" />
      <Text style={s.val}>{format(value)}</Text>
      <Btn d={1} t="+" />
    </View>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!on)} style={[s.toggle, on && { backgroundColor: '#19c3a6' }]} hitSlop={8}>
      <View style={[s.knob, on && { left: 23 }]} />
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'default' }: { title: string; onPress: () => void; kind?: 'default' | 'primary' | 'danger' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.btn, kind === 'primary' && { backgroundColor: C.accent }, kind === 'danger' && s.btnDanger, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.btnTxt, kind === 'danger' && { color: C.accent }]}>{title}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { color: C.text, fontSize: 16, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 40, height: 40, borderRadius: 11, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 22, fontWeight: '600', marginTop: -2 },
  val: { color: C.text, minWidth: 66, textAlign: 'center', fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  toggle: { width: 52, height: 32, borderRadius: 16, backgroundColor: C.card2 },
  knob: { position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  btn: { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center' },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btnTxt: { color: C.text, fontSize: 16, fontWeight: '800' },
});
