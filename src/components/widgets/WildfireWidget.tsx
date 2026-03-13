'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppleMap } from '@/hooks/useAppleMap';
import type { WildfireConfig, WidgetStyle } from '@/types/widget';

interface WildfireData {
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acqDate: string;
  acqTime: string;
  frp: number;
}

interface WildfireWidgetProps {
  config: WildfireConfig;
  style: WidgetStyle;
}

function getBrightnessColor(brightness: number): string {
  if (brightness < 340) return '#facc15';
  if (brightness < 400) return '#f97316';
  return '#ef4444';
}

function getBrightnessRadius(brightness: number): number {
  return Math.max(3, Math.min(10, (brightness - 300) / 20));
}

export function WildfireWidget({ config }: WildfireWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [fires, setFires] = useState<WildfireData[]>([]);
  const [loading, setLoading] = useState(true);
  const dataFetchedRef = useRef(false);

  const center: [number, number] = config.region === 'us' ? [39.5, -98.35] : [20, 0];
  const zoom = config.region === 'us' ? 4 : 2;

  const { isReady, addDotAnnotation, clearAnnotations } = useAppleMap(mapRef, {
    center,
    zoom,
  });

  const updateMarkers = useCallback((data: WildfireData[]) => {
    if (!isReady()) return;
    clearAnnotations();

    data.forEach((fire) => {
      const color = getBrightnessColor(fire.brightness);
      const radius = getBrightnessRadius(fire.brightness);

      const confDisplay = fire.confidence === 'high' || fire.confidence === 'h'
        ? 'High'
        : fire.confidence === 'nominal' || fire.confidence === 'n'
          ? 'Nominal'
          : fire.confidence === 'low' || fire.confidence === 'l'
            ? 'Low'
            : fire.confidence;

      addDotAnnotation(fire.lat, fire.lon, {
        color,
        radius,
        opacity: 0.7,
        popupHtml: `<div style="font-family: system-ui; font-size: 11px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(249, 115, 22, 0.2);">
          <div style="font-weight: 700; font-size: 13px; color: ${color};">${fire.brightness.toFixed(1)}K</div>
          <div style="color: rgba(255,255,255,0.5); margin-top: 2px;">${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}</div>
          <div style="margin-top: 4px; display: flex; gap: 8px; color: rgba(255,255,255,0.6);">
            <span>Confidence: ${confDisplay}</span>
          </div>
          ${fire.frp > 0 ? `<div style="color: rgba(255,255,255,0.5); margin-top: 2px;">FRP: ${fire.frp.toFixed(1)} MW</div>` : ''}
          ${fire.acqDate ? `<div style="color: rgba(255,255,255,0.3); margin-top: 2px;">${fire.acqDate} ${fire.acqTime}</div>` : ''}
        </div>`,
      });
    });
  }, [isReady, clearAnnotations, addDotAnnotation]);

  const fetchData = useCallback(async () => {
    if (dataFetchedRef.current) return;
    try {
      const res = await fetch('/api/wildfires');
      if (!res.ok) return;
      const data: WildfireData[] = await res.json();
      setFires(data);
      updateMarkers(data);
      dataFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch wildfires:', err);
    } finally {
      setLoading(false);
    }
  }, [updateMarkers]);

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
          Wildfires
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🔥</span>
          <span className="text-[11px] font-medium text-white/70">
            {loading ? '--' : fires.length.toLocaleString()} active (24h)
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-yellow-400" />
            <span className="text-[8px] text-white/40">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-orange-400" />
            <span className="text-[8px] text-white/40">Med</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-red-500" />
            <span className="text-[8px] text-white/40">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
