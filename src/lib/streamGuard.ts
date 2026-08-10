'use client';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// The one liveness authority for every video widget on the wall (camera,
// live TV, webcams). HLS error events lie in both directions: a stream can
// freeze without ever firing a fatal error (zombie manifests keep returning
// 200 with stale segments), and a transient token hiccup fires fatal errors
// on a stream that recovers two seconds later. So liveness here is defined by
// the only thing that cannot lie: video.currentTime advancing.
//
// Contract:
// - 'starting': no frames yet since the source changed. Render nothing extra.
// - 'live': frames are advancing. Clear all failure UI.
// - 'recovering': frames stopped; recovery ladder is running. Render nothing
//   extra (no connecting/reconnecting spam on the wall - the tile holds its
//   last frame).
// - 'down': no frames for DOWN_MS despite recovery. Widgets show OFFLINE and
//   dim the stale frame so it cannot masquerade as live.
// - Recovery never gives up. Soft recover once per stall, then hard recover
//   on an exponential backoff capped at BACKOFF_MAX_MS, forever.

export type StreamStatus = 'starting' | 'live' | 'recovering' | 'down';

export interface StreamGuardOptions {
  /** Sampling runs only while true (url present + HLS slot granted). */
  active: boolean;
  /**
   * Identity of the current source (channel URL, stream file). Changing it
   * resets the guard: fresh grace period, zeroed backoff. Recovery attempts
   * must NOT change it, or the escalation ladder resets and 'down' is never
   * reached.
   */
  sourceKey: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Cheap in-place recovery: startLoad / seek to live / play. */
  softRecover?: () => void;
  /** Full teardown: destroy player, refresh tokens/resolution, re-attach. */
  hardRecover: () => void;
}

const SAMPLE_MS = 2000;
const STALL_SOFT_MS = 8000;
const STALL_HARD_MS = 14000;
const DOWN_MS = 30000;
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_MS = 30000;

export function useStreamGuard(opts: StreamGuardOptions): StreamStatus {
  const { active, sourceKey, videoRef } = opts;
  const [status, setStatus] = useState<StreamStatus>('starting');

  // Callbacks live in a ref so the sampling loop never re-subscribes.
  const recoverRef = useRef({ soft: opts.softRecover, hard: opts.hardRecover });
  useEffect(() => {
    recoverRef.current = { soft: opts.softRecover, hard: opts.hardRecover };
  });

  useEffect(() => {
    if (!active) {
      setStatus('starting');
      return;
    }

    let lastTime = -1;
    let lastProgressAt = Date.now(); // grace starts at source change
    let everPlayed = false;
    let softTried = false;
    let hardAttempts = 0;
    let nextHardAt = 0;

    setStatus('starting');

    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || document.hidden) return;
      const now = Date.now();
      const t = video.currentTime;

      if (t > 0 && Math.abs(t - lastTime) > 0.05) {
        lastTime = t;
        lastProgressAt = now;
        everPlayed = true;
        softTried = false;
        hardAttempts = 0;
        nextHardAt = 0;
        setStatus('live');
        return;
      }
      lastTime = t;

      const stalledMs = now - lastProgressAt;
      if (stalledMs > STALL_SOFT_MS && !softTried) {
        softTried = true;
        // Autoplay hiccups leave the element paused; play() is part of any
        // soft recovery.
        video.play().catch(() => {});
        recoverRef.current.soft?.();
      }
      if (stalledMs > STALL_HARD_MS && now >= nextHardAt) {
        hardAttempts += 1;
        const backoff = Math.min(
          BACKOFF_BASE_MS * 2 ** (hardAttempts - 1),
          BACKOFF_MAX_MS
        );
        nextHardAt = now + backoff + Math.random() * 2000;
        recoverRef.current.hard();
      }
      setStatus(
        stalledMs > DOWN_MS ? 'down' : everPlayed ? 'recovering' : 'starting'
      );
    }, SAMPLE_MS);

    return () => clearInterval(timer);
  }, [active, sourceKey, videoRef]);

  return status;
}
