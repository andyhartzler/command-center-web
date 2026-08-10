'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { useHlsSlot } from '@/lib/hlsBudget';
import { useStreamGuard } from '@/lib/streamGuard';
import type { CameraConfig, WidgetStyle } from '@/types/widget';

interface CameraWidgetProps {
  config: CameraConfig;
  style: WidgetStyle;
}

export function CameraWidget({ config }: CameraWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State-based remount: bumping the counter re-keys the <video> element and
  // re-runs the attach effect, replacing the old hlsrestart custom-event hack.
  const [instance, setInstance] = useState(0);
  // Drives the 400ms fade-from-black on the first playing event per URL
  const [hasPlayed, setHasPlayed] = useState(false);

  const slotGranted = useHlsSlot(!!config.url);

  // Reset the first-frame fade whenever the source changes
  useEffect(() => {
    setHasPlayed(false);
  }, [config.url]);

  const scheduleRestart = useCallback((delayMs: number) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      setInstance(i => i + 1);
    }, delayMs);
  }, []);

  const seekToLive = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !hls) return;
    if (video.buffered.length > 0) {
      const liveEdge = video.buffered.end(video.buffered.length - 1);
      video.currentTime = liveEdge - 0.5;
    }
    video.play().catch(() => {});
  }, []);

  // First-frame fade trigger
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !config.url || !slotGranted) return;
    const onPlaying = () => setHasPlayed(true);
    video.addEventListener('playing', onPlaying);
    return () => video.removeEventListener('playing', onPlaying);
  }, [config.url, slotGranted, instance]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !config.url || !slotGranted) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Not LL-HLS upstream; chasing the live edge too hard causes stalls
        // when segment delivery jitters through the tunnel.
        lowLatencyMode: false,
        backBufferLength: 5,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
        liveBackBufferLength: 5,
        manifestLoadingTimeOut: 8000,
        levelLoadingTimeOut: 8000,
        fragLoadingTimeOut: 8000,
      });
      hls.loadSource(config.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = config.isMuted;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Fast path: retry in place; the stream guard escalates to a
            // full remount (with backoff) if frames still don't advance.
            setTimeout(() => {
              hls.startLoad();
              seekToLive();
            }, 3000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            // Unrecoverable: destroy and remount the player via key counter
            hls.destroy();
            hlsRef.current = null;
            scheduleRestart(5000);
          }
        }
      });
      hlsRef.current = hls;

      // Live-edge drift check (frame-advance stalls are the stream guard's
      // job; drift while playing is HLS-specific and stays here)
      driftTimerRef.current = setInterval(() => {
        if (!video || video.paused) return;
        if (video.buffered.length > 0) {
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          if (liveEdge - video.currentTime > 15) {
            seekToLive();
          }
        }
      }, 5000);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = config.url;
      video.muted = config.isMuted;
      video.play().catch(() => {});
    }

    return () => {
      if (driftTimerRef.current) {
        clearInterval(driftTimerRef.current);
        driftTimerRef.current = null;
      }
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [config.url, config.isMuted, slotGranted, instance, seekToLive, scheduleRestart]);

  // Liveness authority: OFFLINE only after sustained frame-advance failure;
  // hard recovery remounts the player and retries forever with backoff.
  const guardStatus = useStreamGuard({
    active: !!config.url && slotGranted,
    sourceKey: config.url || '',
    videoRef,
    softRecover: () => {
      hlsRef.current?.startLoad();
      seekToLive();
    },
    hardRecover: () => setInstance(i => i + 1),
  });

  if (!config.url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="type-label">No camera stream configured</span>
      </div>
    );
  }

  const paused = !slotGranted;
  // Transient connecting/reconnecting overlays are gone: the <video> fades in
  // when it starts and holds its last frame while rebuffering, so no status
  // text spams the wall. OFFLINE comes only from the stream guard after
  // sustained frame-advance failure, including a feed that played and then
  // died for good; its stale frame is dimmed so it cannot masquerade as live.
  const showOffline = !paused && guardStatus === 'down';

  return (
    <div className="relative w-full h-full bg-black">
      <video
        key={instance}
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{
          opacity: !hasPlayed ? 0 : showOffline ? 0.25 : 1,
          filter: showOffline ? 'grayscale(1)' : 'none',
          transition: 'opacity 400ms var(--ease-out), filter 400ms var(--ease-out)',
        }}
        playsInline
        muted={config.isMuted}
        autoPlay
      />

      {/* Only a genuinely offline feed shows a chip; no connecting spam */}
      {showOffline && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="glass-chip px-3 py-1.5 font-mono text-[12px] uppercase"
            style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-critical)' }}
          >
            Offline
          </span>
        </div>
      )}

      {/* Bottom-left mono label chip; live dot binds to actual playback */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div className="glass-chip flex items-center gap-2 px-2.5 py-1.5">
          {guardStatus === 'live' && !paused && (
            <span className="live-dot live-dot--live shrink-0" aria-hidden />
          )}
          <span
            className="font-mono text-[12px] uppercase"
            style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-text-2)' }}
          >
            {config.label || 'Camera'}
          </span>
        </div>
      </div>
    </div>
  );
}
