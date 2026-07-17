'use client';
import { useEffect, useRef, useState } from 'react';
import { TickingNumber } from '@/components/motion/TickingNumber';

// Shared 270-degree arc gauge. Geometry lives in a 100x100 viewBox so the
// gauge scales with its container; the center readout is HTML overlaid on
// the SVG. The value arc draws in over 800ms on mount via stroke-dashoffset
// while the number ticks alongside, with a one-shot glow on the arc only.

export interface ArcGaugeSegment {
  /** band start in gauge units */
  from: number;
  /** band end in gauge units */
  to: number;
  color: string;
}

interface ArcGaugeProps {
  value: number;
  min: number;
  max: number;
  /** stroke of the value arc; pass a CSS var like var(--color-ok) */
  color: string;
  /** caption rendered under the number */
  label?: string;
  /** colored bands drawn on the track, generated from a dataviz ramp */
  segments?: ArcGaugeSegment[];
  format?: (v: number) => string;
  /** stroke width in viewBox units (viewBox is 100 wide) */
  strokeWidth?: number;
  /** classes for the center number; defaults to the fluid value scale */
  valueClassName?: string;
  className?: string;
}

const VB = 100;
const CX = VB / 2;
const CY = VB / 2;
const START_DEG = 135;
const SWEEP_DEG = 270;

function polar(r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arcPath(r: number, fromFrac: number, toFrac: number): string {
  const a0 = START_DEG + SWEEP_DEG * fromFrac;
  const a1 = START_DEG + SWEEP_DEG * toFrac;
  const s = polar(r, a0);
  const e = polar(r, a1);
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

const defaultFormat = (v: number) => Math.round(v).toLocaleString();

export function ArcGauge({
  value,
  min,
  max,
  color,
  label,
  segments,
  format = defaultFormat,
  strokeWidth = 9,
  valueClassName = 'type-value',
  className = '',
}: ArcGaugeProps) {
  const span = max - min;

  // First paint renders zero; the effect then hands the real value to both
  // the dash transition (800ms) and TickingNumber so they move together.
  const [shown, setShown] = useState(min);
  useEffect(() => {
    setShown(value);
  }, [value]);
  const shownFrac = span > 0 ? clamp01((shown - min) / span) : 0;

  const r = VB / 2 - strokeWidth / 2;

  // One-shot glow on the arc only, at mount
  const arcRef = useRef<SVGPathElement>(null);
  const colorRef = useRef(color);
  colorRef.current = color;
  useEffect(() => {
    const el = arcRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const anim = el.animate(
      [
        { filter: `drop-shadow(0 0 4px ${colorRef.current})` },
        { filter: 'drop-shadow(0 0 0px transparent)' },
      ],
      { duration: 900, easing: 'ease-out' },
    );
    return () => anim.cancel();
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {segments && segments.length > 0 && span > 0 ? (
          segments.map(seg => {
            const f0 = clamp01((seg.from - min) / span);
            const f1 = clamp01((seg.to - min) / span);
            if (f1 - f0 <= 0.002) return null;
            return (
              <path
                key={`${seg.from}-${seg.to}`}
                d={arcPath(r, f0, f1)}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                opacity={0.28}
              />
            );
          })
        ) : (
          <path
            d={arcPath(r, 0, 1)}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        <path
          ref={arcRef}
          d={arcPath(r, 0, 1)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - shownFrac * 100}
          style={{ transition: 'stroke-dashoffset 800ms var(--ease-out), stroke 400ms var(--ease-out)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span style={{ color }}>
          <TickingNumber value={shown} duration={800} format={format} className={valueClassName} />
        </span>
        {label && (
          <span className="type-label mt-0.5 text-center leading-tight">{label}</span>
        )}
      </div>
    </div>
  );
}
