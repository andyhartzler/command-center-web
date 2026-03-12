'use client';

import React from 'react';
import { Ruler, X } from 'lucide-react';

interface MeasurePoint {
  lat: number;
  lng: number;
}

interface Props {
  active: boolean;
  points: MeasurePoint[];
  onClear: () => void;
  onDeactivate: () => void;
}

// Haversine distance in km
function haversineDistance(p1: MeasurePoint, p2: MeasurePoint): number {
  const R = 6371; // Earth radius km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km (${(km * 0.539957).toFixed(1)} nm)`;
  return `${Math.round(km).toLocaleString()} km (${Math.round(km * 0.539957).toLocaleString()} nm)`;
}

function bearing(p1: MeasurePoint, p2: MeasurePoint): number {
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export function GlobalMeasureTool({ active, points, onClear, onDeactivate }: Props) {
  if (!active) return null;

  const totalDist = points.length >= 2
    ? points.slice(1).reduce((acc, p, i) => acc + haversineDistance(points[i], p), 0)
    : 0;

  const lastBearing = points.length >= 2
    ? bearing(points[points.length - 2], points[points.length - 1])
    : 0;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Ruler size={14} className="text-cyan-400" />
          <span className="text-[10px] text-cyan-400 font-mono tracking-widest">MEASURE MODE</span>
        </div>

        {points.length === 0 && (
          <span className="text-[10px] text-white/40 font-mono">Click map to set first point</span>
        )}

        {points.length === 1 && (
          <span className="text-[10px] text-white/40 font-mono">
            Start: {points[0].lat.toFixed(4)}°, {points[0].lng.toFixed(4)}° — Click for endpoint
          </span>
        )}

        {points.length >= 2 && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/80 font-mono font-bold">
              {formatDistance(totalDist)}
            </span>
            <span className="text-[9px] text-white/30 font-mono">
              BRG {lastBearing.toFixed(1)}°
            </span>
            <span className="text-[9px] text-white/30 font-mono">
              {points.length} pts
            </span>
          </div>
        )}

        {points.length > 0 && (
          <button onClick={onClear} className="text-[9px] text-white/30 hover:text-white/50 font-mono tracking-widest">
            RESET
          </button>
        )}

        <button onClick={onDeactivate} className="text-white/30 hover:text-red-400 transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export { haversineDistance, formatDistance };
export type { MeasurePoint };
