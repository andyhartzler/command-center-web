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
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 300, h: 100 });

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
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const { label, color, bg } = getAqiCategory(data.aqi);
  const isWide = dims.w > dims.h * 2.5;

  if (isWide) {
    // Single-row wide layout. Content natural size: ~300w x 40h
    const s = Math.max(0.5, Math.min(4, Math.min(dims.w / 300, dims.h / 40)));
    const pad = 6 * s;
    const badgeSize = 32 * s;

    return (
      <div ref={containerRef} className="w-full h-full flex items-center overflow-hidden" style={{ padding: `${pad}px ${pad * 1.5}px`, gap: `${8 * s}px` }}>
        {/* Icon + label */}
        <div className="flex items-center shrink-0" style={{ gap: `${5 * s}px` }}>
          <Wind size={Math.max(8, 10 * s)} style={{ color, flexShrink: 0 }} />
          <span className="font-semibold text-white/90 whitespace-nowrap" style={{ fontSize: `${9 * s}px` }}>Air Quality</span>
        </div>

        {/* AQI badge */}
        <div className="flex items-center shrink-0" style={{ gap: `${5 * s}px` }}>
          <div className="flex items-center justify-center" style={{ width: badgeSize, height: badgeSize, borderRadius: 6 * s, backgroundColor: bg }}>
            <span className="font-bold tabular-nums" style={{ color, fontSize: `${16 * s}px` }}>{data.aqi}</span>
          </div>
          <span className="font-semibold" style={{ color, fontSize: `${9 * s}px` }}>{label}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: `${22 * s}px`, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        {/* Pollutants — minimal: just label + value, no bg/unit */}
        <div className="flex flex-1 min-w-0 justify-around">
          <PollutantInline label="PM2.5" value={data.pm2_5} s={s} />
          <PollutantInline label="PM10" value={data.pm10} s={s} />
          <PollutantInline label="O₃" value={data.ozone} s={s} />
          <PollutantInline label="CO" value={data.co} s={s} />
          <PollutantInline label="NO₂" value={data.no2} s={s} />
          <PollutantInline label="SO₂" value={data.so2} s={s} />
        </div>
      </div>
    );
  }

  // Compact/square layout. Content natural size: ~140w x 140h
  const s = Math.max(0.5, Math.min(4, Math.min(dims.w / 140, dims.h / 140)));
  const badgeSize = 40 * s;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ padding: `${8 * s}px`, gap: `${6 * s}px` }}>
      {/* Header */}
      <div className="flex items-center" style={{ gap: `${6 * s}px` }}>
        <Wind size={Math.max(8, 12 * s)} style={{ color }} />
        <span className="font-semibold text-white/90" style={{ fontSize: `${10 * s}px` }}>Air Quality</span>
      </div>

      {/* AQI */}
      <div className="flex items-center justify-center" style={{ width: badgeSize, height: badgeSize, borderRadius: 8 * s, backgroundColor: bg }}>
        <span className="font-bold tabular-nums" style={{ color, fontSize: `${20 * s}px` }}>{data.aqi}</span>
      </div>
      <span className="font-medium text-center" style={{ color, fontSize: `${9 * s}px` }}>{label}</span>

      {/* Pollutants if there's room */}
      {dims.w > 180 && dims.h > 200 && (
        <div className="grid grid-cols-3" style={{ gap: `${6 * s}px` }}>
          <PollutantCell label="PM2.5" value={data.pm2_5} unit="ug/m3" s={s} />
          <PollutantCell label="PM10" value={data.pm10} unit="ug/m3" s={s} />
          <PollutantCell label="O3" value={data.ozone} unit="ug/m3" s={s} />
        </div>
      )}
    </div>
  );
}

/** Compact inline pollutant for wide layout — no bg, no unit */
function PollutantInline({ label, value, s }: { label: string; value: number | null; s: number }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: `${1 * s}px` }}>
      <span className="text-white/25 uppercase" style={{ fontSize: `${6 * s}px`, letterSpacing: `${0.3 * s}px` }}>{label}</span>
      <span className="font-semibold text-white/70 tabular-nums" style={{ fontSize: `${10 * s}px` }}>
        {value !== null ? value.toFixed(1) : '--'}
      </span>
    </div>
  );
}

/** Card-style pollutant for compact/square layout */
function PollutantCell({ label, value, unit, s }: { label: string; value: number | null; unit: string; s: number }) {
  return (
    <div className="flex flex-col items-center bg-white/[0.04] rounded-lg" style={{ padding: `${4 * s}px ${6 * s}px`, gap: `${1 * s}px` }}>
      <span className="text-white/30 uppercase" style={{ fontSize: `${7 * s}px`, letterSpacing: `${0.5 * s}px` }}>{label}</span>
      <span className="font-semibold text-white/70 tabular-nums" style={{ fontSize: `${11 * s}px` }}>
        {value !== null ? value.toFixed(1) : '--'}
      </span>
      <span className="text-white/15" style={{ fontSize: `${6 * s}px` }}>{unit}</span>
    </div>
  );
}
