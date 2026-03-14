'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Wind } from 'lucide-react';
import type { AirQualityConfig, WidgetStyle } from '@/types/widget';

interface AirQualityData {
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  co: number | null;
  no2: number | null;
  so2: number | null;
}

function getAqiCategory(aqi: number): { label: string; color: string; bg: string } {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
  if (aqi <= 150) return { label: 'USG', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' };
  return { label: 'Hazardous', color: '#991b1b', bg: 'rgba(153,27,27,0.2)' };
}

interface Props {
  config: AirQualityConfig;
  style: WidgetStyle;
}

export function AirQualityWidget({ config }: Props) {
  const [data, setData] = useState<AirQualityData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 300, h: 100 });
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-scale content to fill container
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (cw === 0 || ch === 0 || w === 0 || h === 0) return;
    setScale(Math.min(w / cw, h / ch) * 0.92);
  }, [dims, data]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/airquality?lat=${config.latitude}&lon=${config.longitude}`);
      if (!res.ok) return;
      const json: AirQualityData = await res.json();
      setData(json);
    } catch (err) {
      console.error('[AirQualityWidget] fetch error', err);
    }
  }, [config.latitude, config.longitude]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!data || data.aqi === null) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const { label, color, bg } = getAqiCategory(data.aqi);
  const isWide = dims.w > dims.h * 2.5;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {isWide ? (
        <div
          ref={contentRef}
          className="absolute left-1/2 top-1/2 flex flex-col"
          style={{
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center center',
            whiteSpace: 'nowrap',
            gap: '6px',
            opacity: scale > 0 ? 1 : 0,
          }}
        >
          {/* Row 1: label left, badge right */}
          <div className="flex items-center justify-between" style={{ gap: '24px' }}>
            <div className="flex items-center" style={{ gap: '6px' }}>
              <Wind size={14} style={{ color, flexShrink: 0 }} />
              <span className="font-semibold text-white/90" style={{ fontSize: '11px', lineHeight: 1 }}>Air Quality</span>
            </div>
            <div className="flex items-center" style={{ gap: '6px' }}>
              <div
                className="flex items-center justify-center"
                style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: bg }}
              >
                <span className="font-bold tabular-nums" style={{ color, fontSize: '14px', lineHeight: 1 }}>{data.aqi}</span>
              </div>
              <span className="font-semibold" style={{ color, fontSize: '11px', lineHeight: 1 }}>{label}</span>
            </div>
          </div>

          {/* Row 2: pollutant boxes */}
          <div className="flex" style={{ gap: '5px' }}>
            <PollutantBox label="PM2.5" value={data.pm2_5} />
            <PollutantBox label="PM10" value={data.pm10} />
            <PollutantBox label="O₃" value={data.ozone} />
            <PollutantBox label="CO" value={data.co} />
            <PollutantBox label="NO₂" value={data.no2} />
            <PollutantBox label="SO₂" value={data.so2} />
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          className="absolute left-1/2 top-1/2 flex flex-col items-center"
          style={{
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center center',
            whiteSpace: 'nowrap',
            gap: '6px',
            opacity: scale > 0 ? 1 : 0,
          }}
        >
          {/* Header */}
          <div className="flex items-center" style={{ gap: '6px' }}>
            <Wind size={12} style={{ color }} />
            <span className="font-semibold text-white/90" style={{ fontSize: '10px', lineHeight: 1 }}>Air Quality</span>
          </div>

          {/* AQI badge */}
          <div
            className="flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: bg }}
          >
            <span className="font-bold tabular-nums" style={{ color, fontSize: '20px', lineHeight: 1 }}>{data.aqi}</span>
          </div>
          <span className="font-medium text-center" style={{ color, fontSize: '9px', lineHeight: 1 }}>{label}</span>

          {/* Pollutant grid */}
          <div className="grid grid-cols-3" style={{ gap: '5px' }}>
            <PollutantBox label="PM2.5" value={data.pm2_5} />
            <PollutantBox label="PM10" value={data.pm10} />
            <PollutantBox label="O₃" value={data.ozone} />
          </div>
        </div>
      )}
    </div>
  );
}

function PollutantBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      className="flex flex-col items-center bg-white/[0.04] rounded-md"
      style={{ padding: '3px 6px', gap: '1px' }}
    >
      <span className="text-white/30 uppercase" style={{ fontSize: '7px', letterSpacing: '0.5px', lineHeight: 1 }}>{label}</span>
      <span className="font-semibold text-white/70 tabular-nums" style={{ fontSize: '12px', lineHeight: 1 }}>
        {value !== null ? value.toFixed(1) : '--'}
      </span>
    </div>
  );
}
