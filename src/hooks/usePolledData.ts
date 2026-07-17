'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// The one polling hook for every widget. Contract:
// - never an infinite spinner after first success; failures keep last-good
//   data and flip isStale
// - pauses while document.hidden or while the widget is off the visible page
//   (pass `visible: false`), refetches immediately on return
// - adaptive cadence: pass liveInterval to poll faster while something is
//   happening (airborne aircraft, live game)

export type PollPhase = 'loading' | 'ready' | 'error';

export interface PolledData<T> {
  data: T | null;
  error: string | null;
  phase: PollPhase;
  /** true when the newest fetch attempt failed but older data is shown */
  isStale: boolean;
  /** epoch ms of the last successful fetch */
  lastUpdated: number | null;
  refresh: () => void;
}

export interface PolledOptions {
  /** poll cadence in ms */
  interval: number;
  /** faster cadence used while `live` is true */
  liveInterval?: number;
  live?: boolean;
  /** gate polling to widget visibility (page shown); defaults true */
  visible?: boolean;
  /** fetch init passed through */
  init?: RequestInit;
}

export function usePolledData<T>(url: string | null, opts: PolledOptions): PolledData<T> {
  const { interval, liveInterval, live = false, visible = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PollPhase>('loading');
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initRef = useRef(opts.init);
  initRef.current = opts.init;
  const stateRef = useRef({ live, visible, interval, liveInterval });
  stateRef.current = { live, visible, interval, liveInterval };

  const tick = useCallback(async function run(scheduleOnly = false) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const s = stateRef.current;
    const cadence = s.live && s.liveInterval ? s.liveInterval : s.interval;

    const paused = typeof document !== 'undefined' && (document.hidden || !s.visible);
    if (!scheduleOnly && !paused && url) {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      try {
        const res = await fetch(url, { ...initRef.current, signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as T;
        setData(body);
        setError(null);
        setPhase('ready');
        setIsStale(false);
        setLastUpdated(Date.now());
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
          setIsStale(true);
          setPhase(prev => (prev === 'loading' ? 'error' : prev));
        }
      }
    }
    timerRef.current = setTimeout(() => run(false), cadence);
  }, [url]);

  // Main loop
  useEffect(() => {
    if (!url) return;
    tick(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [url, tick]);

  // Immediate refetch when visibility returns or live flips
  const wasActive = useRef(visible && !live);
  useEffect(() => {
    const nowActive = visible;
    if (nowActive && !wasActive.current) tick(false);
    wasActive.current = nowActive;
  }, [visible, live, tick]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && stateRef.current.visible) tick(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [tick]);

  const refresh = useCallback(() => { tick(false); }, [tick]);

  return { data, error, phase, isStale, lastUpdated, refresh };
}
