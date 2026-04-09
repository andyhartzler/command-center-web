'use client';
import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import type { CameraConfig, WidgetStyle } from '@/types/widget';

interface CameraWidgetProps {
  config: CameraConfig;
  style: WidgetStyle;
}

export function CameraWidget({ config }: CameraWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !config.url) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 5,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
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
            setTimeout(() => {
              hls.startLoad();
              seekToLive();
            }, 3000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            // Unrecoverable - full restart
            hls.destroy();
            hlsRef.current = null;
            setTimeout(() => {
              if (videoRef.current) {
                // Re-trigger the effect by dispatching a rebuild
                videoRef.current.dispatchEvent(new Event('hlsrestart'));
              }
            }, 5000);
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [config.url, config.isMuted, seekToLive]);

  if (!config.url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs text-white/30">No camera URL configured</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted={config.isMuted}
        autoPlay
      />

      {/* Label overlay - matches Swift: bottom-left capsule pill with ultraThinMaterial */}
      <div className="absolute bottom-3 left-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="w-[5px] h-[5px] rounded-full bg-red-500/80" />
          <span
            className="text-[9px] font-medium text-white/80 uppercase"
            style={{ letterSpacing: '1px' }}
          >
            {config.label || 'Camera'}
          </span>
        </div>
      </div>
    </div>
  );
}
