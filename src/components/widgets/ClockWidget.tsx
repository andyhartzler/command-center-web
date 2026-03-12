'use client';
import { useState, useEffect, useRef } from 'react';
import { type ClockConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: ClockConfig;
  style: WidgetStyle;
}

export function ClockWidget({ config }: Props) {
  const [time, setTime] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Responsive scaling based on container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Base design: ~240 wide, content ~120 tall (label+time+date).
      const s = Math.min(w / 240, h / 120);
      setScale(Math.max(0.4, Math.min(2.5, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tz = config.timezone || 'America/Chicago';

  const hours = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: !config.is24Hour,
    timeZone: tz,
  }).format(time).replace(/\s*(AM|PM)$/i, '');

  const minutes = new Intl.DateTimeFormat('en-US', {
    minute: '2-digit',
    timeZone: tz,
  }).format(time);

  const seconds = config.showSeconds
    ? new Intl.DateTimeFormat('en-US', {
        second: '2-digit',
        timeZone: tz,
      }).format(time)
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
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center gap-0.5 overflow-hidden">
      {/* Location label */}
      <div
        className="font-bold text-white/30 uppercase"
        style={{ letterSpacing: '4px', fontSize: `${Math.max(8, 10 * scale)}px` }}
      >
        {config.label}
      </div>

      {/* Time - the hero */}
      <div className="flex items-baseline">
        <span
          className="font-extralight text-white/95 tabular-nums"
          style={{ fontSize: `${72 * scale}px`, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {hours}
        </span>
        <span
          className="font-extralight text-white/30"
          style={{ fontSize: `${64 * scale}px`, lineHeight: 1, position: 'relative', top: '-2px' }}
        >
          :
        </span>
        <span
          className="font-extralight text-white/95 tabular-nums"
          style={{ fontSize: `${72 * scale}px`, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {minutes}
        </span>
        {seconds && (
          <>
            <span
              className="font-extralight text-white/30"
              style={{ fontSize: `${40 * scale}px`, lineHeight: 1, position: 'relative', top: '-2px' }}
            >
              :
            </span>
            <span
              className="font-extralight text-white/60 tabular-nums"
              style={{ fontSize: `${40 * scale}px`, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {seconds}
            </span>
          </>
        )}
        {period && (
          <span
            className="font-medium text-white/25 ml-1.5"
            style={{ fontSize: `${18 * scale}px`, position: 'relative', top: '-4px' }}
          >
            {period}
          </span>
        )}
      </div>

      {/* Date */}
      <div
        className="font-light text-white/35 mt-0.5"
        style={{ fontSize: `${14 * scale}px` }}
      >
        {dateString}
      </div>
    </div>
  );
}
