'use client';
import { useEffect, useId, useRef } from 'react';

interface SparklineProps {
  /** intraday or multi-day price series, oldest first */
  data: number[];
  /** day direction: green when up, red when down */
  up: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const PAD = 1.5;

/**
 * 44x16 price sparkline. Stroke and gradient fill inherit direction color
 * via currentColor; the line draws in over 800ms on mount.
 */
export function Sparkline({ data, up, width = 44, height = 16, className = '' }: SparklineProps) {
  const gradientId = useId();
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    lineRef.current?.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 800, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    areaRef.current?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 600, delay: 250, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
  }, []);

  const values = data.filter(v => Number.isFinite(v));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = span > 0
      ? PAD + (1 - (v - min) / span) * (height - PAD * 2)
      : height / 2;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ color: up ? 'var(--color-ok)' : 'var(--color-critical)' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path ref={areaRef} d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        ref={lineRef}
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
      />
    </svg>
  );
}
