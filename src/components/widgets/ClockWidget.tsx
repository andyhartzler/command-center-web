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
      // Content at scale 1: label(8) + gap(1) + time(72) + gap(1) + date(12) ≈ 94h
      // Width: "12:00 PM" at 72px font ≈ 200w
      const s = Math.min(w / 200, h / 94);
      setScale(Math.max(0.4, Math.min(3.5, s)));
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
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ gap: `${1 * scale}px` }}>
      {/* Location label */}
      <div
        className="font-bold text-white/30 uppercase"
        style={{ letterSpacing: `${3 * scale}px`, fontSize: `${Math.max(6, 8 * scale)}px` }}
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
            className="font-medium text-white/25"
            style={{ fontSize: `${18 * scale}px`, marginLeft: `${6 * scale}px`, position: 'relative', top: `${-4 * scale}px` }}
          >
            {period}
          </span>
        )}
      </div>

      {/* Date */}
      <div
        className="font-light text-white/35"
        style={{ fontSize: `${12 * scale}px`, marginTop: `${1 * scale}px` }}
      >
        {dateString}
      </div>
    </div>
  );
}
