import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_WORKOUTS, LogEntry, Settings, Workout } from './model';

type Store = {
  ready: boolean;
  workouts: Workout[];
  logs: LogEntry[];
  settings: Settings;
  setWorkouts: (f: (w: Workout[]) => Workout[]) => void;
  setLogs: (f: (l: LogEntry[]) => LogEntry[]) => void;
  setSettings: (f: (s: Settings) => Settings) => void;
};

const Ctx = createContext<Store | null>(null);
const KEY = { w: 'bboks.workouts', l: 'bboks.logs', s: 'bboks.settings' };

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [workouts, setW] = useState<Workout[]>(DEFAULT_WORKOUTS);
  const [logs, setL] = useState<LogEntry[]>([]);
  const [settings, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [w, l, s] = await AsyncStorage.multiGet([KEY.w, KEY.l, KEY.s]);
        if (w[1]) setW(JSON.parse(w[1]));
        if (l[1]) setL(JSON.parse(l[1]));
        if (s[1]) setS({ ...DEFAULT_SETTINGS, ...JSON.parse(s[1]) });
      } catch {}
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  // persist after initial load
  useEffect(() => { if (loaded.current) AsyncStorage.setItem(KEY.w, JSON.stringify(workouts)); }, [workouts]);
  useEffect(() => { if (loaded.current) AsyncStorage.setItem(KEY.l, JSON.stringify(logs)); }, [logs]);
  useEffect(() => { if (loaded.current) AsyncStorage.setItem(KEY.s, JSON.stringify(settings)); }, [settings]);

  return (
    <Ctx.Provider value={{ ready, workouts, logs, settings, setWorkouts: setW, setLogs: setL, setSettings: setS }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
