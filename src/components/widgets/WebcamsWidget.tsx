'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Video, ChevronLeft, ChevronRight, Loader2, RotateCw, Lock } from 'lucide-react';
import { useInterval } from '@/hooks/useInterval';
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

export function WebcamsWidget({ config }: WebcamsWidgetProps) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState((config.viewMode || 'single') === 'rotate');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval>>(null);
  const stalledTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Fetch camera list
  useEffect(() => {
    let cancelled = false;

    async function fetchCameras() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/webcams?action=list');
        if (!res.ok) throw new Error('Failed to fetch cameras');
        const data = await res.json();
        let cams: Camera[] = data.cameras || [];

        // Apply filters matching Swift logic
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

        // Corridor filter
        if (config.corridorFilter.length > 0) {
          cams = cams.filter(c =>
            config.corridorFilter.some(f => c.id.startsWith(f))
          );
        }

        if (!cancelled) {
          setCameras(cams);
          setCurrentIndex(0);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load cameras');
          setLoading(false);
        }
      }
    }

    fetchCameras();
    return () => { cancelled = true; };
  }, [config.cameraIds, config.cameraNames, config.corridorFilter, config.loadAllCameras]);

  // Fetch a fresh stream URL and load it into HLS (or create HLS if needed)
  const loadStream = useCallback(async (camera: Camera, forceRecreate = false) => {
    try {
      const res = await fetch(
        `/api/webcams?action=stream&file=${encodeURIComponent(camera.streamFile)}`
      );
      if (!res.ok) throw new Error('Failed to get stream');
      const data = await res.json();
      const url: string = data.streamUrl;
      if (!url) return;

      retryCountRef.current = 0;
      const video = videoRef.current;
      if (!video) return;

      // If HLS instance exists and we're just refreshing the token, swap the source
      if (hlsRef.current && !forceRecreate) {
        hlsRef.current.loadSource(url);
        return;
      }

      // Otherwise create a fresh HLS instance
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
              // Token likely expired - fetch a fresh stream URL
              if (retryCountRef.current < 5) {
                retryCountRef.current++;
                loadStream(camera, true);
              }
            } else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) {
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
    } catch {
      // Silently fail - token refresh will retry
    }
  }, []);

  // Load stream when camera changes
  useEffect(() => {
    if (cameras.length === 0) return;
    const camera = cameras[currentIndex];
    if (!camera) return;
    retryCountRef.current = 0;
    loadStream(camera, true); // Force recreate on camera change
  }, [cameras, currentIndex, loadStream]);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Proactive token refresh every 60 seconds
  // Uses a raw setInterval so it doesn't depend on React state
  useEffect(() => {
    if (cameras.length === 0) return;

    refreshTimerRef.current = setInterval(() => {
      const cam = cameras[currentIndex];
      if (cam) {
        loadStream(cam, false); // Swap source, don't recreate
      }
    }, 60_000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [cameras, currentIndex, loadStream]);

  // Detect stalled video and force recovery
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleStalled = () => {
      // If video stalls, give it 8 seconds then force a fresh stream
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
      stalledTimerRef.current = setTimeout(() => {
        const cam = cameras[currentIndex];
        if (cam) {
          loadStream(cam, true); // Force full recreate
        }
      }, 8000);
    };

    const handlePlaying = () => {
      // Video recovered, cancel the stall timer
      if (stalledTimerRef.current) {
        clearTimeout(stalledTimerRef.current);
        stalledTimerRef.current = null;
      }
    };

    video.addEventListener('stalled', handleStalled);
    video.addEventListener('waiting', handleStalled);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handlePlaying);

    return () => {
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('waiting', handleStalled);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handlePlaying);
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
    };
  }, [cameras, currentIndex, loadStream]);

  // Auto-rotate cameras (only when in rotate mode)
  const rotateNext = useCallback(() => {
    if (cameras.length <= 1 || !isRotating) return;
    setCurrentIndex(prev => (prev + 1) % cameras.length);
  }, [cameras.length, isRotating]);

  useInterval(
    rotateNext,
    isRotating && cameras.length > 1 ? (config.rotateIntervalSeconds || 15) * 1000 : null
  );

  const goNext = () => {
    if (cameras.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % cameras.length);
  };

  const goPrev = () => {
    if (cameras.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + cameras.length) % cameras.length);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Loader2 size={20} className="text-white/40 animate-spin" />
        <span className="text-xs text-white/30">Loading cameras...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Video size={20} className="text-white/30" />
        <span className="text-xs text-white/30">{error}</span>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Video size={24} className="text-white/[0.15]" />
        <span className="text-[11px] text-white/30">No cameras available</span>
      </div>
    );
  }

  const currentCamera = cameras[currentIndex];

  // Check if this is a KC Scout camera (has corridorFilter or known scout IDs)
  const isScout = config.corridorFilter.length > 0 || cameras.some(c => c.streamFile.includes('customInstance'));

  return (
    <div className="relative w-full h-full bg-black group overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={isScout ? { transform: 'scale(1.08)', transformOrigin: 'center 55%' } : undefined}
        playsInline
        muted
        autoPlay
      />
      {/* Gradient overlays to hide Scout camera info bars and logo */}
      {isScout && (
        <>
          <div className="absolute inset-x-0 top-0 h-[18%] pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-[12%] pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }} />
          <div className="absolute top-0 left-0 w-[25%] h-[25%] pointer-events-none" style={{ background: 'radial-gradient(ellipse at top left, rgba(0,0,0,0.85) 0%, transparent 70%)' }} />
        </>
      )}

      {/* Navigation arrows - visible on hover */}
      {cameras.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <ChevronLeft size={14} className="text-white/80" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <ChevronRight size={14} className="text-white/80" />
          </button>
        </>
      )}

      {/* Top-right: rotate/lock toggle */}
      {cameras.length > 1 && (
        <button
          onClick={() => setIsRotating(prev => !prev)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          title={isRotating ? 'Stop rotating (lock view)' : 'Start rotating cameras'}
        >
          {isRotating ? (
            <RotateCw size={12} className="text-[#6b8aab]/80" />
          ) : (
            <Lock size={11} className="text-white/60" />
          )}
        </button>
      )}

      {/* Bottom overlay - camera name + counter */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-medium text-white/80 px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            {currentCamera?.name || 'Camera'}
          </span>
          <div className="flex items-center gap-1.5">
            {isRotating && (
              <span
                className="text-[8px] text-[#6b8aab]/60 px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                AUTO
              </span>
            )}
            {cameras.length > 1 && (
              <span
                className="text-[10px] text-white/40 px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                {currentIndex + 1}/{cameras.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
