import { requireOptionalNativeModule } from 'expo-modules-core';

type TimerServiceModule = {
  start(title: string, text: string): boolean;
  update(title: string, text: string): void;
  stop(): void;
  addListener(event: 'onTick', listener: () => void): { remove: () => void };
};

/** Android-only foreground service that keeps the workout clock running with the screen off. */
export default requireOptionalNativeModule<TimerServiceModule>('TimerService');
