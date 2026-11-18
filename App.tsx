import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { initAudio, initNotifications } from './src/feedback';
import EditorScreen from './src/screens/EditorScreen';
import LogScreen from './src/screens/LogScreen';
import RunScreen from './src/screens/RunScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WorkoutsScreen from './src/screens/WorkoutsScreen';
import { StoreProvider, useStore } from './src/store';
import { C } from './src/theme';

type Tab = 'workouts' | 'log' | 'settings';
type Route = { name: 'tabs' } | { name: 'edit'; id: string | null } | { name: 'run'; id: string };

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'workouts', label: '운동', icon: '⏱' },
  { key: 'log', label: '기록', icon: '📒' },
  { key: 'settings', label: '설정', icon: '⚙️' },
];

function Main() {
  const { ready, workouts } = useStore();
  const [tab, setTab] = useState<Tab>('workouts');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });
  const insets = useSafeAreaInsets();

  useEffect(() => { initAudio(); initNotifications(); }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  if (route.name === 'run') {
    const w = workouts.find((x) => x.id === route.id);
    if (w) {
      return (
        <RunScreen
          workout={w}
          onClose={(toLog) => { if (toLog) setTab('log'); setRoute({ name: 'tabs' }); }}
        />
      );
    }
  }

  const editing = route.name === 'edit';
  return (
    <View style={[st.root, { paddingTop: insets.top + 6 }]}>
      <StatusBar style="light" />
      <View style={[st.header, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        {editing ? (
          <>
            <Pressable onPress={() => setRoute({ name: 'tabs' })} style={st.back} hitSlop={8}>
              <Text style={{ color: C.text, fontSize: 26, marginTop: -3 }}>‹</Text>
            </Pressable>
            <Text style={st.subTitle}>{route.id ? '운동 편집' : '운동 만들기'}</Text>
            <View style={{ width: 44 }} />
          </>
        ) : (
          <Text style={st.title}>뽁<Text style={{ color: C.accent }}>타이머</Text></Text>
        )}
      </View>
      <View style={{ flex: 1, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}>
        {editing ? (
          <EditorScreen key={route.id ?? 'new'} id={route.id} onClose={() => setRoute({ name: 'tabs' })} />
        ) : tab === 'workouts' ? (
          <WorkoutsScreen onEdit={(id) => setRoute({ name: 'edit', id })} onStart={(id) => setRoute({ name: 'run', id })} />
        ) : tab === 'log' ? (
          <LogScreen />
        ) : (
          <SettingsScreen />
        )}
      </View>
      {!editing && (
        <View style={[st.tabbar, { paddingBottom: insets.bottom || 8 }]}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={st.tab}>
              <Text style={{ fontSize: 21, opacity: tab === t.key ? 1 : 0.45 }}>{t.icon}</Text>
              <Text style={[st.tabTxt, tab === t.key && { color: C.text }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subTitle: { color: C.text, fontSize: 19, fontWeight: '800' },
  back: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabTxt: { color: C.muted, fontSize: 12, fontWeight: '700' },
});
