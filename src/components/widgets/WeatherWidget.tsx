'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Snowflake,
  CloudSun,
  CloudMoon,
  ArrowUp,
  ArrowDown,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { type WeatherConfig, type WidgetStyle } from '@/types/widget';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock } from '@/hooks/useSharedClock';
import { TickingNumber } from '@/components/motion/TickingNumber';
import { tokens } from '@/lib/tokens';

interface Props {
  config: WeatherConfig;
  style: WidgetStyle;
}

interface WeatherData {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability?: number[];
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
  };
}

const POLL_INTERVAL = 5 * 60 * 1000;

function wmoDescription(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code === 51 || code === 53 || code === 55) return 'Drizzle';
  if (code === 61 || code === 63 || code === 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing Rain';
  if (code === 71 || code === 73 || code === 75) return 'Snow';
  if (code === 77) return 'Snow Grains';
  if (code === 80 || code === 81 || code === 82) return 'Rain Showers';
  if (code === 85 || code === 86) return 'Snow Showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm with Hail';
  return 'Unknown';
}

function wmoToIcon(code: number, isNight: boolean): LucideIcon {
  if (code === 0) return isNight ? Moon : Sun;
  if (code === 1) return isNight ? Moon : Sun;
  if (code === 2) return isNight ? CloudMoon : CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code === 51 || code === 53 || code === 55) return CloudDrizzle;
  if (code === 56 || code === 57) return CloudDrizzle;
  if (code === 61 || code === 63 || code === 65) return CloudRain;
  if (code === 66 || code === 67) return CloudRain;
  if (code === 71 || code === 73 || code === 75) return CloudSnow;
  if (code === 77) return Snowflake;
  if (code === 80 || code === 81 || code === 82) return CloudRain;
  if (code === 85 || code === 86) return CloudSnow;
  if (code === 95 || code === 96 || code === 99) return CloudLightning;
  return Cloud;
}

