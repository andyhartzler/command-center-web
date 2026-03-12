'use client';

import React, { useState, useMemo } from 'react';

const MILES_PER_METER = 0.000621371;
const KM_PER_METER = 0.001;

/** Metres per pixel at a given zoom & latitude (Web Mercator). */
function metersPerPixel(zoom: number, latitude: number) {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

function fmtMetric(meters: number) {
  const km = meters * KM_PER_METER;
  return km >= 1 ? `${km.toFixed(km < 10 ? 1 : 0)} km` : `${Math.round(meters)} m`;
}

function fmtImperial(meters: number) {
  const mi = meters * MILES_PER_METER;
  return mi >= 1 ? `${mi.toFixed(mi < 10 ? 1 : 0)} mi` : `${Math.round(mi * 5280)} ft`;
}

interface GlobalScaleBarProps {
  zoom: number;
  latitude: number;
}

const BAR_WIDTH_PX = 100;

function GlobalScaleBar({ zoom, latitude }: GlobalScaleBarProps) {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('imperial');

  const label = useMemo(() => {
    const totalMeters = metersPerPixel(zoom, latitude) * BAR_WIDTH_PX;
    return unit === 'metric' ? fmtMetric(totalMeters) : fmtImperial(totalMeters);
  }, [zoom, latitude, unit]);

  return (
    <div className="absolute bottom-4 left-4 select-none">
      <div className="bg-black/50 backdrop-blur-sm rounded px-2 py-1.5 flex items-end gap-2">
        {/* Scale bar with label */}
        <div className="flex flex-col items-start">
          <span className="text-[9px] font-mono text-white/50 tracking-widest mb-0.5">
            {label}
          </span>
          <div className="flex items-end" style={{ width: BAR_WIDTH_PX }}>
            {/* Left cap */}
            <div className="w-px h-2 bg-white/50 flex-shrink-0" />
            {/* Bar */}
            <div className="flex-1 h-px bg-white/50" />
            {/* Right cap */}
            <div className="w-px h-2 bg-white/50 flex-shrink-0" />
          </div>
        </div>

        {/* Unit toggle */}
        <button
          onClick={() => setUnit(u => (u === 'metric' ? 'imperial' : 'metric'))}
          className="text-[8px] font-mono tracking-widest px-1.5 py-0.5 rounded border border-white/10 hover:border-cyan-500/50 text-white/40 hover:text-cyan-400 transition-all hover:bg-cyan-950/20 uppercase"
          title={`Switch to ${unit === 'metric' ? 'Imperial' : 'Metric'}`}
        >
          {unit === 'metric' ? 'KM' : 'MI'}
        </button>
      </div>
    </div>
  );
}

export default React.memo(GlobalScaleBar);
