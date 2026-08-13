'use client';
import { useRef, useLayoutEffect, useState, type CSSProperties } from 'react';

// Single-line text that SHRINKS to fit its container instead of truncating.
// The wall bans the "…" ellipsis, so titles/labels scale their font down to
// whatever fits on one line, down to a floor. The box never grows; only the
// text size gives.

interface FitTextProps {
  children: string;
  className?: string;
  style?: CSSProperties;
  /** never shrink below this fraction of the natural size (default 0.6) */
  minScale?: number;
  /** center the text (and scale from center) instead of left-aligning */
  center?: boolean;
}

export function FitText({ children, className, style, minScale = 0.6, center = false }: FitTextProps) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const t = text.current;
      if (!b || !t) return;
      const avail = b.clientWidth;
      const needed = t.scrollWidth;
      if (needed > 0 && avail > 0 && needed > avail) {
        setScale(Math.max(minScale, avail / needed));
      } else {
        setScale(1);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [children, minScale]);

  return (
    <span
      ref={box}
      className={className}
      style={{
        ...style,
        display: 'block',
        overflow: 'hidden',
        minWidth: 0,
        textAlign: center ? 'center' : undefined,
      }}
    >
      <span
        ref={text}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          transform: `scale(${scale})`,
          transformOrigin: center ? 'center' : 'left center',
        }}
      >
        {children}
      </span>
    </span>
  );
}
