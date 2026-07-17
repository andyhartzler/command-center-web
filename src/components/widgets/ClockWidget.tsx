'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedClock } from '@/hooks/useSharedClock';
import { type ClockConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: ClockConfig;
  style: WidgetStyle;
}

export function ClockWidget({ config }: Props) {
  const now = useSharedClock();
  const time = new Date(now || Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    // offsetWidth/Height ignore the transform, so this is layout size
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (cw === 0 || ch === 0 || w === 0 || h === 0) return;
    setScale(Math.min(w / cw, h / ch) * 0.92);
  }, []);

  // Observe both the container and the content: digit-count changes resize
  // the content box, so the same observer callback handles every re-measure.
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(content);
    return () => ro.disconnect();
  }, [measure]);

  const tz = config.timezone || 'America/Chicago';

  const hours = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: !config.is24Hour,
    timeZone: tz,
  }).format(time).replace(/\s*(AM|PM)$/i, '');

  const minutes = new Intl.DateTimeFormat('en-US', {
    minute: '2-digit',
    timeZone: tz,
  }).format(time).padStart(2, '0');

  const seconds = config.showSeconds
    ? new Intl.DateTimeFormat('en-US', {
        second: '2-digit',
        timeZone: tz,
      }).format(time).padStart(2, '0')
    : '';

  const period = config.is24Hour
    ? ''
    : new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: true,
        timeZone: tz,
      })
        .format(time)
        .replace(/^[\d\s]+/, '')
        .trim();

  const dateString = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  }).format(time);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <div
        ref={contentRef}
        className="absolute left-1/2 top-1/2 flex flex-col items-center"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          whiteSpace: 'nowrap',
          gap: '2px',
          opacity: scale > 0 ? 1 : 0,
        }}
      >
        {/* Location label */}
        <div
          className="font-medium uppercase"
          style={{
            letterSpacing: 'var(--tracking-caps)',
            fontSize: '12px',
            lineHeight: 1,
            color: 'var(--color-text-3)',
          }}
        >
          {config.label}
        </div>

        {/* Time */}
        <div className="flex items-baseline">
          <span
            className="font-extralight font-mono tabular-nums"
            style={{ fontSize: '72px', lineHeight: 1, color: 'var(--color-text-1)' }}
          >
            {hours}
          </span>
          <span
            className="font-extralight"
            style={{ fontSize: '64px', lineHeight: 1, position: 'relative', top: '-2px', color: 'var(--color-text-3)' }}
          >
            :
          </span>
          <span
            className="font-extralight font-mono tabular-nums"
            style={{ fontSize: '72px', lineHeight: 1, color: 'var(--color-text-1)' }}
          >
            {minutes}
          </span>
          {seconds && (
            <>
              <span
                className="font-extralight"
                style={{ fontSize: '40px', lineHeight: 1, position: 'relative', top: '-2px', color: 'var(--color-text-3)' }}
              >
                :
              </span>
              <span
                className="font-extralight font-mono tabular-nums"
                style={{ fontSize: '40px', lineHeight: 1, color: 'var(--color-text-2)' }}
              >
                {seconds}
              </span>
            </>
          )}
          {period && (
            <span
              className="font-medium"
              style={{ fontSize: '18px', marginLeft: '6px', position: 'relative', top: '-4px', color: 'var(--color-text-3)' }}
            >
              {period}
            </span>
          )}
        </div>

        {/* Date */}
        <div
          className="font-light"
          style={{ fontSize: '14px', marginTop: '2px', lineHeight: 1, color: 'var(--color-text-2)' }}
        >
          {dateString}
        </div>
      </div>
    </div>
  );
}
