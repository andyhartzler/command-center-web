'use client';

import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAppleMap } from '@/hooks/useAppleMap';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { TickingNumber } from '../motion/TickingNumber';
import { tokens } from '@/lib/tokens';
import type { ConflictConfig, WidgetStyle } from '@/types/widget';

const POLL_INTERVAL = 10 * 60_000;

interface ConflictData {
  name: string;
  lat: number;
  lon: number;
  tone: number;
  urlCount: number;
}

interface ConflictWidgetProps {
  config: ConflictConfig;
  style: WidgetStyle;
}

/** Coverage (urlCount) sets dot size; GDELT tone (more negative = worse) sets heat. */
function markerSize(urlCount: number): number {
  return Math.max(10, Math.min(22, 8 + Math.sqrt(Math.max(0, urlCount)) * 2.2));
}

function markerHeat(tone: number): number {
  const severity = Math.min(1, Math.max(0, -tone) / 12);
  return 0.4 + severity * 0.6;
}

function conflictElement(size: number, heat: number): HTMLElement {
  const el = document.createElement('div');
  el.style.position = 'relative';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.cursor = 'pointer';
  const core = Math.round(size * 0.5);
  el.innerHTML = `
    <div style="
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: ${core}px; height: ${core}px; border-radius: 50%;
      background: ${tokens.critical};
      opacity: ${heat.toFixed(2)};
      box-shadow: 0 0 ${Math.round(size * 0.5)}px ${tokens.critical};
    "></div>
    <div style="
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: ${size}px; height: ${size}px; border-radius: 50%;
      border: 1.5px solid ${tokens.critical};
      animation: conflictPulse 2s ease-out infinite;
    "></div>
  `;
  return el;
}

function cleanEventName(name: string): string {
  const clean = name
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return clean.length > 80 ? clean.substring(0, 80) + '...' : clean;
}

export function ConflictWidget({ config, style }: ConflictWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const annotationsRef = useRef<mapkit.Annotation[]>([]);

  const { map, ready } = useAppleMap(mapRef, {
    center: [25, 30],
    zoom: 2,
  });

  const { data, phase, isStale, lastUpdated } = usePolledData<ConflictData[]>(
    `/api/conflicts?max=${config.maxEvents}`,
    { interval: POLL_INTERVAL },
  );

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !data) return;

    if (annotationsRef.current.length > 0) {
      m.removeAnnotations(annotationsRef.current);
    }
    annotationsRef.current = [];

    data.forEach(event => {
      const displayName = cleanEventName(event.name);
      const size = markerSize(event.urlCount);
      const heat = markerHeat(event.tone);

      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(event.lat, event.lon),
        () => conflictElement(size, heat),
        {
          anchorOffset: new DOMPoint(0, 0),
          callout: {
            calloutContentForAnnotation: () => {
              const el = document.createElement('div');
              el.innerHTML = `<div style="font-family:var(--font-sans);font-size:12px;color:${tokens.text1};background:${tokens.glassBg};padding:8px 12px;border-radius:10px;border:1px solid ${tokens.borderCard};backdrop-filter:blur(20px);max-width:240px">
                <div style="font-weight:600;color:${tokens.critical};line-height:1.3">${displayName}</div>
                <div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text2};margin-top:4px">${event.urlCount} reports, tone ${event.tone.toFixed(1)}</div>
                <div style="font-family:var(--font-mono);font-size:12px;color:${tokens.text3};margin-top:2px">${event.lat.toFixed(2)}, ${event.lon.toFixed(2)}</div>
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
    <WidgetShell
      icon={<ShieldAlert size={18} />}
      title="Conflict events"
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="relative w-full h-full overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />

        {/* Count HUD */}
        <div className="absolute top-2.5 left-2.5 z-10 glass-chip px-3 py-2">
          <div className="flex items-baseline gap-1.5">
            {data ? (
              <TickingNumber value={data.length} className="text-[18px] font-medium" />
            ) : (
              <span className="font-mono text-[18px]" style={{ color: 'var(--color-text-3)' }}>--</span>
            )}
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              events (24h)
            </span>
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            size coverage, heat tone
          </div>
        </div>

        {/* Feed unreachable and nothing cached yet */}
        {!data && phase === 'error' && (
          <div className="absolute inset-x-0 bottom-12 z-10 flex justify-center">
            <span className="glass-chip px-3 py-1.5 font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              no event feed yet, retrying
            </span>
          </div>
        )}

        <style jsx global>{`
          @keyframes conflictPulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
          }
        `}</style>
      </div>
    </WidgetShell>
  );
}
