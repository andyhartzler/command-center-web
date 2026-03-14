'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { type ClockConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: ClockConfig;
  style: WidgetStyle;
}

export function ClockWidget({ config }: Props) {
  const [time, setTime] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (cw === 0 || ch === 0 || w === 0 || h === 0) return;
    setScale(Math.min(w / cw, h / ch) * 0.85);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Re-measure when content changes (e.g. hour digit count changes)
  useEffect(() => { measure(); });

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
          className="font-bold text-white/30 uppercase"
          style={{ letterSpacing: '4px', fontSize: '10px' }}
        >
          {config.label}
        </div>

        {/* Time */}
        <div className="flex items-baseline">
          <span
            className="font-extralight text-white/95 tabular-nums"
            style={{ fontSize: '72px', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {hours}
          </span>
          <span
            className="font-extralight text-white/30"
            style={{ fontSize: '64px', lineHeight: 1, position: 'relative', top: '-2px' }}
          >
            :
          </span>
          <span
            className="font-extralight text-white/95 tabular-nums"
            style={{ fontSize: '72px', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {minutes}
          </span>
          {seconds && (
            <>
              <span
                className="font-extralight text-white/30"
                style={{ fontSize: '40px', lineHeight: 1, position: 'relative', top: '-2px' }}
              >
                :
              </span>
              <span
                className="font-extralight text-white/60 tabular-nums"
                style={{ fontSize: '40px', lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {seconds}
              </span>
            </>
          )}
          {period && (
            <span
              className="font-medium text-white/25"
              style={{ fontSize: '18px', marginLeft: '6px', position: 'relative', top: '-4px' }}
            >
              {period}
            </span>
          )}
        </div>

        {/* Date */}
        <div
          className="font-light text-white/35"
          style={{ fontSize: '14px', marginTop: '2px' }}
        >
          {dateString}
        </div>
      </div>
    </div>
  );
}
