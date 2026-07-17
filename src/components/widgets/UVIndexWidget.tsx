'use client';

import { Sun } from 'lucide-react';
import type { UVIndexConfig, WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { ArcGauge, type ArcGaugeSegment } from './gauges/ArcGauge';
import { UV_RAMP, rampColor, rampLabel } from '@/lib/dataviz-ramps';

interface UVData {
  uvIndex: number;
  uvCategory: string;
  peakUV: number;
  peakUVTime: string | null;
  condition: string;
  sunrise: string | null;
  sunset: string | null;
}

interface Props {
  config: UVIndexConfig;
  style: WidgetStyle;
}

const POLL_MS = 300_000;

function formatTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-2)' }}>{value}</span>
    </div>
  );
}

export function UVIndexWidget({ config, style }: Props) {
  const { data, phase, isStale, lastUpdated } = usePolledData<UVData>(
    `/api/uv?lat=${config.latitude}&lon=${config.longitude}`,
    { interval: POLL_MS },
  );

  let body: React.ReactNode;

  if (!data) {
    body = (
      <div className="w-full h-full flex items-center justify-center">
        {phase === 'loading' ? (
          <span className="live-dot" aria-label="Loading UV data" />
        ) : (
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            UV data unavailable, retrying
          </span>
        )}
      </div>
    );
  } else {
    // Arc domain auto-scales to the daily peak so quiet winter days still
    // read; segments come straight from UV_RAMP so plot and legend agree.
    const domainMax = Math.max(Math.ceil(Math.max(data.uvIndex, data.peakUV)), 8);
    const segments: ArcGaugeSegment[] = UV_RAMP
      .filter(stop => stop.min < domainMax)
      .map((stop, i, arr) => ({
        from: stop.min,
        to: Math.min(arr[i + 1]?.min ?? domainMax, domainMax),
        color: stop.color,
      }));
    const uvColor = rampColor(UV_RAMP, data.uvIndex);
    const uvCategory = rampLabel(UV_RAMP, data.uvIndex);

    body = (
      <div className="w-full h-full flex items-center gap-3 px-3.5 pb-2.5 overflow-hidden">
        <div className="flex-1 min-w-0 h-full">
          <ArcGauge
            value={data.uvIndex}
            min={0}
            max={domainMax}
            color={uvColor}
            label={uvCategory}
            segments={segments}
            format={v => v.toFixed(1)}
          />
        </div>
        <div className="shrink-0 flex flex-col justify-center gap-1.5 max-w-[55%]">
          <div className="text-[13px] leading-snug truncate" style={{ color: 'var(--color-text-2)' }}>
            {data.condition}
          </div>
          <div className="flex flex-col gap-1">
            <StatRow label="Peak" value={data.peakUV.toFixed(1)} />
            {data.peakUVTime && <StatRow label="Peak at" value={formatTime(data.peakUVTime)} />}
            <StatRow label="Sunrise" value={formatTime(data.sunrise)} />
            <StatRow label="Sunset" value={formatTime(data.sunset)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <WidgetShell
      icon={<Sun size={18} />}
      title="UV Index"
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_MS} isStale={isStale} />}
    >
      {body}
    </WidgetShell>
  );
}
