'use client';
import { useSyncExternalStore } from 'react';

// One 1Hz clock for the whole app. Every widget that needs "now" subscribes
// here instead of running its own setInterval.

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (timer || typeof window === 'undefined') return;
  timer = setInterval(() => {
    now = Date.now();
    for (const fn of listeners) fn();
  }, 1000);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  ensureTimer();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return now;
}

function getServerSnapshot() {
  return 0;
}

/** Re-renders the caller once per second with the current epoch ms. */
export function useSharedClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Format a relative age like "4m ago" from an epoch ms timestamp. */
export function formatAge(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
