'use client';

import { useEffect, useRef, useState } from 'react';
import { Wind } from 'lucide-react';
import type { AirQualityConfig, WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { DataPulse } from '@/components/motion/DataPulse';
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

// Scale-to-fit wrapper: the content is laid out once at a fixed natural size,
// then uniformly scaled (contain) to whatever the widget cell is. This is the
// pre-overhaul guarantee — nothing ever overlaps, clips, or squishes onto
// itself no matter how the tile is resized; it just gets bigger or smaller.
function FitBox({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      // offsetWidth/Height are the untransformed natural size, so measuring
      // the inner block never fights the transform we apply to it.
      const nw = inner.offsetWidth;
      const nh = inner.offsetHeight;
      const ow = outer.clientWidth;
      const oh = outer.clientHeight;
      if (!nw || !nh || !ow || !oh) return;
      // Small negative inset so it never kisses the edges; cap upscale so a
      // huge tile stays tasteful rather than cartoonishly large.
      const s = Math.min(ow / nw, oh / nh) * 0.98;
      setScale(Math.max(0.2, Math.min(s, 2.4)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      <div
        ref={innerRef}
        style={{
          transform: `scale(${scale || 1})`,
          transformOrigin: 'center',
          opacity: scale ? 1 : 0,
          transition: 'opacity 200ms var(--ease-out)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PollutantBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-inner)] bg-white/[0.04]"
      style={{ width: 52, paddingTop: 8, paddingBottom: 8 }}
    >
      <span
        className="text-[11px] uppercase leading-none whitespace-nowrap"
        style={{ color: 'var(--color-text-3)', letterSpacing: '0.03em' }}
      >
        {label}
      </span>
      <span className="font-mono text-[16px] font-medium leading-none" style={{ color: 'var(--color-text-1)' }}>
        {value !== null ? Math.round(value) : '--'}
      </span>
      <span className="text-[9px] leading-none whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
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
    // A payload with a null AQI is a station gap, not a zero reading
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
    // Border tint escalates past the USG (100) and Unhealthy (150) thresholds
    const borderTint =
      aqi > 150
        ? 'color-mix(in srgb, var(--color-critical) 45%, transparent)'
        : aqi > 100
          ? 'color-mix(in srgb, var(--color-warn) 45%, transparent)'
          : 'var(--border-card)';

    body = (
      <FitBox>
        <div
          className="rounded-[var(--radius-inner)] p-3.5"
          style={{
            width: 236,
            border: `1px solid ${borderTint}`,
            transition: 'border-color 400ms var(--ease-out)',
          }}
        >
          <DataPulse signature={lastUpdated} className="flex flex-col gap-3">
            {/* AQI headline: big number + category */}
            <div className="flex items-center gap-3">
              <span
                className="font-semibold leading-none tabular-nums"
                style={{ color, fontSize: 46 }}
              >
                {aqi}
              </span>
              <div className="flex flex-col gap-1">
                <span
                  className="text-[11px] uppercase leading-none"
                  style={{ color: 'var(--color-text-3)', letterSpacing: '0.06em' }}
                >
                  AQI
                </span>
                <span className="text-[14px] font-medium leading-tight" style={{ color }}>
                  {category}
                </span>
              </div>
            </div>

            {/* Four key pollutants in one fixed row (scaled as a unit above). */}
            <div className="flex gap-1.5 justify-between">
              <PollutantBox label="PM2.5" value={data.pm2_5} />
              <PollutantBox label="PM10" value={data.pm10} />
              <PollutantBox label="O₃" value={data.ozone} />
              <PollutantBox label="CO" value={data.co} />
            </div>
          </DataPulse>
        </div>
      </FitBox>
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
