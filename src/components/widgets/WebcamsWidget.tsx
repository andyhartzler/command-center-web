'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Video, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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

        // Apply filters matching Swift logic:
        // If specific camera IDs provided, build from those
        if (!config.loadAllCameras && config.cameraIds.length > 0) {
          // Use specific cameras - build stream file from ID like Swift does
          cams = config.cameraIds.map((id, idx) => {
            // Try to find it in the API results first
            const found = cams.find(c => c.id === id);
            if (found) return found;
            // Otherwise construct like Swift does
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

        // Corridor filter - matches Swift: cam.id.hasPrefix(corridor)
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

  // Fetch stream URL for current camera
  const loadStream = useCallback(async (camera: Camera) => {
    try {
      const res = await fetch(
        `/api/webcams?action=stream&file=${encodeURIComponent(camera.streamFile)}`
      );
      if (!res.ok) throw new Error('Failed to get stream');
      const data = await res.json();
      setStreamUrl(data.streamUrl);
      setRetryCount(0);
    } catch {
      setStreamUrl(null);
    }
  }, []);

  useEffect(() => {
    if (cameras.length === 0) return;
    const camera = cameras[currentIndex];
    if (!camera) return;
    loadStream(camera);
  }, [cameras, currentIndex, loadStream]);

  // Attach HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

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
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = true;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Retry with backoff, skip after 3 failures
            if (retryCount < 3) {
              setRetryCount(prev => prev + 1);
              setTimeout(() => hls.startLoad(), 3000);
            } else if (cameras.length > 1) {
              // Skip to next camera like Swift does
              setCurrentIndex(prev => (prev + 1) % cameras.length);
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.muted = true;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, cameras.length, retryCount]);

  // Auto-rotate cameras
  const rotateNext = useCallback(() => {
    if (cameras.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % cameras.length);
  }, [cameras.length]);

  useInterval(
    rotateNext,
    cameras.length > 1 ? (config.rotateIntervalSeconds || 15) * 1000 : null
  );

  // Token refresh every 45 minutes (matches Swift: 2700s)
  useInterval(
    () => {
      if (cameras.length > 0 && cameras[currentIndex]) {
        loadStream(cameras[currentIndex]);
      }
    },
    cameras.length > 0 ? 2700_000 : null
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

  return (
    <div className="relative w-full h-full bg-black group">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

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

      {/* Bottom overlay - matches Swift: camera name in bottom-left with black bg pill */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-medium text-white/80 px-2 py-1 rounded"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            {currentCamera?.name || 'Camera'}
          </span>
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
  );
}
