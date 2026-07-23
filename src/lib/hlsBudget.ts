'use client';
import { useEffect, useState } from 'react';

// Module-scope semaphore capping concurrent attached HLS instances across
// every video widget on the wall (camera, live TV, webcams). Over-budget
// widgets hold a frozen last-frame / poster state with a PAUSED chip until
// a slot frees up.
//
// Only the current page's widgets are mounted (DashboardDisplay renders one
// page at a time), so the real ceiling is "video tiles on the busiest page."
// A cap of 2 froze 11 of 13 tiles on the camera page as "Paused"; the wall is
// a live-video dashboard, so the budget is set high enough that every tile on
// a page streams continuously and the PAUSED state never engages in practice.
const MAX_ATTACHED_HLS = 64;

let active = 0;
const waiters = new Set<() => void>();

/** Try to take a slot. Returns true when granted. */
export function acquireHlsSlot(): boolean {
  if (active >= MAX_ATTACHED_HLS) return false;
  active += 1;
  return true;
}

/** Return a previously acquired slot and notify anyone waiting. */
export function releaseHlsSlot(): void {
  active = Math.max(0, active - 1);
  for (const notify of [...waiters]) notify();
}

/** Subscribe to slot-freed events; returns an unsubscribe function. */
export function onHlsSlotFreed(listener: () => void): () => void {
  waiters.add(listener);
  return () => { waiters.delete(listener); };
}

/** Currently attached HLS instance count (for debugging). */
export function attachedHlsCount(): number {
  return active;
}

/**
 * React binding: acquires a slot when `wanted` is true and holds it for the
 * component's lifetime. Returns false while over budget; the widget should
 * render its frozen poster / PAUSED state and will flip to true as soon as
 * another widget releases a slot.
 */
export function useHlsSlot(wanted = true): boolean {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!wanted) {
      setGranted(false);
      return;
    }
    let held = acquireHlsSlot();
    setGranted(held);

    let unsubscribe: (() => void) | null = null;
    if (!held) {
      unsubscribe = onHlsSlotFreed(() => {
        if (!held && acquireHlsSlot()) {
          held = true;
          setGranted(true);
          unsubscribe?.();
          unsubscribe = null;
        }
      });
    }

    return () => {
      unsubscribe?.();
      if (held) releaseHlsSlot();
      setGranted(false);
    };
  }, [wanted]);

  return granted;
}
