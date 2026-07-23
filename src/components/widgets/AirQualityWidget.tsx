'use client';

import { Wind } from 'lucide-react';
import type { AirQualityConfig, WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { TickingNumber } from '@/components/motion/TickingNumber';
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

function PollutantBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0 flex flex-col items-center justify-center gap-1 rounded-[var(--radius-inner)] bg-white/[0.04] px-1 py-2">
      <span
        className="text-[11px] uppercase leading-none whitespace-nowrap"
        style={{ color: 'var(--color-text-3)', letterSpacing: '0.04em' }}
      >
        {label}
      </span>
      <span className="font-mono text-[15px] font-medium leading-none" style={{ color: 'var(--color-text-1)' }}>
        {value !== null ? Math.round(value) : '--'}
      </span>
      <span className="text-[9px] leading-none" style={{ color: 'var(--color-text-3)' }}>
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
      <div className="w-full h-full px-3.5 pb-2.5 pt-0.5 overflow-hidden">
        <div
          className="w-full h-full flex flex-col gap-2 rounded-[var(--radius-inner)] p-2.5 overflow-hidden"
          style={{ border: `1px solid ${borderTint}`, transition: 'border-color 400ms var(--ease-out)' }}
        >
          <DataPulse signature={lastUpdated} className="flex items-center gap-3 shrink-0 min-h-0">
            <span style={{ color }}>
              <TickingNumber value={aqi} className="type-value leading-none" />
            </span>
            <div className="min-w-0 flex flex-col gap-0.5">
              <span
                className="text-[12px] uppercase leading-none"
                style={{ color: 'var(--color-text-3)', letterSpacing: 'var(--tracking-caps)' }}
              >
                AQI
              </span>
              <span className="text-[13px] leading-snug" style={{ color }}>
                {category}
              </span>
            </div>
          </DataPulse>
          <div className="flex-1 min-h-0 flex items-center">
            {/* Four key pollutants, always in one clean row of readable values.
                (NO₂/SO₂ dropped: they clipped and are rarely the AQI driver.) */}
            <div className="w-full grid grid-cols-4 gap-1.5">
              <PollutantBox label="PM2.5" value={data.pm2_5} />
              <PollutantBox label="PM10" value={data.pm10} />
              <PollutantBox label="O₃" value={data.ozone} />
              <PollutantBox label="CO" value={data.co} />
            </div>
          </div>
        </div>
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
