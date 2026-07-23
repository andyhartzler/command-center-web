'use client';

import { useEffect, useRef, useState } from 'react';
import { Wind } from 'lucide-react';
import type { AirQualityConfig, WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { AQI_RAMP, rampColor, rampLabel } from '@/lib/dataviz-ramps';

interface AirQualityData {
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  co: number | null;
  no2: number | null;
  so2: number | null;
}

interface Props {
  config: AirQualityConfig;
  style: WidgetStyle;
}

const POLL_MS = 300_000;

// Live container size, so the layout can genuinely FILL any shape (wide,
// slim, tall, or the whole screen) and scale its type to match — instead of
// centering a fixed card in dead space.
function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function Pollutant({ label, value, k }: { label: string; value: number | null; k: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--radius-inner)] bg-white/[0.04] w-full h-full min-w-0 min-h-0 overflow-hidden"
      style={{ gap: `${0.35 * k}em`, padding: `${Math.round(5 * k)}px ${Math.round(4 * k)}px` }}
    >
      <span
        className="uppercase leading-none whitespace-nowrap"
        style={{ fontSize: Math.round(11 * k), color: 'var(--color-text-3)', letterSpacing: '0.03em' }}
      >
        {label}
      </span>
      <span
        className="font-mono font-medium leading-none"
        style={{ fontSize: Math.round(19 * k), color: 'var(--color-text-1)' }}
      >
        {value !== null ? Math.round(value) : '--'}
      </span>
      <span
        className="leading-none whitespace-nowrap"
        style={{ fontSize: Math.round(9 * k), color: 'var(--color-text-3)' }}
      >
        µg/m³
      </span>
    </div>
  );
}

export function AirQualityWidget({ config, style }: Props) {
  const { data, phase, isStale, lastUpdated } = usePolledData<AirQualityData>(
    `/api/airquality?lat=${config.latitude}&lon=${config.longitude}`,
    { interval: POLL_MS },
  );
  const { ref, w, h } = useSize();

  let body: React.ReactNode;

  if (!data) {
    body = (
      <div className="w-full h-full flex items-center justify-center">
        {phase === 'loading' ? (
          <span className="live-dot" aria-label="Loading air quality data" />
        ) : (
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            Air quality data unavailable, retrying
          </span>
        )}
      </div>
    );
  } else if (data.aqi === null) {
    body = (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          No AQI reading from the nearest station
        </span>
      </div>
    );
  } else {
    const aqi = data.aqi;
    const color = rampColor(AQI_RAMP, aqi);
    const category = rampLabel(AQI_RAMP, aqi);

    // Aspect-aware layout + a type scale derived from the constraining
    // dimension so the content grows to fill the tile at any size.
    const wide = w > 0 && w / h > 1.7;
    const k = clamp(wide ? h / 128 : Math.min(w / 250, h / 168), 0.5, 3.2);
    const cols = w < 230 || h > w * 1.3 ? 2 : 4;
    const pad = Math.round(11 * k);
    const gap = Math.round(8 * k);

    const pollutants = (
      <>
        <Pollutant label="PM2.5" value={data.pm2_5} k={k} />
        <Pollutant label="PM10" value={data.pm10} k={k} />
        <Pollutant label="O₃" value={data.ozone} k={k} />
        <Pollutant label="CO" value={data.co} k={k} />
      </>
    );

    const headline = (
      <div className="flex items-center shrink-0" style={{ gap: Math.round(10 * k) }}>
        <span
          className="font-semibold leading-none tabular-nums"
          style={{ color, fontSize: Math.round(46 * k) }}
        >
          {aqi}
        </span>
        <div className="flex flex-col" style={{ gap: Math.round(3 * k) }}>
          <span
            className="uppercase leading-none"
            style={{ fontSize: Math.round(11 * k), color: 'var(--color-text-3)', letterSpacing: '0.06em' }}
          >
            AQI
          </span>
          <span className="font-medium leading-tight" style={{ fontSize: Math.round(14 * k), color }}>
            {category}
          </span>
        </div>
      </div>
    );

    body = (
      <div ref={ref} className="w-full h-full">
        {wide ? (
          <div className="w-full h-full flex items-center" style={{ padding: pad, gap: Math.round(14 * k) }}>
            {headline}
            <div className="flex-1 h-full flex items-stretch" style={{ gap, paddingTop: pad, paddingBottom: pad }}>
              {pollutants}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col" style={{ padding: pad, gap }}>
            {headline}
            <div
              className="flex-1 min-h-0 grid"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap }}
            >
              {pollutants}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <WidgetShell
      icon={<Wind size={18} />}
      title="Air Quality"
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_MS} isStale={isStale} />}
    >
      {body}
    </WidgetShell>
  );
}
