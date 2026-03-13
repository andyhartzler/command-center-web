'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppleMap } from '@/hooks/useAppleMap';
import type { AirTrafficConfig, WidgetStyle } from '@/types/widget';

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

function getAltitudeColor(alt: number): string {
  if (alt <= 0) return '#6b7280';
  if (alt < 5000) return '#22c55e';
  if (alt < 15000) return '#facc15';
  if (alt < 30000) return '#f97316';
  return '#06b6d4';
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

export function AirTrafficWidget({ config }: AirTrafficWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [aircraft, setAircraft] = useState<AircraftData[]>([]);
  const [loading, setLoading] = useState(true);
  const annotationsRef = useRef<mapkit.Annotation[]>([]);

  let zoom = 9;
  if (config.radiusNm > 200) zoom = 6;
  else if (config.radiusNm > 100) zoom = 7;
  else if (config.radiusNm > 50) zoom = 8;

  const { map, isReady } = useAppleMap(mapRef, {
    center: [config.centerLat, config.centerLon],
    zoom,
  });

  // Add radius circle overlay once map is ready
  useEffect(() => {
    const check = setInterval(() => {
      if (isReady() && map.current) {
        clearInterval(check);
        const radiusMeters = config.radiusNm * 1852;
        const circle = new mapkit.CircleOverlay(
          new mapkit.Coordinate(config.centerLat, config.centerLon),
          radiusMeters,
          {
            style: {
              fillColor: 'rgba(6, 182, 212, 0.05)',
              fillOpacity: 1,
              strokeColor: 'rgba(6, 182, 212, 0.3)',
              strokeOpacity: 1,
              lineWidth: 1,
            },
          }
        );
        map.current.addOverlay(circle);
      }
    }, 200);
    return () => clearInterval(check);
  }, [isReady, map, config.centerLat, config.centerLon, config.radiusNm]);

  const updateMarkers = useCallback((data: AircraftData[]) => {
    const m = map.current;
    if (!m) return;

    // Remove old annotations
    if (annotationsRef.current.length > 0) {
      m.removeAnnotations(annotationsRef.current);
    }
    annotationsRef.current = [];

    data.forEach((ac) => {
      const color = getAltitudeColor(ac.altitude);
      const altDisplay = ac.altitude > 0 ? `${(ac.altitude / 100).toFixed(0)}FL` : 'GND';
      const speedDisplay = ac.groundSpeed > 0 ? `${ac.groundSpeed}kt` : '';

      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(ac.lat, ac.lon),
        () => createAircraftElement(ac.heading, color),
        {
          anchorOffset: { x: 0, y: 0 },
          callout: {
            calloutContentForAnnotation: () => {
              const el = document.createElement('div');
              el.innerHTML = `<div style="font-family: system-ui; font-size: 11px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="font-weight: 700; font-size: 13px; color: ${color};">${ac.callsign || ac.hex}</div>
                ${ac.type ? `<div style="color: rgba(255,255,255,0.5); margin-top: 1px;">${ac.type}</div>` : ''}
                <div style="margin-top: 4px; display: flex; gap: 8px;">
                  <span>${altDisplay}</span>
                  ${speedDisplay ? `<span>${speedDisplay}</span>` : ''}
                  <span>${ac.heading.toFixed(0)}&deg;</span>
                </div>
              </div>`;
              return el;
            },
          },
        }
      );

      m.addAnnotation(annotation);
      annotationsRef.current.push(annotation);
    });
  }, [map]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/air-traffic?lat=${config.centerLat}&lon=${config.centerLon}&radius=${config.radiusNm}`
      );
      if (!res.ok) return;
      const data: AircraftData[] = await res.json();
      setAircraft(data);
      updateMarkers(data);
    } catch (err) {
      console.error('Failed to fetch air traffic:', err);
    } finally {
      setLoading(false);
    }
  }, [config.centerLat, config.centerLon, config.radiusNm, updateMarkers]);

  // Fetch after map ready
  useEffect(() => {
    const check = setInterval(() => {
      if (isReady()) {
        fetchData();
        clearInterval(check);
      }
    }, 200);
    return () => clearInterval(check);
  }, [isReady, fetchData]);

  // Poll every 10s
  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      <div
        className="absolute top-2.5 left-2.5 z-[1000] px-3 py-2.5 rounded-lg"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="text-[9px] font-bold text-white/50 uppercase mb-1"
          style={{ letterSpacing: '3px' }}
        >
          Air Traffic
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full bg-green-500" />
          <span className="text-[11px] font-medium text-white/70">
            {loading ? '--' : aircraft.length} aircraft
          </span>
        </div>
      </div>

      <div
        className="absolute bottom-2 left-2 z-[1000] px-2 py-1.5 rounded-md flex items-center gap-3"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-1">
          <div className="w-0 h-0" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #22c55e' }} />
          <span className="text-[9px] text-white/50">&lt;10k</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0 h-0" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #facc15' }} />
          <span className="text-[9px] text-white/50">10-30k</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0 h-0" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '7px solid #06b6d4' }} />
          <span className="text-[9px] text-white/50">&gt;30k</span>
        </div>
      </div>

      <div
        className="absolute top-2 right-2 z-[1000] px-2 py-1 rounded-md flex items-center gap-1.5"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
        <span className="text-[9px] text-white/50 font-medium">LIVE</span>
      </div>
    </div>
  );
}
