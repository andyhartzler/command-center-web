'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { type WeatherConfig, type WidgetStyle } from '@/types/widget';

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
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

// WMO weather code -> description (matches Swift exactly)
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

export function WeatherWidget({ config }: Props) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Base design: 200w x 280h. Scale to fill container.
      const s = Math.min(w / 200, h / 280);
      setScale(Math.max(0.5, Math.min(3, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      const unitParam = config.units === 'celsius' ? 'celsius' : 'fahrenheit';
      const res = await fetch(
        `/api/weather?lat=${config.latitude}&lon=${config.longitude}&units=${unitParam}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    }
  }, [config.latitude, config.longitude, config.units]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  if (error) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center p-4">
        <span className="text-xs text-red-400/60">Unavailable</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center p-4">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const currentTemp = Math.round(data.current.temperature_2m);
  const high = Math.round(data.daily.temperature_2m_max[0]);
  const low = Math.round(data.daily.temperature_2m_min[0]);

  const currentHour = new Date().getHours();
  const isNight = currentHour < 6 || currentHour >= 20;
  const conditionLabel = wmoDescription(data.current.weather_code);
  const ConditionIcon = wmoToIcon(data.current.weather_code, isNight);

  // Build hourly forecast - future hours only, up to 6
  const forecastHours: { hour: string; temp: number; Icon: LucideIcon }[] = [];
  if (data.hourly?.time) {
    const now = new Date();
    for (let i = 0; i < data.hourly.time.length && forecastHours.length < 6; i++) {
      const d = new Date(data.hourly.time[i]);
      if (d <= now) continue;
      const h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      forecastHours.push({
        hour: `${h12}${ampm}`,
        temp: Math.round(data.hourly.temperature_2m[i]),
        Icon: wmoToSmallIcon(data.hourly.weather_code[i]),
      });
    }
  }

  const s = scale;
  const pad = Math.max(8, 16 * s);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col items-start justify-center overflow-hidden"
      style={{ padding: pad, gap: `${8 * s}px` }}
    >
      <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: `${2 * s}px` }}>
        {/* Location label */}
        <div
          className="font-bold text-white/30 uppercase"
          style={{ letterSpacing: `${4 * s}px`, fontSize: `${Math.max(8, 10 * s)}px` }}
        >
          {config.locationName || 'KANSAS CITY'}
        </div>

        {/* Top row: temp + icon */}
        <div className="flex items-start justify-between w-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * s}px` }}>
            {/* Temperature hero */}
            <span
              className="font-extralight text-white/95"
              style={{ fontSize: `${48 * s}px`, lineHeight: 1 }}
            >
              {currentTemp}&deg;
            </span>

            {/* Condition */}
            <span className="font-light text-white/50" style={{ fontSize: `${13 * s}px` }}>
              {conditionLabel}
            </span>

            {/* High/Low */}
            <div className="flex items-center" style={{ gap: `${10 * s}px`, marginTop: `${2 * s}px` }}>
              <div className="flex items-center" style={{ gap: `${2 * s}px` }}>
                <ArrowUp size={Math.max(8, 10 * s)} className="text-white/30" strokeWidth={2} />
                <span className="font-medium text-white/30" style={{ fontSize: `${10 * s}px` }}>H:{high}&deg;</span>
              </div>
              <div className="flex items-center" style={{ gap: `${2 * s}px` }}>
                <ArrowDown size={Math.max(8, 10 * s)} className="text-white/30" strokeWidth={2} />
                <span className="font-medium text-white/30" style={{ fontSize: `${10 * s}px` }}>L:{low}&deg;</span>
              </div>
            </div>
          </div>

          {/* Weather icon */}
          <ConditionIcon size={Math.max(20, 36 * s)} className="text-white/50" strokeWidth={1} style={{ marginTop: `${4 * s}px` }} />
        </div>
      </div>

      {/* Hourly forecast strip */}
      {forecastHours.length > 0 && (
        <div className="flex items-center w-full" style={{ marginTop: `${4 * s}px` }}>
          {forecastHours.map((f, i) => {
            const FIcon = f.Icon;
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-0" style={{ gap: `${3 * s}px` }}>
                <span className="font-medium text-white/25" style={{ fontSize: `${Math.max(7, 8 * s)}px` }}>{f.hour}</span>
                <FIcon size={Math.max(10, 12 * s)} className="text-white/40" strokeWidth={1.5} />
                <span className="font-light text-white/70" style={{ fontSize: `${Math.max(9, 11 * s)}px` }}>{f.temp}&deg;</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
