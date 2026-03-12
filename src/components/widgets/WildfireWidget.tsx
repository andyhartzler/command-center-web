'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { WildfireConfig, WidgetStyle } from '@/types/widget';

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

function getBrightnessColor(brightness: number): string {
  if (brightness < 340) return '#facc15';    // yellow - lower intensity
  if (brightness < 400) return '#f97316';    // orange - medium
  return '#ef4444';                           // red - high intensity
}

function getBrightnessRadius(brightness: number): number {
  return Math.max(3, Math.min(10, (brightness - 300) / 20));
}

export function WildfireWidget({ config, style }: WildfireWidgetProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<unknown[]>([]);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [fires, setFires] = useState<WildfireData[]>([]);
  const [loading, setLoading] = useState(true);
  const dataFetchedRef = useRef(false);

  const updateMarkers = useCallback((data: WildfireData[]) => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    markersRef.current.forEach((m) => {
      (m as { remove: () => void }).remove();
    });
    markersRef.current = [];

    data.forEach((fire) => {
      const color = getBrightnessColor(fire.brightness);
      const radius = getBrightnessRadius(fire.brightness);

      // Outer glow circle
      const glow = L.circleMarker([fire.lat, fire.lon], {
        radius: radius + 3,
        fillColor: color,
        fillOpacity: 0.15,
        color: color,
        weight: 0,
        opacity: 0,
      }).addTo(map);

      // Inner marker
      const circle = L.circleMarker([fire.lat, fire.lon], {
        radius: radius,
        fillColor: color,
        fillOpacity: 0.7,
        color: color,
        weight: 1,
        opacity: 0.5,
      }).addTo(map);

      const confDisplay = fire.confidence === 'high' || fire.confidence === 'h'
        ? 'High'
        : fire.confidence === 'nominal' || fire.confidence === 'n'
          ? 'Nominal'
          : fire.confidence === 'low' || fire.confidence === 'l'
            ? 'Low'
            : fire.confidence;

      circle.bindPopup(
        `<div style="font-family: system-ui; font-size: 11px; color: #fff; background: rgba(0,0,0,0.85); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(249, 115, 22, 0.2);">
          <div style="font-weight: 700; font-size: 13px; color: ${color};">
            ${fire.brightness.toFixed(1)}K
          </div>
          <div style="color: rgba(255,255,255,0.5); margin-top: 2px;">
            ${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}
          </div>
          <div style="margin-top: 4px; display: flex; gap: 8px; color: rgba(255,255,255,0.6);">
            <span>Confidence: ${confDisplay}</span>
          </div>
          ${fire.frp > 0 ? `<div style="color: rgba(255,255,255,0.5); margin-top: 2px;">FRP: ${fire.frp.toFixed(1)} MW</div>` : ''}
          ${fire.acqDate ? `<div style="color: rgba(255,255,255,0.3); margin-top: 2px;">${fire.acqDate} ${fire.acqTime}</div>` : ''}
        </div>`,
        {
          className: 'wildfire-popup',
          closeButton: false,
        }
      );

      markersRef.current.push(glow, circle);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (dataFetchedRef.current) return;
    try {
      const res = await fetch('/api/wildfires');
      if (!res.ok) return;
      const data: WildfireData[] = await res.json();
      setFires(data);
      updateMarkers(data);
      dataFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch wildfires:', err);
    } finally {
      setLoading(false);
    }
  }, [updateMarkers]);

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

      const center: [number, number] = config.region === 'us' ? [39.5, -98.35] : [20, 0];
      const zoom = config.region === 'us' ? 4 : 2;

      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      ).addTo(map);

      map.setView(center, zoom);
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
          Wildfires
        </div>
        {/* Count - matches Swift: flame icon + 11pt medium */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🔥</span>
          <span className="text-[11px] font-medium text-white/70">
            {loading ? '--' : fires.length.toLocaleString()} active (24h)
          </span>
        </div>
        {/* Legend - matches Swift: Low/Med/High dots */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-yellow-400" />
            <span className="text-[8px] text-white/40">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-orange-400" />
            <span className="text-[8px] text-white/40">Med</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[5px] h-[5px] rounded-full bg-red-500" />
            <span className="text-[8px] text-white/40">High</span>
          </div>
        </div>
      </div>

      {/* Popup styles */}
      <style jsx global>{`
        .wildfire-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .wildfire-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .wildfire-popup .leaflet-popup-tip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(249, 115, 22, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
