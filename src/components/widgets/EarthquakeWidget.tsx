'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Activity } from 'lucide-react';
import { useAppleMap } from '@/hooks/useAppleMap';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
import { WidgetShell, Freshness } from './WidgetShell';
import { TickingNumber } from '../motion/TickingNumber';
import { QUAKE_RAMP, rampColor } from '@/lib/dataviz-ramps';
import { tokens } from '@/lib/tokens';
import type { EarthquakeConfig, WidgetStyle } from '@/types/widget';

const POLL_INTERVAL = 120_000;

interface EarthquakeData {
  id: string;
  lat: number;
  lon: number;
  mag: number;
  place: string;
  time: number;
}

interface EarthquakeWidgetProps {
  config: EarthquakeConfig;
  style: WidgetStyle;
}

function magRadius(mag: number): number {
  return Math.max(3, Math.min(12, (mag - 3) * 3));
}

/** Marker element; new quakes settle in from scale 1.6 with a finite 3-ring pulse. */
function quakeElement(color: string, radius: number, isNew: boolean): HTMLElement {
  const size = Math.max(8, radius * 2);
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.cursor = 'pointer';

  const dot = document.createElement('div');
  dot.style.position = 'absolute';
  dot.style.inset = '0';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = color;
  dot.style.opacity = '0.75';
  dot.style.border = `1px solid ${color}`;
  wrap.appendChild(dot);

  if (isNew) {
    const ring = document.createElement('div');
    ring.className = 'ring-pulse';
    ring.style.position = 'absolute';
    ring.style.inset = '-2px';
    ring.style.borderRadius = '50%';
    ring.style.border = `1.5px solid ${color}`;
    // base opacity 0 so the ring vanishes once the finite animation ends
    ring.style.opacity = '0';
    wrap.appendChild(ring);

    dot.animate(
      [{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }],
      { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
  }

  return wrap;
}

export function EarthquakeWidget({ config, style }: EarthquakeWidgetProps) {
  const now = useSharedClock();
  const mapRef = useRef<HTMLDivElement>(null);

  const center: [number, number] = config.region === 'us' ? [39.5, -98.35] : [20, 0];
  const zoom = config.region === 'us' ? 4 : 2;
  const minMag = config.minMagnitude ?? 2.5;

  const { map, ready } = useAppleMap(mapRef, { center, zoom });

  const { data, phase, isStale, lastUpdated } = usePolledData<EarthquakeData[]>(
    '/api/earthquakes',
    { interval: POLL_INTERVAL },
  );

  const filtered = useMemo(() => {
    if (!data) return null;
    return data.filter(q => q.mag >= minMag).slice(0, config.maxQuakes);
  }, [data, minMag, config.maxQuakes]);

  const strongest = useMemo(() => {
    if (!filtered || filtered.length === 0) return null;
    return filtered.reduce((a, b) => (b.mag > a.mag ? b : a));
  }, [filtered]);

  // Newest M6+ in the feed drives the headline strip
  const major = useMemo(() => {
    if (!data) return null;
    let newest: EarthquakeData | null = null;
    for (const q of data) {
      if (q.mag >= 6 && (!newest || q.time > newest.time)) newest = q;
    }
    return newest;
  }, [data]);

  // ids seen on previous renders; null until the first dataset lands so the
  // initial backfill does not fire entrance animations
  const seenIds = useRef<Set<string> | null>(null);
  const annotationsRef = useRef<mapkit.Annotation[]>([]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !data || !filtered) return;

    if (annotationsRef.current.length > 0) {
      m.removeAnnotations(annotationsRef.current);
    }
    annotationsRef.current = [];

    const known = seenIds.current;

    filtered.forEach(quake => {
      const color = rampColor(QUAKE_RAMP, quake.mag);
      const isNew = known !== null && !known.has(quake.id);
      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(quake.lat, quake.lon),
        () => quakeElement(color, magRadius(quake.mag), isNew),
        {
          anchorOffset: new DOMPoint(0, 0),
          callout: {
            calloutContentForAnnotation: () => {
              const el = document.createElement('div');
              el.innerHTML = `<div style="font-family:var(--font-sans);font-size:12px;color:${tokens.text1};background:${tokens.glassBg};padding:8px 12px;border-radius:10px;border:1px solid ${tokens.borderCard};backdrop-filter:blur(20px)">
                <div style="font-family:var(--font-mono);font-weight:600;font-size:14px;color:${color}">M${quake.mag.toFixed(1)}</div>
                <div style="margin-top:2px">${quake.place}</div>
                <div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text3};margin-top:2px">${formatAge(quake.time, Date.now())}</div>
              </div>`;
              return el;
            },
          },
        },
      );
      m.addAnnotation(annotation);
      annotationsRef.current.push(annotation);
    });

    // Track every id in the feed, not just the plotted slice, so quakes that
    // drop out of the maxQuakes window and return do not replay their entrance.
    seenIds.current = new Set(data.map(q => q.id));
  }, [ready, map, data, filtered]);

  return (
    <WidgetShell
      icon={<Activity size={18} />}
      title="Earthquakes"
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="relative w-full h-full overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />

        {/* Count HUD */}
        <div className="absolute top-2.5 left-2.5 z-10 glass-chip px-3 py-2">
          <div className="flex items-baseline gap-1.5">
            {filtered ? (
              <TickingNumber value={filtered.length} className="text-[18px] font-medium" />
            ) : (
              <span className="font-mono text-[18px]" style={{ color: 'var(--color-text-3)' }}>--</span>
            )}
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              M{minMag.toFixed(1)}+ today
            </span>
          </div>
          {strongest && (
            <div
              className="font-mono text-[12px] mt-0.5 truncate max-w-[200px]"
              style={{ color: 'var(--color-text-2)' }}
            >
              M{strongest.mag.toFixed(1)} {strongest.place}
            </div>
          )}
        </div>

        {/* Legend generated from QUAKE_RAMP */}
        <div className="absolute bottom-2.5 left-2.5 z-10 glass-chip flex items-center gap-3 flex-wrap px-2.5 py-1.5">
          {QUAKE_RAMP.map(stop => (
            <span key={stop.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stop.color }} />
              <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
                {stop.label}
              </span>
            </span>
          ))}
        </div>

        {/* Newest M6+ headline strip */}
        {major && (
          <div className="absolute top-2.5 right-2.5 z-10 glass-chip flex items-center gap-2 px-3 py-2 max-w-[62%]">
            <span className="live-dot shrink-0" style={{ background: 'var(--color-critical)' }} aria-hidden />
            <span
              className="font-mono text-[13px] font-semibold truncate"
              style={{ color: 'var(--color-critical)' }}
            >
              M{major.mag.toFixed(1)}, {major.place}, {formatAge(major.time, now)}
            </span>
          </div>
        )}

        {/* Feed unreachable and nothing cached yet */}
        {!data && phase === 'error' && (
          <div className="absolute inset-x-0 bottom-12 z-10 flex justify-center">
            <span className="glass-chip px-3 py-1.5 font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              no quake feed yet, retrying
            </span>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
