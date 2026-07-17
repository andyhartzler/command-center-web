'use client';

import { useEffect, useRef } from 'react';
import { Plane } from 'lucide-react';
import { useAppleMap } from '@/hooks/useAppleMap';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
import { WidgetShell } from './WidgetShell';
import { TickingNumber } from '../motion/TickingNumber';
import { ALTITUDE_RAMP, rampColor } from '@/lib/dataviz-ramps';
import { tokens } from '@/lib/tokens';
import type { AirTrafficConfig, WidgetStyle } from '@/types/widget';

const POLL_INTERVAL = 10_000;

interface AircraftData {
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  callsign: string;
  hex: string;
  type: string;
  groundSpeed: number;
}

interface AirTrafficWidgetProps {
  config: AirTrafficConfig;
  style: WidgetStyle;
}

function aircraftColor(altitude: number): string {
  if (altitude <= 0) return tokens.text3;
  return rampColor(ALTITUDE_RAMP, altitude);
}

function createAircraftElement(heading: number, color: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${heading}, 9, 9)">
      <polygon points="9,1 14,15 9,12 4,15" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="0.5" stroke-opacity="0.5"/>
    </g>
  </svg>`;
  el.style.cursor = 'pointer';
  return el;
}

export function AirTrafficWidget({ config, style }: AirTrafficWidgetProps) {
  const now = useSharedClock();
  const mapRef = useRef<HTMLDivElement>(null);
  const annotationsRef = useRef<mapkit.Annotation[]>([]);
  const circleRef = useRef<mapkit.CircleOverlay | null>(null);

  let zoom = 9;
  if (config.radiusNm > 200) zoom = 6;
  else if (config.radiusNm > 100) zoom = 7;
  else if (config.radiusNm > 50) zoom = 8;

  const { map, ready } = useAppleMap(mapRef, {
    center: [config.centerLat, config.centerLon],
    zoom,
  });

  const { data, isStale, lastUpdated } = usePolledData<AircraftData[]>(
    `/api/air-traffic?lat=${config.centerLat}&lon=${config.centerLon}&radius=${config.radiusNm}`,
    { interval: POLL_INTERVAL },
  );

  // Radius circle: always remove the previous overlay before adding a new one
  // so config changes cannot accumulate stacked circles.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;

    if (circleRef.current) {
      m.removeOverlay(circleRef.current);
      circleRef.current = null;
    }

    const circle = new mapkit.CircleOverlay(
      new mapkit.Coordinate(config.centerLat, config.centerLon),
      config.radiusNm * 1852,
      {
        style: new mapkit.Style({
          fillColor: tokens.info,
          fillOpacity: 0.05,
          strokeColor: tokens.info,
          strokeOpacity: 0.3,
          lineWidth: 1,
        }),
      },
    );
    m.addOverlay(circle);
    circleRef.current = circle;

    return () => {
      if (circleRef.current && map.current) {
        // The map may already be destroyed during unmount teardown
        try {
          map.current.removeOverlay(circleRef.current);
        } catch {
          // no-op: destroyed map
        }
        circleRef.current = null;
      }
    };
  }, [ready, map, config.centerLat, config.centerLon, config.radiusNm]);

  // Aircraft markers: previous annotations are removed on every refresh.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !data) return;

    if (annotationsRef.current.length > 0) {
      m.removeAnnotations(annotationsRef.current);
    }
    annotationsRef.current = [];

    data.forEach(ac => {
      const color = aircraftColor(ac.altitude);
      const altDisplay = ac.altitude > 0 ? `${(ac.altitude / 100).toFixed(0)}FL` : 'GND';
      const speedDisplay = ac.groundSpeed > 0 ? `${ac.groundSpeed}kt` : '';

      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(ac.lat, ac.lon),
        () => createAircraftElement(ac.heading, color),
        {
          anchorOffset: new DOMPoint(0, 0),
          callout: {
            calloutContentForAnnotation: () => {
              const el = document.createElement('div');
              el.innerHTML = `<div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text1};background:${tokens.glassBg};padding:8px 12px;border-radius:10px;border:1px solid ${tokens.borderCard};backdrop-filter:blur(20px)">
                <div style="font-weight:600;font-size:13px;color:${color}">${ac.callsign || ac.hex}</div>
                ${ac.type ? `<div style="color:${tokens.text3};margin-top:1px">${ac.type}</div>` : ''}
                <div style="margin-top:4px;display:flex;gap:8px">
                  <span>${altDisplay}</span>
                  ${speedDisplay ? `<span>${speedDisplay}</span>` : ''}
                  <span>${ac.heading.toFixed(0)}&deg;</span>
                </div>
              </div>`;
              return el;
            },
          },
        },
      );

      m.addAnnotation(annotation);
      annotationsRef.current.push(annotation);
    });
  }, [ready, map, data]);

  return (
    <WidgetShell icon={<Plane size={18} />} title="Air traffic" style={style} chromeless>
      <div className="relative w-full h-full overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />

        {/* Count HUD */}
        <div className="absolute top-2.5 left-2.5 z-10 glass-chip flex items-baseline gap-1.5 px-3 py-2">
          <Plane size={13} className="self-center shrink-0" style={{ color: 'var(--color-accent-400)' }} aria-hidden />
          {data ? (
            <TickingNumber value={data.length} className="text-[18px] font-medium" />
          ) : (
            <span className="font-mono text-[18px]" style={{ color: 'var(--color-text-3)' }}>--</span>
          )}
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>aircraft</span>
        </div>

        {/* Freshness stamp */}
        <div className="absolute top-2.5 right-2.5 z-10 glass-chip flex items-center gap-2 px-2.5 py-1.5">
          {!isStale && lastUpdated && <span className="live-dot" aria-hidden />}
          <span
            className="font-mono text-[12px]"
            style={{ color: isStale ? 'var(--color-warn)' : 'var(--color-text-3)' }}
          >
            {lastUpdated
              ? isStale
                ? `stale, updated ${formatAge(lastUpdated, now)}`
                : `updated ${formatAge(lastUpdated, now)}`
              : 'connecting'}
          </span>
        </div>

        {/* Legend generated from ALTITUDE_RAMP */}
        <div className="absolute bottom-2.5 left-2.5 z-10 glass-chip flex items-center gap-3 flex-wrap px-2.5 py-1.5">
          {ALTITUDE_RAMP.map(stop => (
            <span key={stop.label} className="flex items-center gap-1.5">
              <span
                className="shrink-0"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderBottom: `7px solid ${stop.color}`,
                }}
              />
              <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
                {stop.label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}
