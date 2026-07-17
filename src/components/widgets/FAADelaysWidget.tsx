'use client';
import { TowerControl } from 'lucide-react';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { DELAY_RAMP, rampColor } from '@/lib/dataviz-ramps';
import { type FAADelaysConfig, type WidgetStyle } from '@/types/widget';

const POLL_INTERVAL = 2 * 60_000;
const BAR_MAX_MINUTES = 120;

interface Props {
  config: FAADelaysConfig;
  style: WidgetStyle;
}

interface AirportStatus {
  airport: string;
  delay: boolean;
  delayType: string | null;
  avgDelay: string | null;
  avgDelayMinutes: number | null;
  reason: string | null;
}

export function FAADelaysWidget({ config, style }: Props) {
  const codes = config.watchedAirports
    .map(c => c.trim().toUpperCase())
    .filter(Boolean);
  const url = codes.length > 0 ? `/api/faa-delays?airports=${codes.join(',')}` : null;

  const { data, phase, isStale, lastUpdated } = usePolledData<{ airports: AirportStatus[] }>(
    url,
    { interval: POLL_INTERVAL },
  );

  const airports = data?.airports ?? [];
  const delayedCount = airports.filter(a => a.delay).length;

  return (
    <WidgetShell
      icon={<TowerControl size={18} />}
      title="FAA delays"
      style={style}
      status={
        <>
          {data && (
            <span
              className="glass-chip px-2 py-0.5 font-mono text-[12px]"
              style={{ color: delayedCount > 0 ? 'var(--color-warn)' : 'var(--color-text-3)' }}
            >
              {delayedCount} delayed
            </span>
          )}
          <Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} live={false} />
        </>
      }
      footer={
        airports.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            {DELAY_RAMP.map(stop => (
              <span key={stop.label} className="flex items-center gap-1.5">
                <span className="w-3 h-[3px] rounded-full shrink-0" style={{ background: stop.color }} />
                <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
                  {stop.label}
                </span>
              </span>
            ))}
          </div>
        ) : undefined
      }
    >
      {!url ? (
        <div className="w-full h-full flex items-center justify-center p-4">
          <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
            No airports watched
          </span>
        </div>
      ) : airports.length === 0 && phase === 'loading' ? (
        <div className="w-full h-full flex items-center justify-center p-4">
          <span className="live-dot" aria-hidden />
        </div>
      ) : airports.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center p-4">
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            no FAA data yet, retrying
          </span>
        </div>
      ) : (
        <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-1">
          <div className="grid grid-cols-2 gap-2">
            {airports.map(apt => {
              const minutes = apt.avgDelayMinutes;
              const color = apt.delay ? rampColor(DELAY_RAMP, minutes ?? 0) : 'var(--color-ok)';
              const barPct = apt.delay
                ? Math.max(0.12, Math.min(1, (minutes ?? 15) / BAR_MAX_MINUTES))
                : 0;
              const statusText = apt.delay
                ? apt.reason || apt.delayType || 'Delays reported'
                : 'Normal';

              return (
                <div
                  key={apt.airport}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded-[10px]"
                  style={{ background: 'var(--color-well)', border: '1px solid var(--border-well)' }}
                >
                  <span className="font-mono text-[16px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
                    {apt.airport}
                  </span>

                  <span
                    className="text-[12px] text-center leading-snug break-words line-clamp-2 w-full"
                    style={{ color: apt.delay ? color : 'var(--color-text-3)' }}
                  >
                    {statusText}
                  </span>

                  {apt.delay && apt.avgDelay && (
                    <span className="font-mono text-[12px]" style={{ color }}>
                      {apt.avgDelay}
                    </span>
                  )}

                  {/* Severity bar colored from DELAY_RAMP */}
                  <div
                    className="w-full h-[3px] rounded-full overflow-hidden mt-0.5"
                    style={{ background: 'var(--color-surface-2)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${barPct * 100}%`,
                        background: color,
                        transition: 'width var(--motion-data) var(--ease-out)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
