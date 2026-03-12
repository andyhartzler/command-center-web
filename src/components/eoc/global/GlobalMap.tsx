'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Map, { Source, Layer, MapRef, Popup, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computeNightPolygon } from '@/lib/solarTerminator';
import type { ActiveLayers } from './GlobalLayerPanel';

import { getMapStyle, type MapStyleId } from './GlobalMapStyleSwitcher';

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

interface SatelliteData {
  lat: number;
  lng: number;
  alt: number;
  name: string;
  noradId: number;
  type: string;
}

interface CarrierData {
  hull: string;
  name: string;
  lat: number;
  lng: number;
  heading: number;
  desc: string;
  wiki: string;
  source: string;
}

interface CCTVData {
  id: string;
  source: string;
  lat: number;
  lng: number;
  name: string;
  mediaUrl: string;
}

interface KiwiSDRData {
  name: string;
  lat: number;
  lng: number;
  url: string;
  users: number;
  usersMax: number;
  bands: string;
  location: string;
}

interface GDELTIncident {
  title: string;
  lat: number | null;
  lng: number | null;
  source: string;
}

interface JammingZone {
  lat: number;
  lng: number;
  count: number;
  avgNacp: number;
  severity: string;
}

interface Props {
  activeLayers: ActiveLayers;
  flights?: { commercial: FlightData[]; military: FlightData[]; private: FlightData[]; tracked?: FlightData[]; jammingZones?: JammingZone[] };
  earthquakes?: EarthquakeData[];
  fires?: FireData[];
  news?: NewsData[];
  satellites?: SatelliteData[];
  carriers?: CarrierData[];
  cctv?: CCTVData[];
  kiwisdr?: KiwiSDRData[];
  frontlines?: any; // GeoJSON
  gdeltIncidents?: GDELTIncident[];
  mapStyle?: MapStyleId;
  flyToLocation?: { lat: number; lng: number } | null;
  onMouseCoords?: (lat: number, lng: number) => void;
  onContextMenu?: (lat: number, lng: number) => void;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function GlobalMap({
  activeLayers, flights, earthquakes, fires, news,
  satellites, carriers, cctv, kiwisdr, frontlines, gdeltIncidents,
  mapStyle = 'dark', flyToLocation, onMouseCoords, onContextMenu,
}: Props) {
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

  // Satellites GeoJSON
  const satelliteGeoJSON = useMemo(() => {
    if (!activeLayers.satellites || !satellites?.length) return EMPTY_FC;
    const visible = satellites.filter(s => inView(s.lat, s.lng));
    return {
      type: 'FeatureCollection' as const,
      features: visible.map((s, i) => ({
        type: 'Feature' as const,
        properties: { id: i, name: s.name, alt: s.alt, type: s.type },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      })),
    };
  }, [activeLayers.satellites, satellites, inView]);

  // CCTV GeoJSON - clustered
  const cctvGeoJSON = useMemo(() => {
    if (!activeLayers.cctv || !cctv?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: cctv.map((c, i) => ({
        type: 'Feature' as const,
        properties: { id: i, name: c.name, source: c.source, mediaUrl: c.mediaUrl },
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      })),
    };
  }, [activeLayers.cctv, cctv]);

  // KiwiSDR GeoJSON - clustered
  const kiwisdrGeoJSON = useMemo(() => {
    if (!activeLayers.kiwisdr || !kiwisdr?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: kiwisdr.map((k, i) => ({
        type: 'Feature' as const,
        properties: { id: i, name: k.name, users: k.users, usersMax: k.usersMax, url: k.url },
        geometry: { type: 'Point' as const, coordinates: [k.lng, k.lat] },
      })),
    };
  }, [activeLayers.kiwisdr, kiwisdr]);

  // GDELT incidents GeoJSON
  const gdeltGeoJSON = useMemo(() => {
    if (!activeLayers.gdelt_incidents || !gdeltIncidents?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: gdeltIncidents
        .filter(g => g.lat != null && g.lng != null)
        .map((g, i) => ({
          type: 'Feature' as const,
          properties: { id: i, title: g.title, source: g.source },
          geometry: { type: 'Point' as const, coordinates: [g.lng!, g.lat!] },
        })),
    };
  }, [activeLayers.gdelt_incidents, gdeltIncidents]);

  // Frontlines GeoJSON
  const frontlinesGeoJSON = useMemo(() => {
    if (!activeLayers.frontlines || !frontlines) return EMPTY_FC;
    return frontlines;
  }, [activeLayers.frontlines, frontlines]);

  // GPS Jamming zones GeoJSON
  const jammingGeoJSON = useMemo(() => {
    if (!activeLayers.gps_jamming || !flights?.jammingZones?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: flights.jammingZones.map((z, i) => ({
        type: 'Feature' as const,
        properties: { id: i, count: z.count, avgNacp: z.avgNacp, severity: z.severity },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [z.lng - 0.5, z.lat - 0.5],
            [z.lng + 0.5, z.lat - 0.5],
            [z.lng + 0.5, z.lat + 0.5],
            [z.lng - 0.5, z.lat + 0.5],
            [z.lng - 0.5, z.lat - 0.5],
          ]],
        },
      })),
    };
  }, [activeLayers.gps_jamming, flights?.jammingZones]);

  // Flight markers
  const flightMarkers = useMemo(() => {
    if (!flights) return [];
    const markers: { key: string; lat: number; lng: number; heading: number; color: string; label: string; alt: number; speed: number; model: string }[] = [];

    // Tracked / POTUS fleet (always visible on top, bright pink)
    if (activeLayers.tracked && flights.tracked) {
      for (const f of flights.tracked) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `trk-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: '#ec4899', label: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model });
        }
      }
    }

    if (activeLayers.military && flights.military) {
      for (const f of flights.military) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `mil-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: 'yellow', label: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model });
        }
      }
    }
    if (activeLayers.flights && flights.commercial) {
      const sample = flights.commercial.length > 2000
        ? flights.commercial.filter((_: any, i: number) => i % Math.ceil(flights.commercial.length / 2000) === 0)
        : flights.commercial;
      for (const f of sample) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `com-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: 'cyan', label: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model });
        }
      }
    }
    if (activeLayers.private && flights.private) {
      const sample = flights.private.length > 1000
        ? flights.private.filter((_: any, i: number) => i % Math.ceil(flights.private.length / 1000) === 0)
        : flights.private;
      for (const f of sample) {
        if (inView(f.lat, f.lng)) {
          markers.push({ key: `prv-${f.icao24}`, lat: f.lat, lng: f.lng, heading: f.heading, color: '#FF8C00', label: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model });
        }
      }
    }

    return markers;
  }, [flights, activeLayers, inView]);

  const handleClick = useCallback((e: any) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const queryLayers = [
      'earthquakes-circle', 'news-circle', 'satellites-circle',
      'cctv-clusters', 'cctv-unclustered', 'kiwisdr-clusters', 'kiwisdr-unclustered',
      'gdelt-circle',
    ];
    const features = map.queryRenderedFeatures(e.point, { layers: queryLayers });
    if (features.length > 0) {
      const f = features[0];
      const coords = (f.geometry as any).coordinates;
      const p = f.properties || {};

      let content = p.title || p.name || p.place || 'Unknown';
      if (p.point_count) {
        content = `Cluster: ${p.point_count} items`;
      } else if (p.alt !== undefined) {
        content = `${p.name} · ${p.type} · ${p.alt} km`;
      } else if (p.source && p.mediaUrl) {
        content = `${p.name} · ${p.source}`;
      }

      setPopup({ lng: coords[0], lat: coords[1], content });
    } else {
      setPopup(null);
    }
  }, []);

  const handleContextMenu = useCallback((e: any) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e.lngLat.lat, e.lngLat.lng);
    }
  }, [onContextMenu]);

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
        onContextMenu={handleContextMenu}
        mapStyle={getMapStyle(mapStyle) as any}
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

        {/* GPS Jamming Zones */}
        <Source id="jamming-src" type="geojson" data={jammingGeoJSON}>
          <Layer
            id="jamming-fill"
            type="fill"
            paint={{
              'fill-color': ['match', ['get', 'severity'],
                'severe', '#ef4444',
                'moderate', '#f97316',
                '#eab308',
              ],
              'fill-opacity': ['match', ['get', 'severity'],
                'severe', 0.3,
                'moderate', 0.2,
                0.12,
              ],
            }}
          />
          <Layer
            id="jamming-outline"
            type="line"
            paint={{
              'line-color': '#ef4444',
              'line-width': 1,
              'line-opacity': 0.4,
              'line-dasharray': [3, 2],
            }}
          />
          <Layer
            id="jamming-label"
            type="symbol"
            layout={{
              'text-field': ['concat', 'GPS JAM\n', ['to-string', ['get', 'count']], ' AC'],
              'text-size': 9,
              'text-font': ['Open Sans Regular'],
            }}
            paint={{
              'text-color': '#ef4444',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
              'text-opacity': 0.7,
            }}
          />
        </Source>

        {/* Ukraine Frontlines */}
        <Source id="frontlines-src" type="geojson" data={frontlinesGeoJSON}>
          <Layer
            id="frontlines-fill"
            type="fill"
            filter={['==', ['geometry-type'], 'Polygon']}
            paint={{
              'fill-color': '#ef4444',
              'fill-opacity': 0.15,
            }}
          />
          <Layer
            id="frontlines-line"
            type="line"
            filter={['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']]}
            paint={{
              'line-color': '#ef4444',
              'line-width': 2,
              'line-opacity': 0.7,
            }}
          />
        </Source>

        {/* GDELT Military Incidents */}
        <Source id="gdelt-src" type="geojson" data={gdeltGeoJSON}>
          <Layer
            id="gdelt-circle"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': '#f87171',
              'circle-opacity': 0.5,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ef4444',
              'circle-stroke-opacity': 0.4,
            }}
          />
          <Layer
            id="gdelt-pulse"
            type="circle"
            paint={{
              'circle-radius': 12,
              'circle-color': 'transparent',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ef4444',
              'circle-stroke-opacity': 0.2,
            }}
          />
        </Source>

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

        {/* Satellites */}
        <Source id="satellites-src" type="geojson" data={satelliteGeoJSON}>
          <Layer
            id="satellites-circle"
            type="circle"
            paint={{
              'circle-radius': ['match', ['get', 'type'],
                'station', 6,
                'military', 4,
                'navigation', 4,
                3,
              ],
              'circle-color': ['match', ['get', 'type'],
                'station', '#ffffff',
                'starlink', '#818cf8',
                'military', '#fbbf24',
                'navigation', '#34d399',
                '#a78bfa',
              ],
              'circle-opacity': 0.8,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(255,255,255,0.2)',
            }}
          />
          <Layer
            id="satellites-label"
            type="symbol"
            filter={['any',
              ['==', ['get', 'type'], 'station'],
              ['==', ['get', 'type'], 'military'],
            ]}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 9,
              'text-offset': [0, 1.2],
              'text-font': ['Open Sans Regular'],
              'text-max-width': 10,
            }}
            paint={{
              'text-color': '#a78bfa',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            }}
          />
        </Source>

        {/* CCTV Cameras - clustered */}
        <Source id="cctv-src" type="geojson" data={cctvGeoJSON} cluster clusterMaxZoom={12} clusterRadius={40}>
          <Layer
            id="cctv-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-radius': ['step', ['get', 'point_count'], 8, 10, 12, 50, 16, 200, 22],
              'circle-color': '#22c55e',
              'circle-opacity': 0.6,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(34,197,94,0.3)',
            }}
          />
          <Layer
            id="cctv-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 9,
              'text-font': ['Open Sans Regular'],
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="cctv-unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': 4,
              'circle-color': '#22c55e',
              'circle-opacity': 0.6,
            }}
          />
        </Source>

        {/* KiwiSDR Receivers - clustered */}
        <Source id="kiwisdr-src" type="geojson" data={kiwisdrGeoJSON} cluster clusterMaxZoom={10} clusterRadius={35}>
          <Layer
            id="kiwisdr-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-radius': ['step', ['get', 'point_count'], 8, 10, 12, 50, 16],
              'circle-color': '#f59e0b',
              'circle-opacity': 0.6,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(245,158,11,0.3)',
            }}
          />
          <Layer
            id="kiwisdr-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 9,
              'text-font': ['Open Sans Regular'],
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="kiwisdr-unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': 4,
              'circle-color': '#f59e0b',
              'circle-opacity': 0.7,
            }}
          />
        </Source>

        {/* Carrier Strike Group markers */}
        {activeLayers.carriers && carriers?.map(c => (
          <Marker
            key={c.hull}
            longitude={c.lng}
            latitude={c.lat}
            anchor="center"
            rotation={c.heading}
          >
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setPopup({
                  lat: c.lat,
                  lng: c.lng,
                  content: `${c.name} (${c.hull})\n${c.desc}\nSource: ${c.source}`,
                });
              }}
            >
              <div className="relative">
                <div className="w-4 h-4 bg-blue-500/80 border border-blue-300/60 rounded-sm rotate-45 shadow-lg shadow-blue-500/30" />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-mono text-blue-300/80 font-bold">
                  {c.hull}
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {/* Flight markers via HTML markers for rotation */}
        {flightMarkers.slice(0, 3000).map(m => {
          const isMil = m.color === 'yellow';
          const size = isMil ? 16 : 12;
          return (
            <Marker
              key={m.key}
              longitude={m.lng}
              latitude={m.lat}
              anchor="center"
              rotation={m.heading}
            >
              <img
                src={svgPlane(m.color, size)}
                alt=""
                style={{ width: size, height: size, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  const typeLabel = m.color === '#ec4899' ? 'TRACKED' : isMil ? 'MILITARY' : m.color === '#FF8C00' ? 'PRIVATE' : 'COMMERCIAL';
                  setPopup({
                    lat: m.lat,
                    lng: m.lng,
                    content: `${typeLabel} · ${m.label || 'Unknown'}${m.model ? ` (${m.model})` : ''} · ${Math.round(m.alt).toLocaleString()} ft · ${Math.round(m.speed)} kts`,
                  });
                }}
                title={`${m.label} · ${Math.round(m.alt).toLocaleString()} ft`}
              />
            </Marker>
          );
        })}

        {/* Popup */}
        {popup && (
          <Popup
            longitude={popup.lng}
            latitude={popup.lat}
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
            className="global-map-popup"
            offset={12}
          >
            <div className="text-[11px] text-white max-w-[250px] font-mono leading-relaxed whitespace-pre-line">
              {popup.content}
            </div>
          </Popup>
        )}
      </Map>

      {/* Coordinate display */}
      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-white/30 pointer-events-none z-10">
        {viewState.latitude.toFixed(4)}°, {viewState.longitude.toFixed(4)}° · Z{viewState.zoom.toFixed(1)}
      </div>

      {/* Right-click hint */}
      <div className="absolute bottom-2 right-2 text-[8px] font-mono text-white/15 pointer-events-none z-10">
        RIGHT-CLICK FOR DOSSIER
      </div>
    </div>
  );
}
