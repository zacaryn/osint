import { useEffect, useState } from "react";

/**
 * One shared second-tick for every "updated Ns ago" readout, so a screen full
 * of freshness chips costs a single interval instead of one per component.
 */
const listeners = new Set<(now: number) => void>();
let handle: ReturnType<typeof setInterval> | null = null;

function start(): void {
  if (handle) return;
  handle = setInterval(() => {
    const now = Date.now();
    for (const listener of listeners) listener(now);
  }, 1000);
}

function stop(): void {
  if (handle && listeners.size === 0) {
    clearInterval(handle);
    handle = null;
  }
}

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    listeners.add(setNow);
    start();
    return () => {
      listeners.delete(setNow);
      stop();
    };
  }, []);

  return now;
}
