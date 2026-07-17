'use client';
import { useEffect, useRef, useState } from 'react';

interface TickingNumberProps {
  value: number;
  format?: (v: number) => string;
  /** flash tint on change: 'auto' colors by direction, or pass a color */
  flash?: 'auto' | string | false;
  className?: string;
  duration?: number;
}

const defaultFormat = (v: number) => v.toLocaleString();

/**
 * Tweens between values over --motion-data (600ms) with tabular numerals.
 * The rAF loop exists only during the transition.
 */
export function TickingNumber({
  value,
  format = defaultFormat,
  flash = false,
  className = '',
  duration = 600,
}: TickingNumberProps) {
  const [display, setDisplay] = useState(value);
  const [tint, setTint] = useState<string | null>(null);
  const fromRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    fromRef.current = value;

    if (flash) {
      const color = flash === 'auto'
        ? (value > from ? 'var(--color-ok)' : 'var(--color-critical)')
        : flash;
      setTint(color);
      const t = setTimeout(() => setTint(null), 400);
      // rAF tween
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(from + (value - from) * eased);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
      return () => { clearTimeout(t); cancelAnimationFrame(rafRef.current); };
    }

    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, flash]);

  return (
    <span
      className={`font-mono ${className}`}
      style={{
        fontVariantNumeric: 'tabular-nums',
        color: tint ?? undefined,
        transition: tint ? undefined : 'color 400ms var(--ease-out)',
      }}
    >
      {format(display)}
    </span>
  );
}
