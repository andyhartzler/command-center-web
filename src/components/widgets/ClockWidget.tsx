'use client';
import { useState, useEffect } from 'react';
import { type ClockConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: ClockConfig;
  style: WidgetStyle;
}

export function ClockWidget({ config }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
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
    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
      {/* Location label */}
      <div
        className="text-[10px] font-bold text-white/30 uppercase"
        style={{ letterSpacing: '4px' }}
      >
        {config.label}
      </div>

      {/* Time - the hero */}
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
        {period && (
          <span
            className="font-medium text-white/25 ml-1.5"
            style={{ fontSize: '18px', position: 'relative', top: '-4px' }}
          >
            {period}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="text-sm font-light text-white/35 mt-0.5">
        {dateString}
      </div>
    </div>
  );
}