function wmoToSmallIcon(code: number): LucideIcon {
  if (code === 0 || code === 1) return Sun;
  if (code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

type AmbientKind = 'clear' | 'night' | 'rain' | 'cloud';

function ambientKind(code: number, isNight: boolean): AmbientKind {
  const isPrecip =
    (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  if (isPrecip) return 'rain';
  if (code >= 2) return 'cloud';
  return isNight ? 'night' : 'clear';
}

/**
 * Condition layer behind content at 8% opacity. Loops are transform/opacity
 * only, driven by inline WAAPI so globals.css stays untouched.
 */
function AmbientConditionLayer({ kind }: { kind: AmbientKind }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const anims: Animation[] = [];
    root.querySelectorAll<HTMLElement>('[data-ambient]').forEach((el, i) => {
      const mode = el.dataset.ambient;
      if (mode === 'gradient') {
        anims.push(
          el.animate(
            [
              { transform: 'translate3d(-10%, -6%, 0) scale(1)' },
              { transform: 'translate3d(10%, 6%, 0) scale(1.15)' },
            ],
            { duration: 26000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
          ),
        );
      } else if (mode === 'cloud') {
        anims.push(
          el.animate(
            [{ transform: 'translateX(-22%)' }, { transform: 'translateX(22%)' }],
            {
              duration: 34000 + i * 9000,
              iterations: Infinity,
              direction: 'alternate',
              easing: 'ease-in-out',
              delay: i * -7000,
            },
          ),
        );
      } else if (mode === 'rain') {
        anims.push(
          el.animate(
            [{ transform: 'translateY(-130%)' }, { transform: 'translateY(130%)' }],
            {
              duration: 1300 + (i % 5) * 240,
              iterations: Infinity,
              easing: 'linear',
              delay: i * -430,
            },
          ),
        );
      } else if (mode === 'twinkle') {
        anims.push(
          el.animate(
            [{ opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }],
            { duration: 3400 + i * 1100, iterations: Infinity, easing: 'ease-in-out', delay: i * -1400 },
          ),
        );
      }
    });
    return () => anims.forEach(a => a.cancel());
  }, [kind]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ opacity: 0.08 }}
    >
      {kind === 'clear' && (
        <div
          data-ambient="gradient"
          className="absolute rounded-full"
          style={{
            width: '90%',
            height: '90%',
            left: '5%',
            top: '-20%',
            background: `radial-gradient(circle, var(--color-warn) 0%, var(--color-accent-400) 55%, transparent 75%)`,
          }}
        />
      )}
      {kind === 'night' && (
        <>
          {[
            { left: '18%', top: '22%' },
            { left: '58%', top: '12%' },
            { left: '82%', top: '38%' },
          ].map((pos, i) => (
            <div
              key={i}
              data-ambient="twinkle"
              className="absolute rounded-full"
              style={{
                ...pos,
                width: 5,
                height: 5,
                background: 'var(--color-text-1)',
              }}
            />
          ))}
        </>
      )}
      {kind === 'rain' && (
        <>
          {[8, 24, 41, 57, 72, 88].map((left, i) => (
            <div
              key={i}
              data-ambient="rain"
              className="absolute"
              style={{
                left: `${left}%`,
                top: 0,
                width: 2,
                height: '55%',
                background: `linear-gradient(to bottom, transparent, var(--color-info))`,
              }}
            />
          ))}
        </>
      )}
      {kind === 'cloud' && (
        <>
          {[
            { left: '-10%', top: '8%', width: '55%', height: '38%' },
            { left: '45%', top: '42%', width: '65%', height: '42%' },
          ].map((pos, i) => (
            <div
              key={i}
              data-ambient="cloud"
              className="absolute rounded-full"
              style={{
                ...pos,
                background: 'var(--color-text-2)',
                filter: 'blur(18px)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface SparkPoint {
  xPct: number;
  yPct: number;
  precip: number;
}

/** Temperature area sparkline over the next 12 hours with precip accents. */
function HourlySparkline({ points }: { points: SparkPoint[] }) {
  if (points.length < 2) return null;
  const W = 100;
  const H = 100;
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.xPct / 100) * W} ${(p.yPct / 100) * H}`)
    .join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div className="relative w-full h-7">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden
      >
        <path d={area} fill={tokens.accent500} fillOpacity={0.14} />
        <path
          d={line}
          fill="none"
          stroke={tokens.accent400}
          strokeOpacity={0.75}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {points
        .filter(p => p.precip > 40)
        .map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `calc(${p.xPct}% - 2px)`,
              top: `calc(${p.yPct}% - 2px)`,
              width: 4,
              height: 4,
              background: 'var(--color-info)',
            }}
          />
        ))}
    </div>
  );
}

export function WeatherWidget({ config, style }: Props) {
  const unitParam = config.units === 'celsius' ? 'celsius' : 'fahrenheit';
  const url = `/api/weather?lat=${config.latitude}&lon=${config.longitude}&units=${unitParam}`;
  const { data, phase, isStale, lastUpdated } = usePolledData<WeatherData>(url, {
    interval: POLL_INTERVAL,
  });
  const now = useSharedClock();
  // Re-derive time-dependent values at minute granularity, not 1Hz
  const minute = Math.floor(now / 60000);

  const derived = useMemo(() => {
    if (!data) return null;
    const nowDate = new Date(minute * 60000);

    // isNight from the real WeatherKit sunrise/sunset for today
    const sunriseStr = data.daily.sunrise?.[0] ?? null;
    const sunsetStr = data.daily.sunset?.[0] ?? null;
    let isNight = false;
    if (sunriseStr && sunsetStr) {
      const sunrise = new Date(sunriseStr).getTime();
      const sunset = new Date(sunsetStr).getTime();
      isNight = nowDate.getTime() < sunrise || nowDate.getTime() > sunset;
    }

    const upcoming: {
      hour: string;
      temp: number;
      code: number;
      precip: number;
    }[] = [];
    if (data.hourly?.time) {
      for (let i = 0; i < data.hourly.time.length && upcoming.length < 12; i++) {
        const d = new Date(data.hourly.time[i]);
        if (d <= nowDate) continue;
        const h = d.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        upcoming.push({
          hour: `${h12}${ampm}`,
          temp: Math.round(data.hourly.temperature_2m[i]),
          code: data.hourly.weather_code[i],
          precip: data.hourly.precipitation_probability?.[i] ?? 0,
        });
      }
    }

    let spark: SparkPoint[] = [];
    if (upcoming.length >= 2) {
      const temps = upcoming.map(u => u.temp);
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const span = Math.max(1, max - min);
      spark = upcoming.map((u, i) => ({
        xPct: (i / (upcoming.length - 1)) * 100,
        // pad 12% top and bottom so the line never kisses the edges
        yPct: 12 + (1 - (u.temp - min) / span) * 76,
        precip: u.precip,
      }));
    }

    return { isNight, upcoming, spark };
  }, [data, minute]);

  const title = config.locationName || 'Kansas City';

  if (!data) {
    return (
      <WidgetShell
        icon={<CloudSun size={18} strokeWidth={1.75} />}
        title={title}
        style={style}
        status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
      >
        <div className="w-full h-full flex items-center justify-center px-3.5">
          <span className="type-label">
            {phase === 'error' ? 'Weather unavailable' : 'Loading weather'}
          </span>
        </div>
      </WidgetShell>
    );
  }

  const isNight = derived?.isNight ?? false;
  const currentTemp = data.current.temperature_2m;
  const high = Math.round(data.daily.temperature_2m_max[0]);
  const low = Math.round(data.daily.temperature_2m_min[0]);
  const wind = Math.round(data.current.wind_speed_10m);
  const windUnit = config.units === 'celsius' ? 'km/h' : 'mph';
  const conditionLabel = wmoDescription(data.current.weather_code);
  const ConditionIcon = wmoToIcon(data.current.weather_code, isNight);
  const kind = ambientKind(data.current.weather_code, isNight);
  const upcoming = derived?.upcoming ?? [];
  const spark = derived?.spark ?? [];

  return (
    <WidgetShell
      icon={<CloudSun size={18} strokeWidth={1.75} />}
      title={title}
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="w-full h-full relative overflow-hidden">
        <AmbientConditionLayer kind={kind} />

        <div className="relative z-10 w-full h-full flex flex-col justify-center gap-2 px-3.5 pb-3">
          {/* Hero temperature + condition icon */}
          <div className="flex items-start justify-between w-full">
            <div className="flex flex-col min-w-0">
              <TickingNumber
                value={currentTemp}
                format={v => `${Math.round(v)}°`}
                className="type-hero leading-none"
                duration={600}
              />
              <span className="type-body truncate" style={{ color: 'var(--color-text-2)' }}>
                {conditionLabel}
              </span>
            </div>
            <ConditionIcon
              size={34}
              strokeWidth={1.25}
              className="shrink-0 mt-1"
              style={{ color: 'var(--color-text-2)' }}
            />
          </div>

          {/* High / low + wind chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="flex items-center gap-1 font-mono text-[12px]"
              style={{ color: 'var(--color-text-3)' }}
            >
              <ArrowUp size={12} strokeWidth={2} aria-hidden />
              {high}&deg;
            </span>
            <span
              className="flex items-center gap-1 font-mono text-[12px]"
              style={{ color: 'var(--color-text-3)' }}
            >
              <ArrowDown size={12} strokeWidth={2} aria-hidden />
              {low}&deg;
            </span>
            <span
              className="glass-chip flex items-center gap-1.5 px-2 py-0.5 font-mono text-[12px]"
              style={{ color: 'var(--color-text-2)' }}
            >
              <Wind size={12} strokeWidth={1.75} aria-hidden />
              {wind} {windUnit}
            </span>
          </div>

          {/* Hourly strip: sparkline over the next 12 hours + 6 hour columns */}
          {upcoming.length >= 2 && (
            <div className="w-full mt-1">
              <HourlySparkline points={spark} />
              <div className="flex items-start w-full mt-1.5">
                {upcoming.slice(0, 6).map(f => {
                  const FIcon = wmoToSmallIcon(f.code);
                  return (
                    <div key={f.hour} className="flex flex-col items-center flex-1 min-w-0 gap-0.5">
                      <span
                        className="font-mono text-[12px]"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {f.hour}
                      </span>
                      <FIcon
                        size={13}
                        strokeWidth={1.5}
                        style={{ color: 'var(--color-text-3)' }}
                        aria-hidden
                      />
                      <span
                        className="font-mono text-[12px]"
                        style={{ color: 'var(--color-text-2)' }}
                      >
                        {f.temp}&deg;
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
