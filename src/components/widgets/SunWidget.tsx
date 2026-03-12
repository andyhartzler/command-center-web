'use client';
import { useState, useEffect } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import { calculateSun, type SunData } from '@/lib/sun';
import { type SunConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: SunConfig;
  style: WidgetStyle;
}

export function SunWidget({ config }: Props) {
  const [sunData, setSunData] = useState<SunData | null>(null);

  useEffect(() => {
    setSunData(calculateSun(config.latitude, config.longitude));
    const interval = setInterval(() => {
      setSunData(calculateSun(config.latitude, config.longitude));
    }, 60_000); // update every minute - matches Swift
    return () => clearInterval(interval);
  }, [config.latitude, config.longitude]);

  if (!sunData) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const { sunrise, sunset, dayProgress, moonPhase, moonPhaseEmoji } = sunData;
  const isDaytime = dayProgress > 0 && dayProgress < 1;

  // SVG arc geometry - matching Swift: semicircle from left to right
  const arcW = 200;
  const arcH = 80;
  const cx = arcW / 2;
  const cy = arcH; // baseline at bottom
  const r = arcW / 2 - 10;

  // Sun position on the arc (progress 0 = left/sunrise, 1 = right/sunset)
  const sunAngle = Math.PI * (1 - dayProgress);
  const sunX = cx + r * Math.cos(sunAngle);
  const sunY = cy - r * Math.sin(sunAngle);

  // Arc endpoints
  const arcStartX = cx - r;
  const arcStartY = cy;
  const arcEndX = cx + r;
  const arcEndY = cy;

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-4">
      {/* Sun arc SVG */}
      <div className="flex-1 flex items-center justify-center w-full" style={{ minHeight: 0 }}>
        <svg viewBox={`0 0 ${arcW} ${arcH + 12}`} className="w-full max-w-[180px] h-auto">
          {/* Full arc (dim) - matches Swift: white 8% opacity, 2px */}
          <path
            d={`M ${arcStartX} ${arcStartY} A ${r} ${r} 0 0 1 ${arcEndX} ${arcEndY}`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
          />

          {/* Lit arc (daylight portion) - matches Swift: orange->yellow gradient */}
          {isDaytime && (
            <>
              <defs>
                <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(249,115,22,0.6)" />
                  <stop offset="100%" stopColor="rgba(250,204,21,0.8)" />
                </linearGradient>
              </defs>
              <path
                d={`M ${arcStartX} ${arcStartY} A ${r} ${r} 0 0 1 ${sunX} ${sunY}`}
                fill="none"
                stroke="url(#sunGrad)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Sun dot - matches Swift: yellow fill + yellow shadow */}
          {isDaytime ? (
            <>
              <circle cx={sunX} cy={sunY} r="8" fill="rgba(250,204,21,0.3)" />
              <circle cx={sunX} cy={sunY} r="4" fill="#facc15" />
            </>
          ) : (
            /* Moon at top center when nighttime */
            <>
              <circle cx={cx} cy={cy - r} r="5" fill="rgba(148,163,184,0.2)" />
              <circle cx={cx} cy={cy - r} r="3" fill="rgba(148,163,184,0.5)" />
            </>
          )}
        </svg>
      </div>

      {/* Bottom row: sunrise | sunset | moon - matches Swift 3-column layout with dividers */}
      <div className="flex items-center w-full">
        {/* Sunrise */}
        <div className="flex-1 flex flex-col items-center gap-[2px]">
          <Sunrise size={12} className="text-orange-400/70" strokeWidth={1.5} />
          <span className="text-xs font-light text-white/70">{sunrise}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-[30px] bg-white/[0.06]" />

        {/* Sunset */}
        <div className="flex-1 flex flex-col items-center gap-[2px]">
          <Sunset size={12} className="text-blue-400/70" strokeWidth={1.5} />
          <span className="text-xs font-light text-white/70">{sunset}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-[30px] bg-white/[0.06]" />

        {/* Moon */}
        <div className="flex-1 flex flex-col items-center gap-[2px]">
          <span className="text-sm">{moonPhaseEmoji}</span>
          <span className="text-[9px] font-medium text-white/50">{moonPhase}</span>
        </div>
      </div>
    </div>
  );
}
