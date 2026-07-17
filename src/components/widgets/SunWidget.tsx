'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Sunrise } from 'lucide-react';
import { type SunConfig, type WidgetStyle } from '@/types/widget';
import { WidgetShell } from './WidgetShell';
import { useSharedClock } from '@/hooks/useSharedClock';
import { tokens } from '@/lib/tokens';

interface Props {
  config: SunConfig;
  style: WidgetStyle;
}

// Arc geometry in viewBox units
const VB_W = 200;
const VB_H = 112;
const CX = 100;
const CY = 88;
const R = 72;

/** Point on the dawn-to-dusk arc; p=0 left horizon, p=1 right horizon. */
function arcPoint(p: number): { x: number; y: number } {
  const a = Math.PI * (1 - p);
  return { x: CX + R * Math.cos(a), y: CY - R * Math.sin(a) };
}

function arcPath(p0: number, p1: number): string {
  const a = arcPoint(p0);
  const b = arcPoint(p1);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Same solar math as lib/sun, kept numeric for arc positioning. */
function solarHours(lat: number, lon: number, now: Date): { sunriseHour: number; sunsetHour: number } {
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const decl = (-23.45 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const cosHa = Math.max(-1, Math.min(1, -Math.tan(latRad) * Math.tan(decl)));
  const ha = Math.acos(cosHa);
  const noon = 12.0 - lon / 15.0 + 6; // UTC offset approx -6 for CT
  return {
    sunriseHour: noon - (ha * 12.0) / Math.PI,
    sunsetHour: noon + (ha * 12.0) / Math.PI,
  };
}

function formatHour(h: number): string {
  const hour = ((Math.floor(h) % 24) + 24) % 24;
  const min = Math.floor((h - Math.floor(h)) * 60);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

export function SunWidget({ config, style }: Props) {
  const now = useSharedClock();
  // Sun dot eases to a new position once per minute via the shared clock
  const minute = Math.floor(now / 60000);

  const sun = useMemo(() => {
    const d = new Date(minute * 60000);
    const { sunriseHour, sunsetHour } = solarHours(config.latitude, config.longitude, d);
    const nowH = d.getHours() + d.getMinutes() / 60;
    const isDay = nowH >= sunriseHour && nowH <= sunsetHour;

    let progress: number;
    if (isDay) {
      progress = (nowH - sunriseHour) / (sunsetHour - sunriseHour);
    } else {
      // Moon track runs sunset to next sunrise
      const nightLen = 24 - sunsetHour + sunriseHour;
      const sinceSunset = nowH >= sunsetHour ? nowH - sunsetHour : nowH + 24 - sunsetHour;
      progress = sinceSunset / nightLen;
    }
    progress = Math.max(0, Math.min(1, progress));

    const goldenPhase: 'morning' | 'evening' | null = !isDay
      ? null
      : nowH < sunriseHour + 1
        ? 'morning'
        : nowH > sunsetHour - 1
          ? 'evening'
          : null;

    return {
      isDay,
      progress,
      goldenPhase,
      sunrise: formatHour(sunriseHour),
      sunset: formatHour(sunsetHour),
      dayPercent: Math.round(
        Math.max(0, Math.min(1, (nowH - sunriseHour) / (sunsetHour - sunriseHour))) * 100,
      ),
    };
  }, [minute, config.latitude, config.longitude]);

  const morningWedgeRef = useRef<SVGPathElement>(null);
  const eveningWedgeRef = useRef<SVGPathElement>(null);

  // Golden-hour wedges gently glow only while golden hour is live
  useEffect(() => {
    const el =
      sun.goldenPhase === 'morning'
        ? morningWedgeRef.current
        : sun.goldenPhase === 'evening'
          ? eveningWedgeRef.current
          : null;
    if (!el) return;
    const anim = el.animate([{ opacity: 0.2 }, { opacity: 0.6 }, { opacity: 0.2 }], {
      duration: 3600,
      iterations: Infinity,
      easing: 'ease-in-out',
    });
    return () => anim.cancel();
  }, [sun.goldenPhase]);

  const dot = arcPoint(sun.progress);
  const trackId = sun.isDay ? 'sun-arc-day' : 'sun-arc-night';
  const leftLabel = sun.isDay ? 'Sunrise' : 'Sunset';
  const rightLabel = sun.isDay ? 'Sunset' : 'Sunrise';
  const leftTime = sun.isDay ? sun.sunrise : sun.sunset;
  const rightTime = sun.isDay ? sun.sunset : sun.sunrise;

  return (
    <WidgetShell
      icon={<Sunrise size={18} strokeWidth={1.75} />}
      title="Sun"
      style={style}
      status={
        sun.goldenPhase ? (
          <span
            className="glass-chip px-2 py-0.5 font-mono text-[12px]"
            style={{ color: 'var(--color-warn)' }}
          >
            golden hour
          </span>
        ) : sun.isDay ? (
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            {sun.dayPercent}%
          </span>
        ) : null
      }
    >
      <div className="w-full h-full flex flex-col px-3.5 pb-3">
        <div className="flex-1 min-h-0 flex items-end">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMax meet"
            className="w-full h-full"
            aria-hidden
          >
            <defs>
              <linearGradient id="sun-arc-day" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={tokens.accent600} />
                <stop offset="50%" stopColor={tokens.warn} />
                <stop offset="100%" stopColor={tokens.accent600} />
              </linearGradient>
              <linearGradient id="sun-arc-night" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={tokens.accent600} />
                <stop offset="50%" stopColor={tokens.accent400} />
                <stop offset="100%" stopColor={tokens.accent600} />
              </linearGradient>
            </defs>

            {/* Horizon line */}
            <line
              x1={CX - R - 14}
              y1={CY}
              x2={CX + R + 14}
              y2={CY}
              stroke={tokens.borderCard}
              strokeWidth={1}
            />

            {/* Golden-hour wedges hugging each horizon */}
            <path
              ref={morningWedgeRef}
              d={arcPath(0, 0.12)}
              fill="none"
              stroke={tokens.warn}
              strokeWidth={11}
              strokeLinecap="round"
              opacity={sun.goldenPhase === 'morning' ? 0.35 : 0.08}
            />
            <path
              ref={eveningWedgeRef}
              d={arcPath(0.88, 1)}
              fill="none"
              stroke={tokens.warn}
              strokeWidth={11}
              strokeLinecap="round"
              opacity={sun.goldenPhase === 'evening' ? 0.35 : 0.08}
            />

            {/* Track */}
            <path
              d={arcPath(0, 1)}
              fill="none"
              stroke={`url(#${trackId})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={sun.isDay ? 0.9 : 0.45}
            />

            {/* Elapsed portion, slightly brighter */}
            {sun.progress > 0.01 && (
              <path
                d={arcPath(0, sun.progress)}
                fill="none"
                stroke={`url(#${trackId})`}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={sun.isDay ? 1 : 0.7}
              />
            )}

            {/* Sun or moon dot, eased to its minutely position */}
            <g
              style={{
                transform: `translate(${dot.x}px, ${dot.y}px)`,
                transition: 'transform 1600ms var(--ease-in-out)',
              }}
            >
              <circle r={10} fill={sun.isDay ? tokens.warn : tokens.accent300} opacity={0.18} />
              <circle r={4.5} fill={sun.isDay ? tokens.warn : tokens.accent300} />
            </g>
          </svg>
        </div>

        {/* Endpoint times */}
        <div className="flex items-end justify-between shrink-0 pt-1">
          <div className="flex flex-col gap-0.5">
            <span className="type-label">{leftLabel}</span>
            <span className="font-mono text-[13px]" style={{ color: 'var(--color-text-2)' }}>
              {leftTime}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="type-label">{rightLabel}</span>
            <span className="font-mono text-[13px]" style={{ color: 'var(--color-text-2)' }}>
              {rightTime}
            </span>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
