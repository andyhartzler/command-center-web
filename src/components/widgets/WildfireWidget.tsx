'use client';

import { useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import { useAppleMap } from '@/hooks/useAppleMap';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { TickingNumber } from '../motion/TickingNumber';
import { rampColor, type RampStop } from '@/lib/dataviz-ramps';
import { tokens } from '@/lib/tokens';
import type { WildfireConfig, WidgetStyle } from '@/types/widget';

const POLL_INTERVAL = 10 * 60_000;

// VIIRS brightness temperature bands (Kelvin). Local ramp built on tokens so
// the plotted marker colors and the legend come from the same constant.
const FIRE_RAMP: RampStop[] = [
  { min: 0, label: 'Under 340K', color: tokens.warn },
  { min: 340, label: '340 to 400K', color: tokens.critical },
  { min: 400, label: 'Above 400K', color: tokens.live },
];

interface WildfireData {
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acqDate: string;
  acqTime: string;
  frp: number;
}

interface WildfireWidgetProps {
  config: WildfireConfig;
  style: WidgetStyle;
}

function brightnessRadius(brightness: number): number {
  return Math.max(3, Math.min(10, (brightness - 300) / 20));
}

function confidenceLabel(confidence: string): string {
  if (confidence === 'high' || confidence === 'h') return 'High';
  if (confidence === 'nominal' || confidence === 'n') return 'Nominal';
  if (confidence === 'low' || confidence === 'l') return 'Low';
  return confidence;
}

export function WildfireWidget({ config, style }: WildfireWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  const center: [number, number] = config.region === 'us' ? [39.5, -98.35] : [20, 0];
  const zoom = config.region === 'us' ? 4 : 2;

  const { isReady, addDotAnnotation, clearAnnotations, ready } = useAppleMap(mapRef, {
    center,
    zoom,
  });

  const { data, phase, isStale, lastUpdated } = usePolledData<WildfireData[]>(
    '/api/wildfires',
    { interval: POLL_INTERVAL },
  );

  // Rebuild markers whenever the map becomes ready or a poll lands; the
  // `ready` state removes the old map-readiness wait loop entirely.
  useEffect(() => {
    if (!ready || !isReady() || !data) return;
    clearAnnotations();

    data.forEach(fire => {
      const color = rampColor(FIRE_RAMP, fire.brightness);
      addDotAnnotation(fire.lat, fire.lon, {
        color,
        radius: brightnessRadius(fire.brightness),
        opacity: 0.7,
        popupHtml: `<div style="font-family:var(--font-sans);font-size:12px;color:${tokens.text1};background:${tokens.glassBg};padding:8px 12px;border-radius:10px;border:1px solid ${tokens.borderCard};backdrop-filter:blur(20px)">
          <div style="font-family:var(--font-mono);font-weight:600;font-size:14px;color:${color}">${fire.brightness.toFixed(1)}K</div>
          <div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text3};margin-top:2px">${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}</div>
          <div style="margin-top:4px;color:${tokens.text2}">Confidence: ${confidenceLabel(fire.confidence)}</div>
          ${fire.frp > 0 ? `<div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text3};margin-top:2px">FRP ${fire.frp.toFixed(1)} MW</div>` : ''}
          ${fire.acqDate ? `<div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text3};margin-top:2px">${fire.acqDate} ${fire.acqTime}</div>` : ''}
        </div>`,
      });
    });
  }, [ready, isReady, clearAnnotations, addDotAnnotation, data]);

  return (
    <WidgetShell
      icon={<Flame size={18} />}
      title="Wildfires"
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="relative w-full h-full overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />

        {/* Count HUD */}
        <div className="absolute top-2.5 left-2.5 z-10 glass-chip px-3 py-2">
          <div className="flex items-baseline gap-1.5">
            <Flame size={13} className="self-center shrink-0" style={{ color: 'var(--color-critical)' }} aria-hidden />
            {data ? (
              <TickingNumber value={data.length} className="text-[18px] font-medium" />
            ) : (
              <span className="font-mono text-[18px]" style={{ color: 'var(--color-text-3)' }}>--</span>
            )}
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              active (24h)
            </span>
          </div>
        </div>

        {/* Legend generated from FIRE_RAMP */}
        <div className="absolute bottom-2.5 left-2.5 z-10 glass-chip flex items-center gap-3 flex-wrap px-2.5 py-1.5">
          {FIRE_RAMP.map(stop => (
            <span key={stop.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stop.color }} />
              <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
                {stop.label}
              </span>
            </span>
          ))}
        </div>

        {/* Feed unreachable and nothing cached yet */}
        {!data && phase === 'error' && (
          <div className="absolute inset-x-0 bottom-12 z-10 flex justify-center">
            <span className="glass-chip px-3 py-1.5 font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              no fire feed yet, retrying
            </span>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
