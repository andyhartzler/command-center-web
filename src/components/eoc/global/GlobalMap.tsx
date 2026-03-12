'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Map, { Source, Layer, MapRef, Popup, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computeNightPolygon } from '@/lib/solarTerminator';
import type { ActiveLayers } from './GlobalLayerPanel';

// Carto dark basemap (free, no key)
const MAP_STYLE = {
  version: 8 as const,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-dark': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'carto-dark-layer', type: 'raster' as const, source: 'carto-dark', minzoom: 0, maxzoom: 22 },
  ],
};

// SVG plane icon as data URI
const svgPlane = (color: string, size = 14) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="black" stroke-width="0.5"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`)}`;

interface FlightData {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  heading: number;
  model: string;
}

interface EarthquakeData {
  lat: number;
  lng: number;
  mag: number;
  place: string;
  title: string;
  time: number;
}

interface FireData {
  lat: number;
  lng: number;
  frp: number;
  confidence: string;
}

interface NewsData {
  title: string;
  risk_score: number;
  coords: [number, number] | null;
}

interface Props {
  activeLayers: ActiveLayers;
  flights?: { commercial: FlightData[]; military: FlightData[]; private: FlightData[] };
  earthquakes?: EarthquakeData[];
  fires?: FireData[];
  news?: NewsData[];
  flyToLocation?: { lat: number; lng: number } | null;
  onMouseCoords?: (lat: number, lng: number) => void;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function GlobalMap({ activeLayers, flights, earthquakes, fires, news, flyToLocation, onMouseCoords }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [popup, setPopup] = useState<{ lat: number; lng: number; content: string } | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 20,
    latitude: 25,
    zoom: 2.2,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 } as { top: number; bottom: number; left: number; right: number },
  });

  // Viewport bounds for culling
  const [bounds, setBounds] = useState<[number, number, number, number]>([-180, -90, 180, 90]);

  const updateBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    const latBuf = (b.getNorth() - b.getSouth()) * 0.2;
    const lngBuf = (b.getEast() - b.getWest()) * 0.2;
    setBounds([b.getWest() - lngBuf, b.getSouth() - latBuf, b.getEast() + lngBuf, b.getNorth() + latBuf]);
  }, []);

  const inView = useCallback(
    (lat: number, lng: number) => lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3],
    [bounds]
  );

  // Day/night overlay
  const [nightGeoJSON, setNightGeoJSON] = useState<GeoJSON.FeatureCollection>(() => computeNightPolygon());
  useEffect(() => {
    const timer = setInterval(() => setNightGeoJSON(computeNightPolygon()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fly to location
  useEffect(() => {
    if (flyToLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [flyToLocation.lng, flyToLocation.lat],
        zoom: 6,
        duration: 1500,
      });
    }
  }, [flyToLocation]);

  // Earthquakes GeoJSON
  const earthquakeGeoJSON = useMemo(() => {
    if (!activeLayers.earthquakes || !earthquakes?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: earthquakes.map((eq, i) => ({
        type: 'Feature' as const,
        properties: {
          id: i,
          mag: eq.mag,
          place: eq.place,
          title: eq.title || `M${eq.mag} - ${eq.place}`,
        },
        geometry: { type: 'Point' as const, coordinates: [eq.lng, eq.lat] },
      })),
    };
  }, [activeLayers.earthquakes, earthquakes]);

  // Fires GeoJSON - clustered
  const firesGeoJSON = useMemo(() => {
    if (!activeLayers.fires || !fires?.length) return EMPTY_FC;
    const visible = fires.filter(f => inView(f.lat, f.lng));
    return {
      type: 'FeatureCollection' as const,
      features: visible.map((f, i) => ({
        type: 'Feature' as const,
        properties: { id: i, frp: f.frp, confidence: f.confidence },
        geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      })),
    };
  }, [activeLayers.fires, fires, inView]);

  // News markers GeoJSON
  const newsGeoJSON = useMemo(() => {
    if (!activeLayers.news_markers || !news?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: news
        .filter(n => n.coords)
        .map((n, i) => ({
          type: 'Feature' as const,
          properties: { id: i, title: n.title, risk: n.risk_score },
          geometry: { type: 'Point' as const, coordinates: [n.coords![1], n.coords![0]] },
        })),
    };
  }, [activeLayers.news_markers, news]);

  // Flight markers - rendered as HTML markers for rotation support
  const flightMarkers = useMemo(() => {
    if (!flights) return [];
    const markers: { key: string; lat: number; lng: number; heading: number; color: string; label: string; alt: number }[] = [];

    if (activeLayers.military && flights.military) {
      for (const f of flights.military) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `mil-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: 'yellow', label: f.callsign || f.icao24, alt: f.alt });
        }
      }
    }
    if (activeLayers.flights && flights.commercial) {
      // Sample commercial flights for performance (max 2000 markers)
      const sample = flights.commercial.length > 2000
        ? flights.commercial.filter((_, i) => i % Math.ceil(flights.commercial.length / 2000) === 0)
        : flights.commercial;
      for (const f of sample) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `com-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: 'cyan', label: f.callsign || f.icao24, alt: f.alt });
        }
      }
    }
    if (activeLayers.private && flights.private) {
      const sample = flights.private.length > 1000
        ? flights.private.filter((_, i) => i % Math.ceil(flights.private.length / 1000) === 0)
        : flights.private;
      for (const f of sample) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `prv-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: '#FF8C00', label: f.callsign || f.icao24, alt: f.alt });
        }
      }
    }

    return markers;
  }, [flights, activeLayers, inView]);

  const handleClick = useCallback((e: any) => {
    // Check for feature clicks
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['earthquakes-circle', 'news-circle'],
    });
    if (features.length > 0) {
      const f = features[0];
      const coords = (f.geometry as any).coordinates;
      setPopup({
        lng: coords[0],
        lat: coords[1],
        content: f.properties?.title || f.properties?.place || 'Unknown',
      });
    } else {
      setPopup(null);
    }
  }, []);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => {
          setViewState({
            ...evt.viewState,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
          });
          if (onMouseCoords) {
            const { latitude, longitude } = evt.viewState;
            onMouseCoords(latitude, longitude);
          }
        }}
        onMoveEnd={updateBounds}
        onLoad={() => {
          setMapReady(true);
          updateBounds();
        }}
        onClick={handleClick}
        mapStyle={MAP_STYLE as any}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        maxZoom={18}
        minZoom={1.5}
      >
        {/* Day/Night overlay */}
        {activeLayers.day_night && (
          <Source id="night-overlay" type="geojson" data={nightGeoJSON}>
            <Layer
              id="night-fill"
              type="fill"
              paint={{
                'fill-color': '#000020',
                'fill-opacity': 0.35,
              }}
            />
          </Source>
        )}

        {/* Earthquake circles */}
        <Source id="earthquakes-src" type="geojson" data={earthquakeGeoJSON}>
          <Layer
            id="earthquakes-circle"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 4, 5, 10, 7, 20, 9, 35],
              'circle-color': ['interpolate', ['linear'], ['get', 'mag'],
                2.5, '#22c55e',
                4, '#eab308',
                5.5, '#f97316',
                7, '#ef4444',
                8, '#dc2626',
              ],
              'circle-opacity': 0.7,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(255,255,255,0.3)',
            }}
          />
          <Layer
            id="earthquakes-label"
            type="symbol"
            layout={{
              'text-field': ['concat', 'M', ['to-string', ['get', 'mag']]],
              'text-size': 10,
              'text-offset': [0, -1.5],
              'text-font': ['Open Sans Regular'],
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            }}
          />
        </Source>

        {/* Fire hotspots */}
        <Source id="fires-src" type="geojson" data={firesGeoJSON} cluster clusterMaxZoom={10} clusterRadius={30}>
          <Layer
            id="fires-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-radius': ['step', ['get', 'point_count'], 8, 20, 14, 100, 20, 500, 28],
              'circle-color': ['step', ['get', 'point_count'],
                '#ff8800', 20,
                '#ff4400', 100,
                '#cc0000', 500,
                '#880000',
              ],
              'circle-opacity': 0.8,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(255,100,0,0.3)',
            }}
          />
          <Layer
            id="fires-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 10,
              'text-font': ['Open Sans Regular'],
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="fires-unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 0, 3, 50, 6, 200, 10],
              'circle-color': ['interpolate', ['linear'], ['get', 'frp'],
                0, '#ffcc00',
                50, '#ff8800',
                150, '#ff2200',
                500, '#cc0000',
              ],
              'circle-opacity': 0.75,
            }}
          />
        </Source>

        {/* News/incident markers */}
        <Source id="news-src" type="geojson" data={newsGeoJSON}>
          <Layer
            id="news-circle"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'risk'], 1, 5, 5, 10, 10, 18],
              'circle-color': ['interpolate', ['linear'], ['get', 'risk'],
                1, '#22c55e',
                3, '#eab308',
                5, '#f97316',
                8, '#ef4444',
              ],
              'circle-opacity': 0.6,
              'circle-stroke-width': 2,
              'circle-stroke-color': ['interpolate', ['linear'], ['get', 'risk'],
                1, '#22c55e',
                5, '#f97316',
                8, '#ef4444',
              ],
              'circle-stroke-opacity': 0.4,
            }}
          />
        </Source>

        {/* Flight markers via HTML markers for rotation */}
        {flightMarkers.slice(0, 3000).map(m => (
          <Marker
            key={m.key}
            longitude={m.lng}
            latitude={m.lat}
            anchor="center"
            rotation={m.heading}
          >
            <img
              src={svgPlane(m.color, m.color === 'yellow' ? 16 : 12)}
              alt=""
              style={{ width: m.color === 'yellow' ? 16 : 12, height: m.color === 'yellow' ? 16 : 12 }}
              title={`${m.label} · ${Math.round(m.alt)} ft`}
            />
          </Marker>
        ))}

        {/* Popup */}
        {popup && (
          <Popup
            longitude={popup.lng}
            latitude={popup.lat}
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
            className="global-map-popup"
          >
            <div className="text-xs text-white max-w-[200px]">{popup.content}</div>
          </Popup>
        )}
      </Map>

      {/* Coordinate display */}
      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-white/30 pointer-events-none z-10">
        {viewState.latitude.toFixed(4)}°, {viewState.longitude.toFixed(4)}° · Z{viewState.zoom.toFixed(1)}
      </div>
    </div>
  );
}
