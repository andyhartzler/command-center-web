'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '@/context/AppState';
import { MapPin, Plus, Loader2, X, Video } from 'lucide-react';

interface ScoutCamera {
  id: string;
  name: string;
  streamFile: string;
  latitude: number;
  longitude: number;
}

// KC center
const KC_CENTER: [number, number] = [39.05, -94.58];
const KC_ZOOM = 10;

export function CameraBrowser({ onClose }: { onClose: () => void }) {
  const { addWidget } = useAppState();
  const [cameras, setCameras] = useState<ScoutCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<ScoutCamera | null>(null);
  const [snapshotError, setSnapshotError] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const leafletRef = useRef<typeof import('leaflet') | null>(null);

  // Load cameras from API
  useEffect(() => {
    async function loadCameras() {
      try {
        const res = await fetch('/api/webcams?action=list');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const cams: ScoutCamera[] = (data.cameras || []).filter(
          (c: ScoutCamera) => c.latitude && c.longitude
        );
        setCameras(cams);
      } catch {
        setCameras([]);
      } finally {
        setLoading(false);
      }
    }
    loadCameras();
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;

      const L = await import('leaflet');
      // @ts-expect-error -- CSS import handled by bundler
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !mapContainerRef.current) return;

      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: KC_CENTER,
        zoom: KC_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19 }
      ).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapRef.current = map;
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

  // Add camera markers to map
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || cameras.length === 0) return;

    // Clear old markers
    for (const marker of markersRef.current.values()) {
      marker.remove();
    }
    markersRef.current.clear();

    // Add markers for each camera
    for (const cam of cameras) {
      const marker = L.circleMarker([cam.latitude, cam.longitude], {
        radius: 4,
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.8,
        weight: 1,
      }).addTo(map);

      marker.on('click', () => {
        handleSelectCamera(cam);
      });

      marker.bindTooltip(cam.name, {
        direction: 'top',
        offset: [0, -6],
        className: 'camera-browser-tooltip',
      });

      markersRef.current.set(cam.id, marker);
    }
  }, [cameras]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCamera = useCallback((cam: ScoutCamera) => {
    setSelectedCamera(cam);
    setSnapshotError(false);

    // Highlight selected marker
    const L = leafletRef.current;
    if (!L) return;

    for (const [id, marker] of markersRef.current.entries()) {
      if (id === cam.id) {
        marker.setStyle({ radius: 8, color: '#3b82f6', fillColor: '#3b82f6', weight: 2 });
      } else {
        marker.setStyle({ radius: 4, color: '#f97316', fillColor: '#f97316', weight: 1 });
      }
    }

    // Fly to camera
    mapRef.current?.flyTo([cam.latitude, cam.longitude], 14, { duration: 0.8 });
  }, []);

  const handleAddCamera = useCallback((cam: ScoutCamera) => {
    addWidget('webcams', 'medium', {
      type: 'webcams',
      config: {
        cameraIds: [cam.id],
        cameraNames: [cam.name],
        corridorFilter: [],
        loadAllCameras: false,
        rotateIntervalSeconds: 30,
        viewMode: 'single',
      },
    });
  }, [addWidget]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <MapPin size={13} className="text-orange-400" />
          <span className="text-[12px] font-semibold text-white/80">KC Scout Cameras</span>
          {!loading && (
            <span className="text-[10px] font-bold text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
              {cameras.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X size={12} className="text-white/50" />
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-[250px]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <Loader2 size={16} className="text-white/60 animate-spin" />
            <span className="text-[11px] text-white/50">Loading cameras...</span>
          </div>
        )}

        {/* Camera count badge */}
        {!loading && cameras.length > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded-full">
            <Video size={9} className="text-white/70" />
            <span className="text-[10px] font-bold text-white/80">{cameras.length}</span>
          </div>
        )}
      </div>

      {/* Selected camera panel */}
      <div className="border-t border-white/[0.06]">
        {selectedCamera ? (
          <div className="p-3">
            {/* Snapshot preview */}
            <div className="rounded-lg overflow-hidden bg-white/[0.03] mb-2">
              {!snapshotError ? (
                <img
                  src={`https://www.kcscout.net/mapsubsystem/snapshots/${selectedCamera.id}.jpg`}
                  alt={selectedCamera.name}
                  className="w-full h-[120px] object-cover"
                  onError={() => setSnapshotError(true)}
                />
              ) : (
                <div className="w-full h-[120px] flex flex-col items-center justify-center gap-1">
                  <Video size={18} className="text-white/15" />
                  <span className="text-[9px] text-white/25">No preview</span>
                </div>
              )}
            </div>

            {/* Camera info + add button */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white/80 truncate">
                  {selectedCamera.name}
                </div>
                <div className="text-[9px] font-mono text-white/25">
                  {selectedCamera.id}
                </div>
              </div>
              <button
                onClick={() => handleAddCamera(selectedCamera)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-md text-[11px] font-semibold transition-colors shrink-0"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-5">
            <MapPin size={16} className="text-white/15" />
            <span className="text-[11px] text-white/25 text-center px-4">
              Tap a camera pin on the map to preview and add it
            </span>
          </div>
        )}
      </div>

      {/* Tooltip styling */}
      <style jsx global>{`
        .camera-browser-tooltip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.8) !important;
          font-size: 10px !important;
          padding: 3px 6px !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
        }
        .camera-browser-tooltip .leaflet-tooltip-tip {
          border-top-color: rgba(0, 0, 0, 0.85) !important;
        }
      `}</style>
    </div>
  );
}
