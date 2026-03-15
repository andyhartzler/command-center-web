'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Sun } from 'lucide-react';
import type { UVIndexConfig, WidgetStyle } from '@/types/widget';

interface UVData {
  uvIndex: number;
  uvCategory: string;
  peakUV: number;
  peakUVTime: string | null;
  condition: string;
  sunrise: string | null;
  sunset: string | null;
}

interface Props {
  config: UVIndexConfig;
  style: WidgetStyle;
}

interface Size {
  w: number;
  h: number;
}

function useContainerSize(): [React.RefObject<HTMLDivElement | null>, Size] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

// UV gauge segments: Low (green), Moderate (yellow), High (orange), Very High (red-orange), Extreme (purple)
const UV_SEGMENTS = [
  { label: 'LOW', range: [0, 3], color: '#22c55e' },
  { label: 'MODERATE', range: [3, 6], color: '#eab308' },
  { label: 'HIGH', range: [6, 8], color: '#f97316' },
  { label: 'VERY HIGH', range: [8, 11], color: '#ef4444' },
  { label: 'EXTREME', range: [11, 15], color: '#7c3aed' },
];

function formatTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Donut arc gauge
function UVGauge({ uvIndex, radius }: { uvIndex: number; radius: number }) {
  const strokeWidth = Math.max(radius * 0.22, 6);
  const r = radius - strokeWidth / 2;
  const cx = radius;
  const cy = radius;

  // Full donut with a gap at the bottom (270 degrees, gap from ~225deg to ~315deg)
  // Arc runs from 135deg (bottom-left) clockwise to 45deg (bottom-right) = 270deg sweep
  const gapDeg = 90; // gap size in degrees
  const arcDeg = 360 - gapDeg; // 270 degrees of arc
  const startDeg = 90 + gapDeg / 2; // start at 135deg (in SVG coords, 0=right, clockwise)
  const startRad = (startDeg * Math.PI) / 180;

  const degToXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Total UV scale: 0 to 15 (covers all categories)
  const maxUV = 15;

  // Build segment arcs
  const segmentPaths: { d: string; color: string }[] = [];
  for (const seg of UV_SEGMENTS) {
    const segStart = (seg.range[0] / maxUV) * arcDeg + startDeg;
    const segEnd = (seg.range[1] / maxUV) * arcDeg + startDeg;
    const s = degToXY(segStart);
    const e = degToXY(segEnd);
    const arcSpan = segEnd - segStart;
    const largeArc = arcSpan > 180 ? 1 : 0;
    segmentPaths.push({
      d: `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`,
      color: seg.color,
    });
  }

  // Indicator needle position
  const clampedUV = Math.min(Math.max(uvIndex, 0), maxUV);
  const needleDeg = (clampedUV / maxUV) * arcDeg + startDeg;
  const needlePos = degToXY(needleDeg);

  // Current segment color
  const currentColor = UV_SEGMENTS.find(s => uvIndex < s.range[1]) ?.color ?? UV_SEGMENTS[UV_SEGMENTS.length - 1].color;

  const fontSize = Math.max(radius * 0.5, 16);

  // Place labels on segments
  const labelElements = UV_SEGMENTS.map(seg => {
    const midUV = (seg.range[0] + seg.range[1]) / 2;
    const labelDeg = (midUV / maxUV) * arcDeg + startDeg;
    const labelR = r + strokeWidth / 2 + Math.max(radius * 0.12, 6);
    const lx = cx + labelR * Math.cos((labelDeg * Math.PI) / 180);
    const ly = cy + labelR * Math.sin((labelDeg * Math.PI) / 180);
    // Rotate text to follow the arc
    const textAngle = labelDeg + 90;
    return (
      <text
        key={seg.label}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.25)"
        fontSize={Math.max(radius * 0.1, 5)}
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
        transform={`rotate(${textAngle}, ${lx}, ${ly})`}
      >
        {seg.label}
      </text>
    );
  });

  const svgSize = radius * 2;

  return (
    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
      {/* Background track */}
      {segmentPaths.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="butt" opacity={0.3} />
      ))}
      {/* Filled segments up to current value */}
      {segmentPaths.map((seg, i) => {
        const s = UV_SEGMENTS[i];
        if (uvIndex <= s.range[0]) return null;
        const fillEnd = Math.min(uvIndex, s.range[1]);
        const segStartDeg = (s.range[0] / maxUV) * arcDeg + startDeg;
        const segEndDeg = (fillEnd / maxUV) * arcDeg + startDeg;
        const sPos = degToXY(segStartDeg);
        const ePos = degToXY(segEndDeg);
        const arcSpan = segEndDeg - segStartDeg;
        if (arcSpan < 0.5) return null;
        const largeArc = arcSpan > 180 ? 1 : 0;
        return (
          <path
            key={`fill-${i}`}
            d={`M ${sPos.x} ${sPos.y} A ${r} ${r} 0 ${largeArc} 1 ${ePos.x} ${ePos.y}`}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        );
      })}
      {/* Needle dot */}
      <circle cx={needlePos.x} cy={needlePos.y} r={strokeWidth * 0.45} fill={currentColor} stroke="#000" strokeWidth={1.5} />
      {/* Labels */}
      {labelElements}
      {/* Center value */}
      <text
        x={cx}
        y={cy - radius * 0.05}
        textAnchor="middle"
        dominantBaseline="central"
        fill={currentColor}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {uvIndex.toFixed(1)}
      </text>
    </svg>
  );
}

export function UVIndexWidget({ config, style: _style }: Props) {
  const [containerRef, size] = useContainerSize();
  const [data, setData] = useState<UVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/uv?lat=${config.latitude}&lon=${config.longitude}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err) {
      console.error('[UV] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [config.latitude, config.longitude]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300_000); // 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
        <Sun size={20} className="text-amber-400/40" />
        <span className="text-[10px] text-white/30">{error || 'No UV data'}</span>
      </div>
    );
  }

  const gaugeRadius = Math.min(size.w * 0.32, size.h * 0.42, 100);
  const compact = size.h < 180;

  // Current segment color for the header
  const catColor = UV_SEGMENTS.find(s => data.uvIndex < s.range[1])?.color ?? '#7c3aed';

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden flex items-center p-3 gap-3">
      {/* Left: Gauge */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <UVGauge uvIndex={data.uvIndex} radius={gaugeRadius} />
      </div>

      {/* Right: Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        {/* Category + condition */}
        <div>
          <div className={`${compact ? 'text-base' : 'text-lg'} font-bold`} style={{ color: catColor }}>
            {data.uvCategory} UV
          </div>
          <div className="text-[11px] text-white/40 font-medium">{data.condition}</div>
        </div>

        {/* Stats */}
        <div className={`space-y-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          <div className="flex justify-between items-center">
            <span className="text-white/40">Peak UV</span>
            <span className="font-semibold text-white/80">{data.peakUV.toFixed(1)}</span>
          </div>
          {data.peakUVTime && (
            <div className="flex justify-between items-center">
              <span className="text-white/40">Peak Time</span>
              <span className="font-semibold text-white/80">{formatTime(data.peakUVTime)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-white/40">Sunrise</span>
            <span className="font-semibold text-white/80">{formatTime(data.sunrise)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/40">Sunset</span>
            <span className="font-semibold text-white/80">{formatTime(data.sunset)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
