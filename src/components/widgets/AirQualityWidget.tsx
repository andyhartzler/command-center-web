'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
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
    const interval = setInterval(fetchData, 300_000); // 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!data || data.aqi === null) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const { label, color, bg } = getAqiCategory(data.aqi);
  const isMedium = dims.w > 220;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col p-4 gap-3">
      {/* AQI display */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: bg }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>
            {data.aqi}
          </span>
        </div>
        <span className="text-[10px] font-medium text-center leading-tight" style={{ color }}>
          {label}
        </span>
        <span className="text-[9px] text-white/25 uppercase tracking-wider">US AQI</span>
      </div>

      {/* Pollutant details (medium size) */}
      {isMedium && (
        <div className="grid grid-cols-3 gap-2">
          <PollutantCell label="PM2.5" value={data.pm2_5} unit="ug/m3" />
          <PollutantCell label="PM10" value={data.pm10} unit="ug/m3" />
          <PollutantCell label="O3" value={data.ozone} unit="ug/m3" />
        </div>
      )}
    </div>
  );
}

function PollutantCell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-white/[0.03] rounded-lg py-1.5 px-1">
      <span className="text-[9px] text-white/25 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-medium text-white/60 tabular-nums">
        {value !== null ? value.toFixed(1) : '--'}
      </span>
      <span className="text-[8px] text-white/15">{unit}</span>
    </div>
  );
}
