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
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 200, h: 160 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1c] rounded-2xl">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const { label, color, bg } = getAqiCategory(data.aqi);
  const isWide = dims.w > dims.h * 1.8;

  // Compute scale based on container size
  // Wide layout base: 500w x 100h. Compact layout base: 180w x 240h.
  const s = isWide
    ? Math.min(dims.w / 500, dims.h / 100)
    : Math.min(dims.w / 180, dims.h / 240);
  const sc = Math.max(0.5, Math.min(3, s));

  // Wide/horizontal layout
  if (isWide) {
    const badgeSize = Math.max(36, 56 * sc);
    const badgeRadius = Math.max(10, 16 * sc);

    return (
      <div ref={containerRef} className="w-full h-full flex flex-col bg-[#1a1a1c] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center shrink-0" style={{ gap: `${8 * sc}px`, padding: `${10 * sc}px ${12 * sc}px ${4 * sc}px` }}>
          <Wind size={Math.max(10, 14 * sc)} style={{ color }} />
          <span className="font-semibold text-white/90 tracking-wide" style={{ fontSize: `${11 * sc}px` }}>Air Quality</span>
          <span className="text-white/25 ml-auto" style={{ fontSize: `${9 * sc}px` }}>US AQI</span>
        </div>

        {/* Horizontal content */}
        <div className="flex-1 flex items-center" style={{ gap: `${16 * sc}px`, padding: `0 ${16 * sc}px ${12 * sc}px` }}>
          {/* AQI badge */}
          <div className="flex items-center shrink-0" style={{ gap: `${12 * sc}px` }}>
            <div
              className="flex items-center justify-center"
              style={{ width: badgeSize, height: badgeSize, borderRadius: badgeRadius, backgroundColor: bg }}
            >
              <span className="font-bold tabular-nums" style={{ color, fontSize: `${24 * sc}px` }}>
                {data.aqi}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * sc}px` }}>
              <span className="font-semibold" style={{ color, fontSize: `${14 * sc}px` }}>{label}</span>
              <span className="text-white/30" style={{ fontSize: `${9 * sc}px` }}>Air Quality Index</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: `${40 * sc}px`, background: 'rgba(255,255,255,0.06)' }} />

          {/* Pollutants row */}
          <div className="flex flex-1" style={{ gap: `${12 * sc}px` }}>
            <PollutantCell label="PM2.5" value={data.pm2_5} unit="ug/m3" sc={sc} />
            <PollutantCell label="PM10" value={data.pm10} unit="ug/m3" sc={sc} />
            <PollutantCell label="O3" value={data.ozone} unit="ug/m3" sc={sc} />
            <PollutantCell label="CO" value={data.co} unit="ug/m3" sc={sc} />
            <PollutantCell label="NO2" value={data.no2} unit="ug/m3" sc={sc} />
            <PollutantCell label="SO2" value={data.so2} unit="ug/m3" sc={sc} />
          </div>
        </div>
      </div>
    );
  }

  const isMedium = dims.w > 220;
  const badgeSize = Math.max(36, 56 * sc);
  const badgeRadius = Math.max(8, 12 * sc);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-[#1a1a1c] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center shrink-0" style={{ gap: `${8 * sc}px`, padding: `${10 * sc}px ${12 * sc}px ${4 * sc}px` }}>
        <Wind size={Math.max(10, 14 * sc)} style={{ color }} />
        <span className="font-semibold text-white/90 tracking-wide" style={{ fontSize: `${11 * sc}px` }}>Air Quality</span>
      </div>

      {/* AQI display */}
      <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: `${4 * sc}px`, padding: `0 ${12 * sc}px` }}>
        <div
          className="flex items-center justify-center"
          style={{ width: badgeSize, height: badgeSize, borderRadius: badgeRadius, backgroundColor: bg }}
        >
          <span className="font-bold tabular-nums" style={{ color, fontSize: `${24 * sc}px` }}>
            {data.aqi}
          </span>
        </div>
        <span className="font-medium text-center leading-tight" style={{ color, fontSize: `${10 * sc}px` }}>
          {label}
        </span>
      </div>

      {/* Pollutant details (medium size) */}
      {isMedium && (
        <div className="grid grid-cols-3" style={{ gap: `${8 * sc}px`, padding: `0 ${12 * sc}px ${12 * sc}px` }}>
          <PollutantCell label="PM2.5" value={data.pm2_5} unit="ug/m3" sc={sc} />
          <PollutantCell label="PM10" value={data.pm10} unit="ug/m3" sc={sc} />
          <PollutantCell label="O3" value={data.ozone} unit="ug/m3" sc={sc} />
        </div>
      )}
    </div>
  );
}

function PollutantCell({ label, value, unit, sc }: { label: string; value: number | null; unit: string; sc: number }) {
  return (
    <div
      className="flex flex-col items-center bg-white/[0.03] rounded-lg"
      style={{ gap: `${2 * sc}px`, padding: `${6 * sc}px ${4 * sc}px` }}
    >
      <span className="text-white/25 uppercase tracking-wider" style={{ fontSize: `${9 * sc}px` }}>{label}</span>
      <span className="font-medium text-white/60 tabular-nums" style={{ fontSize: `${12 * sc}px` }}>
        {value !== null ? value.toFixed(1) : '--'}
      </span>
      <span className="text-white/15" style={{ fontSize: `${8 * sc}px` }}>{unit}</span>
    </div>
  );
}
