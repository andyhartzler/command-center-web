'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { Video, ChevronLeft, ChevronRight, RotateCw, Lock } from 'lucide-react';
import { useInterval } from '@/hooks/useInterval';
import { usePolledData } from '@/hooks/usePolledData';
import { useHlsSlot } from '@/lib/hlsBudget';
import type { WebcamConfig, WidgetStyle } from '@/types/widget';

interface Camera {
  id: string;
  name: string;
  streamFile: string;
  corridor: string;
  latitude: number;
  longitude: number;
}

interface WebcamsWidgetProps {
  config: WebcamConfig;
  style: WidgetStyle;
}

type PlaybackState = 'connecting' | 'playing' | 'reconnecting' | 'offline';

const LIST_INTERVAL = 10 * 60 * 1000;
const TOKEN_INTERVAL = 60 * 1000;

export function WebcamsWidget({ config }: WebcamsWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRotating, setIsRotating] = useState((config.viewMode || 'single') === 'rotate');
  const [playback, setPlayback] = useState<PlaybackState>('connecting');
  // Crossfade freeze frame between rotation switches
  const [freeze, setFreeze] = useState<'hidden' | 'hold' | 'fading'>('hidden');
  const videoRef = useRef<HTMLVideoElement>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const stalledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needRecreateRef = useRef(true);
  const attachedFileRef = useRef<string | null>(null);
  const hasPlayedRef = useRef(false);

  const slotGranted = useHlsSlot(true);

  // Camera list (refreshes slowly; failures keep last-good data)
  const list = usePolledData<{ cameras: Camera[] }>(
    '/api/webcams?action=list',
    { interval: LIST_INTERVAL }
  );

  // Apply filters matching Swift logic
  const cameras = useMemo(() => {
    let cams: Camera[] = list.data?.cameras || [];

    if (!config.loadAllCameras && config.cameraIds.length > 0) {
      cams = config.cameraIds.map((id, idx) => {
        const found = cams.find(c => c.id === id);
        if (found) return found;
        const name = idx < (config.cameraNames?.length || 0)
          ? config.cameraNames[idx]
          : id;
        return {
          id,
          name,
          streamFile: `customInstance/${id}-LQ.stream`,
          corridor: id,
          latitude: 0,
          longitude: 0,
        };
      });
    }

    if (config.corridorFilter.length > 0) {
      cams = cams.filter(c =>
        config.corridorFilter.some(f => c.id.startsWith(f))
      );
    }

    return cams;
  }, [list.data, config.cameraIds, config.cameraNames, config.corridorFilter, config.loadAllCameras]);

  // Reset the index only when the camera set itself changes
  const cameraSetKey = useMemo(() => cameras.map(c => c.id).join(','), [cameras]);
  useEffect(() => {
    setCurrentIndex(0);
  }, [cameraSetKey]);

  const camera = cameras.length > 0 ? cameras[currentIndex % cameras.length] : undefined;

  // Stream token: polling every 60s doubles as the proactive token refresh
  const stream = usePolledData<{ streamUrl: string; streamFile: string }>(
    camera && slotGranted
      ? `/api/webcams?action=stream&file=${encodeURIComponent(camera.streamFile)}`
      : null,
    { interval: TOKEN_INTERVAL }
  );
  const refreshStream = stream.refresh;

  // Freeze-frame snapshot of the current video for the 500ms crossfade
  const snapshotFrame = useCallback((): boolean => {
    const video = videoRef.current;
    const canvas = freezeCanvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return false;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    try {
      ctx.drawImage(video, 0, 0);
    } catch {
      return false;
    }
    return true;
  }, []);

  const switchTo = useCallback((nextIndex: number) => {
    if (snapshotFrame()) setFreeze('hold');
    setCurrentIndex(nextIndex);
  }, [snapshotFrame]);

  // Fade the freeze frame out once the next stream is actually playing
  useEffect(() => {
    if (freeze !== 'fading') return;
    const timer = setTimeout(() => setFreeze('hidden'), 520);
    return () => clearTimeout(timer);
  }, [freeze]);

  // Bind playback truth to the actual video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      hasPlayedRef.current = true;
      retryCountRef.current = 0;
      setPlayback('playing');
      setFreeze(f => (f === 'hold' ? 'fading' : f));
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
    };
    const onBuffering = () => {
      setPlayback(hasPlayedRef.current ? 'reconnecting' : 'connecting');
      // If the stall lasts 8 seconds, force a fresh stream token + player
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
      stalledTimerRef.current = setTimeout(() => {
        needRecreateRef.current = true;
        refreshStream();
      }, 8000);
    };
    const onTimeUpdate = () => {
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onBuffering);
    video.addEventListener('stalled', onBuffering);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onBuffering);
      video.removeEventListener('stalled', onBuffering);
      video.removeEventListener('timeupdate', onTimeUpdate);
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
    };
  }, [refreshStream]);

  // Reset playback truth when the camera changes
  useEffect(() => {
    hasPlayedRef.current = false;
    retryCountRef.current = 0;
    setPlayback('connecting');
  }, [camera?.streamFile]);

  // Attach / refresh the HLS player from polled stream tokens
  useEffect(() => {
    const video = videoRef.current;
    const url = stream.data?.streamUrl;
    const file = stream.data?.streamFile;
    // Ignore tokens that belong to a previously selected camera
    if (!video || !url || !file || !camera || file !== camera.streamFile || !slotGranted) return;

    const cameraChanged = attachedFileRef.current !== file;

    if (hlsRef.current && !cameraChanged && !needRecreateRef.current) {
      // Token refresh only: swap the source on the live instance
      hlsRef.current.loadSource(url);
      return;
    }

    needRecreateRef.current = false;
    attachedFileRef.current = file;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 15,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = true;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, errData) => {
        if (errData.fatal) {
          if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Token likely expired: visibly reconnect with a fresh URL
            if (retryCountRef.current < 5) {
              retryCountRef.current++;
              needRecreateRef.current = true;
              setPlayback(hasPlayedRef.current ? 'reconnecting' : 'offline');
              refreshStream();
            } else {
              // Let the 60s token poll keep retrying in the background
              setPlayback('offline');
              needRecreateRef.current = true;
            }
          } else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setPlayback(hasPlayedRef.current ? 'reconnecting' : 'connecting');
            hls.recoverMediaError();
          }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.muted = true;
      video.play().catch(() => {});
    }
  }, [stream.data, camera, slotGranted, refreshStream]);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Auto-rotate cameras (only when in rotate mode)
  const rotateNext = useCallback(() => {
    if (cameras.length <= 1 || !isRotating) return;
    switchTo((currentIndex + 1) % cameras.length);
  }, [cameras.length, isRotating, currentIndex, switchTo]);

  useInterval(
    rotateNext,
    isRotating && cameras.length > 1 ? (config.rotateIntervalSeconds || 15) * 1000 : null
  );

  const goNext = () => {
    if (cameras.length <= 1) return;
    switchTo((currentIndex + 1) % cameras.length);
  };

  const goPrev = () => {
    if (cameras.length <= 1) return;
    switchTo((currentIndex - 1 + cameras.length) % cameras.length);
  };

  if (!list.data && list.phase === 'loading') {
    // Loading the camera list: plain black, no "Connecting" text spam.
    return <div className="w-full h-full bg-black" />;
  }

  if (!list.data) {
    // Never got a camera list; polling continues in the background
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Video size={20} style={{ color: 'var(--color-text-3)' }} />
        <span
          className="glass-chip px-3 py-1.5 font-mono text-[12px] uppercase"
          style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-critical)' }}
        >
          Offline
        </span>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Video size={24} style={{ color: 'var(--color-text-3)' }} />
        <span className="type-label">No cameras available</span>
      </div>
    );
  }

  const paused = !slotGranted;
  // Connecting/reconnecting overlays removed to keep the wall clean; only a
  // genuinely offline cam (never played) shows a chip.
  const showOffline = !paused && playback === 'offline' && !hasPlayedRef.current;

  // Check if this is a KC Scout camera (has corridorFilter or known scout IDs)
  const isScout = config.corridorFilter.length > 0 || cameras.some(c => c.streamFile.includes('customInstance'));
  const scoutTransform = isScout
    ? { transform: 'scale(1.08)', transformOrigin: 'center 55%' }
    : undefined;

  return (
    <div className="relative w-full h-full bg-black group overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={scoutTransform}
        playsInline
        muted
        autoPlay
      />
      {/* Freeze frame of the previous camera, crossfaded out over 500ms */}
      <canvas
        ref={freezeCanvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          ...scoutTransform,
          opacity: freeze === 'hold' ? 1 : 0,
          transition: freeze === 'fading' ? 'opacity 500ms var(--ease-in-out)' : 'none',
          visibility: freeze === 'hidden' ? 'hidden' : 'visible',
        }}
      />
      {/* Gradient overlays to hide Scout camera info bars and logo */}
      {isScout && (
        <>
          <div className="absolute inset-x-0 top-0 h-[18%] pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-[12%] pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }} />
          <div className="absolute top-0 left-0 w-[25%] h-[25%] pointer-events-none" style={{ background: 'radial-gradient(ellipse at top left, rgba(0,0,0,0.85) 0%, transparent 70%)' }} />
        </>
      )}

      {/* Only a genuinely offline cam shows a chip; no connecting spam */}
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

      {/* Navigation arrows - visible on hover */}
      {cameras.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full glass-chip flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-125"
          >
            <ChevronLeft size={14} style={{ color: 'var(--color-text-2)' }} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full glass-chip flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-125"
          >
            <ChevronRight size={14} style={{ color: 'var(--color-text-2)' }} />
          </button>
        </>
      )}

      {/* Top-right: rotate/lock toggle */}
      {cameras.length > 1 && (
        <button
          onClick={() => setIsRotating(prev => !prev)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full glass-chip flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:brightness-125"
          title={isRotating ? 'Stop rotating (lock view)' : 'Start rotating cameras'}
        >
          {isRotating ? (
            <RotateCw size={12} style={{ color: 'var(--color-accent-400)' }} />
          ) : (
            <Lock size={11} style={{ color: 'var(--color-text-2)' }} />
          )}
        </button>
      )}

      {/* Bottom-left mono label chip; live dot binds to actual playback */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[80%]">
        <div className="glass-chip flex items-center gap-2 px-2.5 py-1.5 min-w-0">
          {playback === 'playing' && !paused && (
            <span className="live-dot live-dot--live shrink-0" aria-hidden />
          )}
          <span
            className="font-mono text-[12px] uppercase truncate"
            style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-text-2)' }}
          >
            {camera?.name || 'Camera'}
          </span>
        </div>
      </div>

      {/* Bottom-right: rotation + position */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        {isRotating && (
          <span
            className="glass-chip px-2 py-1 font-mono text-[12px] uppercase"
            style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-accent-400)' }}
          >
            Auto
          </span>
        )}
        {cameras.length > 1 && (
          <span
            className="glass-chip px-2 py-1 font-mono text-[12px]"
            style={{ color: 'var(--color-text-3)' }}
          >
            {currentIndex + 1}/{cameras.length}
          </span>
        )}
      </div>
    </div>
  );
}
