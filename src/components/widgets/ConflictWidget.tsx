'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ConflictConfig, WidgetStyle } from '@/types/widget';

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

function createPulsingIcon(L: typeof import('leaflet')): ReturnType<typeof L.divIcon> {
  return L.divIcon({
    html: `
      <div style="position: relative; width: 16px; height: 16px;">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid rgba(239, 68, 68, 0.6);
          animation: conflictPulse 2s ease-out infinite;
        "></div>
      </div>
    `,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function ConflictWidget({ config, style }: ConflictWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<unknown[]>([]);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [events, setEvents] = useState<ConflictData[]>([]);
  const [loading, setLoading] = useState(true);
  const dataFetchedRef = useRef(false);

  const updateMarkers = useCallback((data: ConflictData[]) => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    markersRef.current.forEach((m) => {
      (m as { remove: () => void }).remove();
    });
    markersRef.current = [];

    const icon = createPulsingIcon(L);

    data.forEach((event) => {
      const marker = L.marker([event.lat, event.lon], { icon }).addTo(map);

      // Clean up HTML entities from name
      const cleanName = event.name
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // Truncate long names
      const displayName = cleanName.length > 80 ? cleanName.substring(0, 80) + '...' : cleanName;

      marker.bindPopup(
        `<div style="font-family: system-ui; font-size: 11px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); max-width: 240px;">
          <div style="font-weight: 600; font-size: 12px; color: #fca5a5; line-height: 1.3;">${displayName}</div>
          <div style="color: rgba(255,255,255,0.4); margin-top: 4px; font-size: 10px;">
            ${event.lat.toFixed(2)}, ${event.lon.toFixed(2)}
          </div>
        </div>`,
        {
          className: 'conflict-popup',
          closeButton: false,
        }
      );

      markersRef.current.push(marker);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (dataFetchedRef.current) return;
    try {
      const res = await fetch(`/api/conflicts?max=${config.maxEvents}`);
      if (!res.ok) return;
      const data: ConflictData[] = await res.json();
      setEvents(data);
      updateMarkers(data);
      dataFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch conflicts:', err);
    } finally {
      setLoading(false);
    }
  }, [config.maxEvents, updateMarkers]);

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
        worldCopyJump: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      ).addTo(map);

      map.setView([25, 30], 2);
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

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* HUD Overlay - matches Swift: ultraThinMaterial, rounded 8 */}
      <div
        className="absolute top-2.5 left-2.5 z-[1000] px-2.5 py-2 rounded-lg"
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
          Conflict Monitor
        </div>
        {/* Count - matches Swift: red dot + 11pt medium */}
        <div className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full bg-red-500" />
          <span className="text-[11px] font-medium text-white/70">
            {loading ? '--' : events.length} events (24h)
          </span>
        </div>
      </div>

      {/* Pulse animation + Popup styles */}
      <style jsx global>{`
        @keyframes conflictPulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.5);
            opacity: 0;
          }
        }
        .conflict-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .conflict-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .conflict-popup .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(239, 68, 68, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
