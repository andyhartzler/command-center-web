'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { useHlsSlot } from '@/lib/hlsBudget';
import type { CameraConfig, WidgetStyle } from '@/types/widget';

interface CameraWidgetProps {
  config: CameraConfig;
  style: WidgetStyle;
}

type PlaybackState = 'connecting' | 'playing' | 'reconnecting' | 'offline';

export function CameraWidget({ config }: CameraWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  const hasPlayedRef = useRef(false);

  // State-based remount: bumping the counter re-keys the <video> element and
  // re-runs the attach effect, replacing the old hlsrestart custom-event hack.
  const [instance, setInstance] = useState(0);
  const [playback, setPlayback] = useState<PlaybackState>('connecting');
  // Drives the 400ms fade-from-black on the first playing event per URL
  const [hasPlayed, setHasPlayed] = useState(false);

  const slotGranted = useHlsSlot(!!config.url);

  // Reset the first-frame fade whenever the source changes
  useEffect(() => {
    setHasPlayed(false);
    hasPlayedRef.current = false;
    setPlayback('connecting');
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

  // Bind playback truth to the actual video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !config.url || !slotGranted) return;

    const onPlaying = () => {
      hasPlayedRef.current = true;
      setHasPlayed(true);
      setPlayback('playing');
    };
    const onBuffering = () => {
      setPlayback(hasPlayedRef.current ? 'reconnecting' : 'connecting');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onBuffering);
    video.addEventListener('stalled', onBuffering);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onBuffering);
      video.removeEventListener('stalled', onBuffering);
    };
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
            setPlayback(hasPlayedRef.current ? 'reconnecting' : 'offline');
            setTimeout(() => {
              hls.startLoad();
              seekToLive();
            }, 3000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setPlayback(hasPlayedRef.current ? 'reconnecting' : 'connecting');
            hls.recoverMediaError();
          } else {
            // Unrecoverable: destroy and remount the player via key counter
            hls.destroy();
            hlsRef.current = null;
            setPlayback('offline');
            scheduleRestart(5000);
          }
        }
      });
      hlsRef.current = hls;

      // Stall detection: every 5 seconds, check if playback is advancing
      stallCountRef.current = 0;
      lastTimeRef.current = 0;
      stallTimerRef.current = setInterval(() => {
        if (!video || video.paused) return;
        const currentTime = video.currentTime;
        if (currentTime === lastTimeRef.current && currentTime > 0) {
          stallCountRef.current++;
          setPlayback(hasPlayedRef.current ? 'reconnecting' : 'connecting');
          if (stallCountRef.current >= 2) {
            // Stalled for 10+ seconds, seek to live edge
            seekToLive();
            stallCountRef.current = 0;
          }
        } else {
          stallCountRef.current = 0;
        }
        lastTimeRef.current = currentTime;

        // Also check if we've drifted too far behind the live edge
        if (video.buffered.length > 0) {
          const liveEdge = video.buffered.end(video.buffered.length - 1);
          if (liveEdge - currentTime > 15) {
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
      if (stallTimerRef.current) {
        clearInterval(stallTimerRef.current);
        stallTimerRef.current = null;
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
  // text spams the wall. Only a genuinely dead feed (never played) shows one.
  const showOffline = !paused && playback === 'offline' && !hasPlayed;

  return (
    <div className="relative w-full h-full bg-black">
      <video
        key={instance}
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{
          opacity: hasPlayed ? 1 : 0,
          transition: 'opacity 400ms var(--ease-out)',
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
          {playback === 'playing' && !paused && (
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
