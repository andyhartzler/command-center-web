'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { EOCIncident } from '@/types/eoc';

interface EOCMapProps {
  incidents: EOCIncident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  flyToCoord?: { lat: number; lng: number } | null;
}

// KC center coordinates
const KC_CENTER: [number, number] = [39.0997, -94.5786];
const KC_ZOOM = 11;

export function EOCMap({ incidents, selectedId, onSelect, flyToCoord }: EOCMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  // Store latest callbacks in refs to avoid recreating map
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Initialize map
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;

      const L = await import('leaflet');
      // @ts-expect-error -- CSS import handled by Next.js bundler
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !mapContainerRef.current) return;

      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: KC_CENTER,
        zoom: KC_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark CartoDB tiles
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapRef.current = map;

      // Load KC city limits boundary
      try {
        const res = await fetch('/kc_city_limits.geojson');
        if (res.ok) {
          const geojson = await res.json();
          if (!cancelled && mapRef.current) {
            geoJsonLayerRef.current = L.geoJSON(geojson, {
              style: {
                color: '#3b82f6',
                weight: 1.5,
                opacity: 0.3,
                fillColor: '#3b82f6',
                fillOpacity: 0.03,
              },
            }).addTo(mapRef.current);
          }
        }
      } catch {
        // Silently skip if not available
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();
    };
  }, []);

  // Category color for marker backgrounds
  const categoryColor = useCallback((category: string): string => {
    switch (category) {
      case 'fire': return '#f97316';      // orange
      case 'medical': return '#3b82f6';    // blue
      case 'crime': return '#ef4444';      // red
      case 'shooting': return '#ef4444';   // red
      case 'traffic': return '#eab308';    // yellow
      case 'hazmat': return '#38bdf8';     // sky-blue
      default: return '#6b7280';           // gray
    }
  }, []);

  // Create emoji icon with severity ring (matching Swift annotation view)
  const createEmojiIcon = useCallback((incident: EOCIncident, isSelected: boolean) => {
    const L = leafletRef.current;
    if (!L) return undefined;

    const bgColor = categoryColor(incident.category);
    const size = isSelected ? 32 : 24;
    const fontSize = isSelected ? 16 : 12;
    const isCriticalOrMajor = incident.severity === 'critical' || incident.severity === 'major';
    const ringColor = incident.severity === 'critical' ? '#ef4444' : incident.severity === 'major' ? '#f97316' : 'transparent';

    return L.divIcon({
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${bgColor}dd;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${fontSize}px;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 2px 8px ${bgColor}80;
        border: ${isCriticalOrMajor ? `2px solid ${ringColor}` : 'none'};
        transform: scale(${isSelected ? 1.3 : 1});
        transition: transform 0.2s;
      ">${incident.emoji || '🔵'}</div>`,
      className: 'eoc-emoji-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, [categoryColor]);

  // Update markers when incidents change
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const currentMarkers = markersRef.current;
    const incidentIds = new Set(incidents.map(i => i.id));

    // Remove markers for incidents that no longer exist
    for (const [id, marker] of currentMarkers.entries()) {
      if (!incidentIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    }

    // Add or update markers
    for (const incident of incidents) {
      const isSelected = incident.id === selectedId;
      const icon = createEmojiIcon(incident, isSelected);

      const existingMarker = currentMarkers.get(incident.id);
      if (existingMarker) {
        existingMarker.setLatLng([incident.latitude, incident.longitude]);
        if (icon) existingMarker.setIcon(icon);
      } else {
        if (!icon) continue;
        const marker = L.marker([incident.latitude, incident.longitude], {
          icon,
        })
          .addTo(map)
          .on('click', () => {
            onSelectRef.current(incident.id);
          });

        marker.bindTooltip(incident.title, {
          direction: 'top',
          offset: [0, -12],
          className: 'eoc-tooltip',
        });

        currentMarkers.set(incident.id, marker);
      }
    }
  }, [incidents, selectedId, createEmojiIcon]);

  // Handle flyTo from parent (including reset view)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoord) return;

    // Special signal to reset view
    if (flyToCoord.lat === -999 && flyToCoord.lng === -999) {
      map.flyTo(KC_CENTER, KC_ZOOM, { duration: 1 });
      return;
    }

    map.flyTo([flyToCoord.lat, flyToCoord.lng], 14, { duration: 1 });
  }, [flyToCoord]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Custom tooltip styling */}
      <style jsx global>{`
        .eoc-emoji-marker {
          background: none !important;
          border: none !important;
        }
        .eoc-tooltip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.8) !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
        }
        .eoc-tooltip .leaflet-tooltip-tip {
          border-top-color: rgba(0, 0, 0, 0.85) !important;
        }
      `}</style>
    </div>
  );
}
