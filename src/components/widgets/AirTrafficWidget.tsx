'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

// Matches Swift: <5000 green, <15000 yellow, <30000 orange, else cyan
function getAltitudeColor(alt: number): string {
  if (alt <= 0) return '#6b7280';       // ground / unknown - gray
  if (alt < 5000) return '#22c55e';     // low - green
  if (alt < 15000) return '#facc15';    // mid - yellow
  if (alt < 30000) return '#f97316';    // mid-high - orange
  return '#06b6d4';                      // high - cyan
}

function createAircraftSVG(heading: number, color: string): string {
  return `
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading}, 9, 9)">
        <polygon points="9,1 14,15 9,12 4,15" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="0.5" stroke-opacity="0.5"/>
      </g>
    </svg>
  `;
}

export function AirTrafficWidget({ config, style }: AirTrafficWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<unknown[]>([]);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [aircraft, setAircraft] = useState<AircraftData[]>([]);
  const [loading, setLoading] = useState(true);

  const updateMarkers = useCallback((data: AircraftData[]) => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Remove old markers
    markersRef.current.forEach((m) => {
      (m as { remove: () => void }).remove();
    });
    markersRef.current = [];

    data.forEach((ac) => {
      const color = getAltitudeColor(ac.altitude);
      const svgHtml = createAircraftSVG(ac.heading, color);

      const icon = L.divIcon({
        html: svgHtml,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([ac.lat, ac.lon], { icon }).addTo(map);

      const altDisplay = ac.altitude > 0 ? `${(ac.altitude / 100).toFixed(0)}FL` : 'GND';
      const speedDisplay = ac.groundSpeed > 0 ? `${ac.groundSpeed}kt` : '';

      marker.bindPopup(
        `<div style="font-family: system-ui; font-size: 11px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="font-weight: 700; font-size: 13px; color: ${color};">${ac.callsign || ac.hex}</div>
          ${ac.type ? `<div style="color: rgba(255,255,255,0.5); margin-top: 1px;">${ac.type}</div>` : ''}
          <div style="margin-top: 4px; display: flex; gap: 8px;">
            <span>${altDisplay}</span>
            ${speedDisplay ? `<span>${speedDisplay}</span>` : ''}
            <span>${ac.heading.toFixed(0)}&deg;</span>
          </div>
        </div>`,
        {
          className: 'aircraft-popup',
          closeButton: false,
        }
      );

      markersRef.current.push(marker);
    });
  }, []);

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

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '',
        iconUrl: '',
        shadowUrl: '',
      });

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      ).addTo(map);

      // Calculate zoom based on radius
      let zoom = 9;
      if (config.radiusNm > 200) zoom = 6;
      else if (config.radiusNm > 100) zoom = 7;
      else if (config.radiusNm > 50) zoom = 8;

      map.setView([config.centerLat, config.centerLon], zoom);

      // Draw radius circle
      const radiusMeters = config.radiusNm * 1852;
      L.circle([config.centerLat, config.centerLon], {
        radius: radiusMeters,
        color: 'rgba(6, 182, 212, 0.3)',
        fillColor: 'rgba(6, 182, 212, 0.05)',
        fillOpacity: 1,
        weight: 1,
        dashArray: '4 4',
      }).addTo(map);

      mapInstanceRef.current = map;
      leafletRef.current = L;

      fetchData();
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      leafletRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 10s
  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* HUD Overlay - matches Swift: ultraThinMaterial, rounded 8 */}
      <div
        className="absolute top-2.5 left-2.5 z-[1000] px-3 py-2.5 rounded-lg"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Label - matches Swift: 9pt bold tracking 3 */}
        <div
          className="text-[9px] font-bold text-white/50 uppercase mb-1"
          style={{ letterSpacing: '3px' }}
        >
          Air Traffic
        </div>
        {/* Count - matches Swift: green dot + 11pt medium */}
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full bg-green-500" />
          <span className="text-[11px] font-medium text-white/70">
            {loading ? '--' : aircraft.length} aircraft
          </span>
        </div>
      </div>

      {/* Altitude legend */}
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

      {/* Live indicator */}
      <div
        className="absolute top-2 right-2 z-[1000] px-2 py-1 rounded-md flex items-center gap-1.5"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: '#22c55e' }}
        />
        <span className="text-[9px] text-white/50 font-medium">LIVE</span>
      </div>

      {/* Popup styles */}
      <style jsx global>{`
        .aircraft-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .aircraft-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .aircraft-popup .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>
    </div>
  );
}
