// Moments bus: widgets publish rare, meaningful real-world transitions and
// the MomentLayer at the display root renders at most one at a time.

export type MomentType =
  | 'aircraft.departed'
  | 'aircraft.landed'
  | 'game.live'
  | 'game.won'
  | 'quake.major'
  | 'incident.critical'
  | 'faa.groundstop';

export interface Moment {
  type: MomentType;
  /** id of the source widget so MomentLayer can locate and glow it */
  widgetId: string;
  /** short headline rendered in the moment strip */
  headline: string;
  /** page index to auto-navigate to for high-priority moments */
  pageIndex?: number;
  /** high priority moments auto-navigate the display for 90s */
  priority?: 'normal' | 'high';
  firedAt: number;
}

type Listener = (moment: Moment) => void;

const listeners = new Set<Listener>();
const recentKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5 * 60_000;

export function publishMoment(moment: Omit<Moment, 'firedAt'>): void {
  // Dedupe identical moments fired in a tight window (poll jitter)
  const key = `${moment.type}:${moment.widgetId}:${moment.headline}`;
  const last = recentKeys.get(key);
  const now = Date.now();
  if (last && now - last < DEDUPE_WINDOW_MS) return;
  recentKeys.set(key, now);
  for (const [k, t] of recentKeys) {
    if (now - t > DEDUPE_WINDOW_MS) recentKeys.delete(k);
  }

  const full: Moment = { ...moment, firedAt: now };
  for (const fn of listeners) fn(full);
}

export function subscribeMoments(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
