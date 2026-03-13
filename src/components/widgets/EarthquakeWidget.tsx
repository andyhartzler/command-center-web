'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppleMap } from '@/hooks/useAppleMap';
import type { EarthquakeConfig, WidgetStyle } from '@/types/widget';

interface EarthquakeData {
  id: string;
  lat: number;
  lon: number;
  mag: number;
  place: string;
  time: number;
}

interface EarthquakeWidgetProps {
  config: EarthquakeConfig;
  style: WidgetStyle;
}

function getMagColor(mag: number): string {
  if (mag >= 7) return '#ef4444';
  if (mag >= 6) return '#f97316';
  if (mag >= 5) return '#facc15';
  return '#22c55e';
}

function getMagRadius(mag: number): number {
  return Math.max(3, Math.min(12, (mag - 3) * 3));
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function EarthquakeWidget({ config }: EarthquakeWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [quakes, setQuakes] = useState<EarthquakeData[]>([]);
  const [strongest, setStrongest] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const center: [number, number] = config.region === 'us' ? [39.5, -98.35] : [20, 0];
  const zoom = config.region === 'us' ? 4 : 2;

  const { isReady, addDotAnnotation, clearAnnotations } = useAppleMap(mapRef, {
    center,
    zoom,
  });

  const updateMarkers = useCallback((data: EarthquakeData[]) => {
    if (!isReady()) return;
    clearAnnotations();

    const filtered = data
      .filter((q) => q.mag >= config.minMagnitude)
      .slice(0, config.maxQuakes);

    filtered.forEach((quake) => {
      const color = getMagColor(quake.mag);
      addDotAnnotation(quake.lat, quake.lon, {
        color,
        radius: getMagRadius(quake.mag),
        opacity: 0.7,
        popupHtml: `<div style="font-family: system-ui; font-size: 12px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="font-weight: 600; font-size: 14px; color: ${color};">M${quake.mag.toFixed(1)}</div>
          <div style="margin-top: 2px;">${quake.place}</div>
          <div style="color: rgba(255,255,255,0.5); margin-top: 2px;">${formatTimeAgo(quake.time)}</div>
        </div>`,
      });
    });
  }, [isReady, clearAnnotations, addDotAnnotation, config.minMagnitude, config.maxQuakes]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/earthquakes');
      if (!res.ok) return;
      const data: EarthquakeData[] = await res.json();
      setQuakes(data);
      const maxMag = data.length > 0 ? Math.max(...data.map((q) => q.mag)) : 0;
      setStrongest(maxMag);
      updateMarkers(data);
    } catch (err) {
      console.error('Failed to fetch earthquakes:', err);
    } finally {
      setLoading(false);
    }
  }, [updateMarkers]);

  // Fetch after map ready + poll
  useEffect(() => {
    const check = setInterval(() => {
      if (isReady()) {
        fetchData();
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, [isReady, fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (quakes.length > 0) updateMarkers(quakes);
  }, [quakes, updateMarkers]);

  const displayCount = quakes.filter((q) => q.mag >= config.minMagnitude).length;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      <div
        className="absolute top-2.5 left-2.5 z-[1000] px-2.5 py-2 rounded-lg"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="text-[9px] font-bold text-white/50 uppercase mb-1"
          style={{ letterSpacing: '3px' }}
        >
          Earthquakes
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-extralight text-white/90 tabular-nums">
            {loading ? '--' : displayCount}
          </span>
          <span className="text-[10px] font-medium text-white/40">
            M{config.minMagnitude?.toFixed(1) || '2.5'}+ today
          </span>
        </div>
        {strongest > 0 && (
          <div className="text-[9px] text-white/35 mt-0.5 truncate max-w-[160px]">
            M{strongest.toFixed(1)} {quakes.find(q => q.mag === strongest)?.place || ''}
          </div>
        )}
      </div>

      <div
        className="absolute bottom-2 left-2 z-[1000] px-2 py-1.5 rounded-md flex items-center gap-3"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: '#facc15' }} />
          <span className="text-[9px] text-white/50">&lt;3</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f97316' }} />
          <span className="text-[9px] text-white/50">3-5</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
          <span className="text-[9px] text-white/50">&gt;5</span>
        </div>
      </div>
    </div>
  );
}
