'use client';
import { useState, useEffect } from 'react';
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
    }, 60_000);
    return () => clearInterval(interval);
  }, [config.latitude, config.longitude]);

  if (!sunData) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const { sunrise, sunset, dayProgress, moonPhase } = sunData;
  const isDaytime = dayProgress > 0 && dayProgress < 1;
  const dayPercent = Math.round(Math.max(0, Math.min(1, dayProgress)) * 100);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 gap-3">
      {/* Day progress */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">
            {isDaytime ? 'Daylight' : 'Night'}
          </span>
          <span className="text-[10px] text-white/30 tabular-nums">
            {isDaytime ? `${dayPercent}%` : ''}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${isDaytime ? dayPercent : 0}%`,
              background: isDaytime ? 'rgba(235,235,235,0.3)' : 'rgba(235,235,235,0.08)',
            }}
          />
        </div>
      </div>

      {/* Bottom: sunrise | sunset | moon */}
      <div className="flex items-center w-full">
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] text-white/25 uppercase tracking-wider">Rise</span>
          <span className="text-sm font-light text-white/70 tabular-nums">{sunrise}</span>
        </div>

        <div className="w-px h-7 bg-white/[0.06]" />

        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] text-white/25 uppercase tracking-wider">Set</span>
          <span className="text-sm font-light text-white/70 tabular-nums">{sunset}</span>
        </div>

        <div className="w-px h-7 bg-white/[0.06]" />

        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] text-white/25 uppercase tracking-wider">Moon</span>
          <span className="text-xs font-light text-white/50">{moonPhase}</span>
        </div>
      </div>
    </div>
  );
}
