'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppleMap } from '@/hooks/useAppleMap';
import type { ConflictConfig, WidgetStyle } from '@/types/widget';

interface ConflictData {
  name: string;
  lat: number;
  lon: number;
  tone: number;
  urlCount: number;
}

interface ConflictWidgetProps {
  config: ConflictConfig;
  style: WidgetStyle;
}

function createPulsingElement(): HTMLElement {
  const el = document.createElement('div');
  el.style.position = 'relative';
  el.style.width = '16px';
  el.style.height = '16px';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div style="
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 8px; height: 8px; border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
    "></div>
    <div style="
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 16px; height: 16px; border-radius: 50%;
      border: 1.5px solid rgba(239, 68, 68, 0.6);
      animation: conflictPulse 2s ease-out infinite;
    "></div>
  `;
  return el;
}

export function ConflictWidget({ config }: ConflictWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<ConflictData[]>([]);
  const [loading, setLoading] = useState(true);
  const dataFetchedRef = useRef(false);
  const annotationsRef = useRef<mapkit.Annotation[]>([]);

  const { map, isReady } = useAppleMap(mapRef, {
    center: [25, 30],
    zoom: 2,
  });

  const updateMarkers = useCallback((data: ConflictData[]) => {
    const m = map.current;
    if (!m) return;

    if (annotationsRef.current.length > 0) {
      m.removeAnnotations(annotationsRef.current);
    }
    annotationsRef.current = [];

    data.forEach((event) => {
      const cleanName = event.name
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      const displayName = cleanName.length > 80 ? cleanName.substring(0, 80) + '...' : cleanName;

      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(event.lat, event.lon),
        () => createPulsingElement(),
        {
          anchorOffset: { x: 0, y: 0 },
          callout: {
            calloutContentForAnnotation: () => {
              const el = document.createElement('div');
              el.innerHTML = `<div style="font-family: system-ui; font-size: 11px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); max-width: 240px;">
                <div style="font-weight: 600; font-size: 12px; color: #fca5a5; line-height: 1.3;">${displayName}</div>
                <div style="color: rgba(255,255,255,0.4); margin-top: 4px; font-size: 10px;">
                  ${event.lat.toFixed(2)}, ${event.lon.toFixed(2)}
                </div>
              </div>`;
              return el;
            },
          },
        }
      );

      m.addAnnotation(annotation);
      annotationsRef.current.push(annotation);
    });
  }, [map]);

  const fetchData = useCallback(async () => {
    if (dataFetchedRef.current) return;
    try {
      const res = await fetch(`/api/conflicts?max=${config.maxEvents}`);
      if (!res.ok) return;
      const data: ConflictData[] = await res.json();
      setEvents(data);
      updateMarkers(data);
      dataFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch conflicts:', err);
    } finally {
      setLoading(false);
    }
  }, [config.maxEvents, updateMarkers]);

  useEffect(() => {
    const check = setInterval(() => {
      if (isReady()) {
        fetchData();
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, [isReady, fetchData]);

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
          Conflict Monitor
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full bg-red-500" />
          <span className="text-[11px] font-medium text-white/70">
            {loading ? '--' : events.length} events (24h)
          </span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes conflictPulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
