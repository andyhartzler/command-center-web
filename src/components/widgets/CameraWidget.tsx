'use client';
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { CameraConfig, WidgetStyle } from '@/types/widget';

interface CameraWidgetProps {
  config: CameraConfig;
  style: WidgetStyle;
}

export function CameraWidget({ config }: CameraWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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
        backBufferLength: 30,
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
            setTimeout(() => hls.startLoad(), 3000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = config.url;
      video.muted = config.isMuted;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [config.url, config.isMuted]);

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
