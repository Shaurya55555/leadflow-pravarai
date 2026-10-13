import { useMemo, useSyncExternalStore } from "react";

const TICK_MS = 30_000;

let snapshot: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      snapshot = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (snapshot === null) snapshot = Date.now();
  return snapshot;
}

/** Current time as a Date, refreshed every 30s. Returns the epoch on the server (nothing time-dependent is prerendered). */
export function useNow(): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return useMemo(() => new Date(ms), [ms]);
}
