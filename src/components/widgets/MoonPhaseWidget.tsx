'use client';
import { useState, useEffect } from 'react';
import { type MoonPhaseConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: MoonPhaseConfig;
  style: WidgetStyle;
}

/** Compute moon phase value 0-1 (0=new, 0.5=full, 1=new) */
function getMoonPhase(): { phase: number; name: string; illumination: number; age: number } {
  const now = new Date();
  const jd = Math.floor(now.getTime() / 86400000) + 2440587.5;
  let moonAge = (jd - 2451550.1) % 29.530588853;
  if (moonAge < 0) moonAge += 29.530588853;
  const phase = moonAge / 29.530588853;
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;

  let name: string;
  if (phase < 0.0625) name = 'New Moon';
  else if (phase < 0.1875) name = 'Waxing Crescent';
  else if (phase < 0.3125) name = 'First Quarter';
  else if (phase < 0.4375) name = 'Waxing Gibbous';
  else if (phase < 0.5625) name = 'Full Moon';
  else if (phase < 0.6875) name = 'Waning Gibbous';
  else if (phase < 0.8125) name = 'Last Quarter';
  else if (phase < 0.9375) name = 'Waning Crescent';
  else name = 'New Moon';

  return { phase, name, illumination, age: moonAge };
}

/** Generate SVG path for the moon shadow overlay */
function moonShadowPath(phase: number, cx: number, cy: number, r: number): string {
  // phase: 0 = new (all dark), 0.5 = full (no shadow), 1 = new
  const sweep = Math.cos(phase * 2 * Math.PI);
  const terminatorRx = Math.max(0.5, Math.abs(sweep) * r);

  if (phase <= 0.001 || phase >= 0.999) {
    // New moon - full shadow circle
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;
  }

  if (phase > 0.499 && phase < 0.501) {
    // Full moon - no shadow
    return '';
  }

  if (phase < 0.5) {
    // Waxing: right side lit, shadow on left
    const sweepFlag = sweep > 0 ? 1 : 0;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${terminatorRx} ${r} 0 0 ${sweepFlag} ${cx} ${cy - r} Z`;
  } else {
    // Waning: left side lit, shadow on right
    const sweepFlag = sweep > 0 ? 0 : 1;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${terminatorRx} ${r} 0 0 ${sweepFlag} ${cx} ${cy - r} Z`;
  }
}

export function MoonPhaseWidget({ config }: Props) {
  const [moonData, setMoonData] = useState(() => getMoonPhase());

  useEffect(() => {
    const interval = setInterval(() => {
      setMoonData(getMoonPhase());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const { phase, name, illumination } = moonData;

  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = 38;
  const shadowPath = moonShadowPath(phase, cx, cy, r);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-3 gap-1">
      {/* Moon SVG */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-w-[90px] max-h-[90px]">
          <defs>
            {/* Radial gradient for realistic moon surface */}
            <radialGradient id="moonSurface" cx="45%" cy="40%">
              <stop offset="0%" stopColor="#f0ead6" />
              <stop offset="60%" stopColor="#d4cbb8" />
              <stop offset="100%" stopColor="#b8b0a0" />
            </radialGradient>
            {/* Soft glow around moon */}
            <radialGradient id="moonGlow" cx="50%" cy="50%">
              <stop offset="70%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(200,210,230,0.08)" />
            </radialGradient>
            {/* Shadow fill: semi-transparent dark to show some detail */}
            <radialGradient id="shadowFill" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(10,16,30,0.92)" />
              <stop offset="100%" stopColor="rgba(8,12,24,0.95)" />
            </radialGradient>
          </defs>

          {/* Glow ring */}
          <circle cx={cx} cy={cy} r={r + 6} fill="url(#moonGlow)" />

          {/* Moon body */}
          <circle cx={cx} cy={cy} r={r} fill="url(#moonSurface)" />

          {/* Surface detail - subtle craters */}
          <circle cx={cx - 8} cy={cy - 10} r={5} fill="rgba(160,150,135,0.3)" />
          <circle cx={cx + 12} cy={cy + 5} r={7} fill="rgba(155,145,130,0.25)" />
          <circle cx={cx - 3} cy={cy + 14} r={4} fill="rgba(165,155,140,0.2)" />
          <circle cx={cx + 5} cy={cy - 16} r={3} fill="rgba(150,140,125,0.25)" />
          <circle cx={cx - 14} cy={cy + 4} r={3.5} fill="rgba(160,150,135,0.2)" />
          <circle cx={cx + 16} cy={cy - 8} r={2.5} fill="rgba(155,145,130,0.2)" />

          {/* Shadow overlay */}
          {shadowPath && (
            <path d={shadowPath} fill="url(#shadowFill)" />
          )}

          {/* Subtle rim light on the lit edge */}
          <circle
            cx={cx}
            cy={cy}
            r={r - 0.5}
            fill="none"
            stroke="rgba(220,215,200,0.15)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Phase name */}
      <div className="text-center shrink-0">
        <div className="text-[10px] font-semibold text-white/70 leading-tight">{name}</div>
        <div className="text-[9px] text-white/35">{Math.round(illumination * 100)}% lit</div>
      </div>
    </div>
  );
}
