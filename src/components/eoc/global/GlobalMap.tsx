'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Map, { Source, Layer, MapRef, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computeNightPolygon } from '@/lib/solarTerminator';
import type { ActiveLayers } from './GlobalLayerPanel';

import { getMapStyle, type MapStyleId } from './GlobalMapStyleSwitcher';

// Plane SVG path for icon registration
const PLANE_SVG_PATH = 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';

function makePlaneSvg(color: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="black" stroke-width="0.5"><path d="${PLANE_SVG_PATH}"/></svg>`;
}

function loadSvgAsImage(svg: string, w: number, h: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(w, h);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

// Carrier diamond SVG
const CARRIER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <rect x="6" y="6" width="12" height="12" rx="2" fill="rgba(59,130,246,0.8)" stroke="rgba(147,197,253,0.6)" stroke-width="1" transform="rotate(45 12 12)"/>
</svg>`;

// Map icon names
const PLANE_ICONS = {
  cyan: 'plane-cyan',
  yellow: 'plane-yellow',
  orange: 'plane-orange',
  pink: 'plane-pink',
} as const;

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

interface ShipData {
  mmsi: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  heading: number;
  sog: number;
  country: string;
}

interface LiveUAMapEvent {
  id: string;
  title: string;
  lat: number;
  lng: number;
  region: string;
  timestamp?: string;
}

interface OutageData {
  country: string;
  score: number;
  lat: number;
  lng: number;
}

interface DataCenterData {
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

interface MeasurePoint {
  lat: number;
  lng: number;
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
  ships?: ShipData[];
  liveuamapEvents?: LiveUAMapEvent[];
  outages?: OutageData[];
  dataCenters?: DataCenterData[];
  gibsDate?: string; // YYYY-MM-DD for GIBS imagery
  gibsOpacity?: number;
  measurePoints?: MeasurePoint[];
  measureActive?: boolean;
  maxFlightMarkers?: number;
  mapStyle?: MapStyleId;
  flyToLocation?: { lat: number; lng: number } | null;
  onMouseCoords?: (lat: number, lng: number) => void;
  onContextMenu?: (lat: number, lng: number) => void;
  onMeasureClick?: (lat: number, lng: number) => void;
  onViewChange?: (zoom: number, lat: number, lng: number) => void;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Generate great circle arc points between two coordinates
function greatCircleArc(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }, segments = 50): [number, number][] {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const lat1 = toRad(p1.lat), lng1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat), lng2 = toRad(p2.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2));
  if (d < 0.0001) return [[p1.lng, p1.lat], [p2.lng, p2.lat]];
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return points;
}

// Interactive layers for click querying
const QUERY_LAYERS = [
  'earthquakes-circle', 'news-circle', 'satellites-circle',
  'cctv-clusters', 'cctv-unclustered', 'kiwisdr-clusters', 'kiwisdr-unclustered',
  'gdelt-circle', 'liveuamap-circle', 'ships-circle',
  'outages-circle', 'datacenters-clusters', 'datacenters-unclustered',
  'flights-symbol', 'carriers-symbol',
];

export const GlobalMap = React.memo(function GlobalMap({
  activeLayers, flights, earthquakes, fires, news,
  satellites, carriers, cctv, kiwisdr, frontlines, gdeltIncidents,
  ships, liveuamapEvents, outages, dataCenters, gibsDate, gibsOpacity = 0.6,
  measurePoints, measureActive, maxFlightMarkers = 5000,
  mapStyle = 'dark', flyToLocation, onMouseCoords, onContextMenu, onMeasureClick, onViewChange,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [iconsLoaded, setIconsLoaded] = useState(false);
  const [popup, setPopup] = useState<{ lat: number; lng: number; content: string } | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 20,
    latitude: 25,
    zoom: 2.2,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 } as { top: number; bottom: number; left: number; right: number },
  });

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

  // Register plane + carrier icons on map load
  const registerIcons = useCallback(async () => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    try {
      const iconSize = 32;
      const [planeCyan, planeYellow, planeOrange, planePink, carrierImg] = await Promise.all([
        loadSvgAsImage(makePlaneSvg('cyan', iconSize), iconSize, iconSize),
        loadSvgAsImage(makePlaneSvg('yellow', iconSize), iconSize, iconSize),
        loadSvgAsImage(makePlaneSvg('#FF8C00', iconSize), iconSize, iconSize),
        loadSvgAsImage(makePlaneSvg('#ec4899', iconSize), iconSize, iconSize),
        loadSvgAsImage(CARRIER_SVG, 24, 24),
      ]);

      if (!map.hasImage(PLANE_ICONS.cyan)) map.addImage(PLANE_ICONS.cyan, planeCyan);
      if (!map.hasImage(PLANE_ICONS.yellow)) map.addImage(PLANE_ICONS.yellow, planeYellow);
      if (!map.hasImage(PLANE_ICONS.orange)) map.addImage(PLANE_ICONS.orange, planeOrange);
      if (!map.hasImage(PLANE_ICONS.pink)) map.addImage(PLANE_ICONS.pink, planePink);
      if (!map.hasImage('carrier-icon')) map.addImage('carrier-icon', carrierImg);

      setIconsLoaded(true);
    } catch (err) {
      console.warn('Failed to load map icons:', err);
      setIconsLoaded(true); // Continue anyway
    }
  }, []);

  // ─── GeoJSON Source Data ───────────────────────────────────────────

  // Flights GeoJSON (replaces HTML Marker approach - GPU-rendered symbol layer)
  const flightsGeoJSON = useMemo(() => {
    if (!flights || !iconsLoaded) return EMPTY_FC;
    const features: GeoJSON.Feature[] = [];

    if (activeLayers.tracked && flights.tracked) {
      for (const f of flights.tracked) {
        features.push({
          type: 'Feature',
          properties: { iconId: PLANE_ICONS.pink, heading: f.heading, callsign: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model, category: 'TRACKED' },
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        });
      }
    }

    if (activeLayers.military && flights.military) {
      for (const f of flights.military) {
        features.push({
          type: 'Feature',
          properties: { iconId: PLANE_ICONS.yellow, heading: f.heading, callsign: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model, category: 'MILITARY' },
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        });
      }
    }

    if (activeLayers.flights && flights.commercial) {
      const src = flights.commercial;
      const step = src.length > maxFlightMarkers ? Math.ceil(src.length / maxFlightMarkers) : 1;
      for (let i = 0; i < src.length; i += step) {
        const f = src[i];
        features.push({
          type: 'Feature',
          properties: { iconId: PLANE_ICONS.cyan, heading: f.heading, callsign: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model, category: 'COMMERCIAL' },
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        });
      }
    }

    if (activeLayers.private && flights.private) {
      const src = flights.private;
      const step = src.length > 2000 ? Math.ceil(src.length / 2000) : 1;
      for (let i = 0; i < src.length; i += step) {
        const f = src[i];
        features.push({
          type: 'Feature',
          properties: { iconId: PLANE_ICONS.orange, heading: f.heading, callsign: f.callsign || f.icao24, alt: f.alt, speed: f.speed, model: f.model, category: 'PRIVATE' },
          geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        });
      }
    }

    return { type: 'FeatureCollection' as const, features };
  }, [flights, activeLayers.tracked, activeLayers.military, activeLayers.flights, activeLayers.private, iconsLoaded, maxFlightMarkers]);

  // Carriers GeoJSON (replaces HTML Marker approach)
  const carriersGeoJSON = useMemo(() => {
    if (!activeLayers.carriers || !carriers?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: carriers.map((c, i) => ({
        type: 'Feature' as const,
        properties: { id: i, hull: c.hull, name: c.name, desc: c.desc, source: c.source, wiki: c.wiki, heading: c.heading },
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      })),
    };
  }, [activeLayers.carriers, carriers]);

  // Earthquakes GeoJSON
  const earthquakeGeoJSON = useMemo(() => {
    if (!activeLayers.earthquakes || !earthquakes?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: earthquakes.map((eq, i) => ({
        type: 'Feature' as const,
        properties: { id: i, mag: eq.mag, place: eq.place, title: eq.title || `M${eq.mag} - ${eq.place}` },
        geometry: { type: 'Point' as const, coordinates: [eq.lng, eq.lat] },
      })),
    };
  }, [activeLayers.earthquakes, earthquakes]);

  // Fires GeoJSON - clustered
  const firesGeoJSON = useMemo(() => {
    if (!activeLayers.fires || !fires?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: fires.map((f, i) => ({
        type: 'Feature' as const,
        properties: { id: i, frp: f.frp, confidence: f.confidence },
        geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      })),
    };
  }, [activeLayers.fires, fires]);

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
    return {
      type: 'FeatureCollection' as const,
      features: satellites.map((s, i) => ({
        type: 'Feature' as const,
        properties: { id: i, name: s.name, alt: s.alt, type: s.type },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      })),
    };
  }, [activeLayers.satellites, satellites]);

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

  // Ships GeoJSON
  const shipsGeoJSON = useMemo(() => {
    if (!activeLayers.ships || !ships?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: ships.map((s, i) => ({
        type: 'Feature' as const,
        properties: { id: i, name: s.name, type: s.type, sog: s.sog, heading: s.heading, country: s.country, mmsi: s.mmsi },
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      })),
    };
  }, [activeLayers.ships, ships]);

  // LiveUAMap events GeoJSON
  const liveuamapGeoJSON = useMemo(() => {
    if (!activeLayers.liveuamap || !liveuamapEvents?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: liveuamapEvents.map((e, i) => ({
        type: 'Feature' as const,
        properties: { id: i, title: e.title, region: e.region },
        geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
      })),
    };
  }, [activeLayers.liveuamap, liveuamapEvents]);

  // Internet outages GeoJSON
  const outagesGeoJSON = useMemo(() => {
    if (!activeLayers.internet_outages || !outages?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: outages.map((o, i) => ({
        type: 'Feature' as const,
        properties: { id: i, country: o.country, score: o.score },
        geometry: { type: 'Point' as const, coordinates: [o.lng, o.lat] },
      })),
    };
  }, [activeLayers.internet_outages, outages]);

  // Data centers GeoJSON
  const dataCentersGeoJSON = useMemo(() => {
    if (!activeLayers.data_centers || !dataCenters?.length) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: dataCenters.map((d, i) => ({
        type: 'Feature' as const,
        properties: { id: i, name: d.name, city: d.city, country: d.country },
        geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
      })),
    };
  }, [activeLayers.data_centers, dataCenters]);

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

  // Measure line GeoJSON
  const measureGeoJSON = useMemo(() => {
    if (!measurePoints || measurePoints.length < 2) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: measurePoints.map(p => [p.lng, p.lat]),
        },
      }],
    };
  }, [measurePoints]);

  // Measure points GeoJSON
  const measurePointsGeoJSON = useMemo(() => {
    if (!measurePoints || measurePoints.length === 0) return EMPTY_FC;
    return {
      type: 'FeatureCollection' as const,
      features: measurePoints.map((p, i) => ({
        type: 'Feature' as const,
        properties: { id: i, label: `P${i + 1}` },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    };
  }, [measurePoints]);

  // ─── Event Handlers ────────────────────────────────────────────────

  const handleClick = useCallback((e: any) => {
    // Measure mode takes priority
    if (measureActive && onMeasureClick) {
      onMeasureClick(e.lngLat.lat, e.lngLat.lng);
      return;
    }

    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(e.point, { layers: QUERY_LAYERS });
    if (features.length > 0) {
      const f = features[0];
      const coords = (f.geometry as any).coordinates;
      const p = f.properties || {};

      let content = p.title || p.name || p.place || 'Unknown';

      // Flight click
      if (f.layer?.id === 'flights-symbol') {
        content = `${p.category} · ${p.callsign || 'Unknown'}${p.model ? ` (${p.model})` : ''} · ${Math.round(p.alt).toLocaleString()} ft · ${Math.round(p.speed)} kts`;
      }
      // Carrier click
      else if (f.layer?.id === 'carriers-symbol') {
        content = `${p.name} (${p.hull})\n${p.desc}\nSource: ${p.source}`;
      }
      // Cluster click
      else if (p.point_count) {
        content = `Cluster: ${p.point_count} items`;
      }
      // Satellite
      else if (p.alt !== undefined && p.type) {
        content = `${p.name} · ${p.type} · ${p.alt} km`;
      }
      // CCTV
      else if (p.source && p.mediaUrl) {
        content = `${p.name} · ${p.source}`;
      }
      // Ship
      else if (p.mmsi) {
        content = `${p.name} · ${p.type} · ${p.sog} kts · ${p.country}`;
      }
      // LiveUA
      else if (p.region) {
        content = `${p.title} · ${p.region}`;
      }
      // Outage
      else if (p.score !== undefined && p.country) {
        content = `Internet Outage · ${p.country} · Score: ${p.score}`;
      }
      // Data center
      else if (p.city && p.country && !p.mmsi) {
        content = `${p.name} · ${p.city}, ${p.country}`;
      }

      setPopup({ lng: coords[0], lat: coords[1], content });
    } else {
      setPopup(null);
    }
  }, [measureActive, onMeasureClick]);

  const handleContextMenu = useCallback((e: any) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e.lngLat.lat, e.lngLat.lng);
    }
  }, [onContextMenu]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className={`w-full h-full relative ${measureActive ? 'cursor-crosshair' : ''}`}>
      <Map
        ref={mapRef}
        reuseMaps
        fadeDuration={0}
        maxTileCacheSize={200}
        {...viewState}
        onMove={evt => {
          setViewState({
            ...evt.viewState,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
          });
        }}
        onMoveEnd={() => {
          if (onViewChange) {
            onViewChange(viewState.zoom, viewState.latitude, viewState.longitude);
          }
        }}
        onLoad={() => {
          setMapReady(true);
          registerIcons();
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        interactiveLayerIds={QUERY_LAYERS}
        mapStyle={getMapStyle(mapStyle) as any}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        maxZoom={18}
        minZoom={1.5}
      >
        {/* Day/Night overlay - always mounted, visibility controlled */}
        <Source id="night-overlay" type="geojson" data={nightGeoJSON}>
          <Layer
            id="night-fill"
            type="fill"
            layout={{ visibility: activeLayers.day_night ? 'visible' : 'none' }}
            paint={{
              'fill-color': '#000020',
              'fill-opacity': 0.35,
            }}
          />
        </Source>

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

        {/* Ships / Maritime vessels */}
        <Source id="ships-src" type="geojson" data={shipsGeoJSON} cluster clusterMaxZoom={8} clusterRadius={30}>
          <Layer
            id="ships-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-radius': ['step', ['get', 'point_count'], 8, 10, 12, 50, 16],
              'circle-color': '#2dd4bf',
              'circle-opacity': 0.6,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(45,212,191,0.3)',
            }}
          />
          <Layer
            id="ships-cluster-count"
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
            id="ships-circle"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': ['match', ['get', 'type'],
                'tanker', 5,
                'cargo', 5,
                'military_vessel', 6,
                'passenger', 5,
                4,
              ],
              'circle-color': ['match', ['get', 'type'],
                'tanker', '#ef4444',
                'cargo', '#ef4444',
                'military_vessel', '#eab308',
                'passenger', '#9ca3af',
                'yacht', '#3b82f6',
                '#2dd4bf',
              ],
              'circle-opacity': 0.7,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(255,255,255,0.15)',
            }}
          />
          <Layer
            id="ships-label"
            type="symbol"
            filter={['all', ['!', ['has', 'point_count']], ['any',
              ['==', ['get', 'type'], 'military_vessel'],
              ['==', ['get', 'type'], 'passenger'],
            ]]}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 8,
              'text-offset': [0, 1.3],
              'text-font': ['Open Sans Regular'],
              'text-max-width': 8,
            }}
            paint={{
              'text-color': '#2dd4bf',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
              'text-opacity': 0.6,
            }}
          />
        </Source>

        {/* LiveUAMap events */}
        <Source id="liveuamap-src" type="geojson" data={liveuamapGeoJSON}>
          <Layer
            id="liveuamap-circle"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': '#fb923c',
              'circle-opacity': 0.6,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#f97316',
              'circle-stroke-opacity': 0.4,
            }}
          />
          <Layer
            id="liveuamap-pulse"
            type="circle"
            paint={{
              'circle-radius': 14,
              'circle-color': 'transparent',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#f97316',
              'circle-stroke-opacity': 0.15,
            }}
          />
        </Source>

        {/* Measure line */}
        <Source id="measure-line-src" type="geojson" data={measureGeoJSON}>
          <Layer
            id="measure-line"
            type="line"
            paint={{
              'line-color': '#22d3ee',
              'line-width': 2,
              'line-dasharray': [4, 3],
              'line-opacity': 0.8,
            }}
          />
        </Source>
        <Source id="measure-points-src" type="geojson" data={measurePointsGeoJSON}>
          <Layer
            id="measure-points"
            type="circle"
            paint={{
              'circle-radius': 5,
              'circle-color': '#22d3ee',
              'circle-opacity': 0.9,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-opacity': 0.6,
            }}
          />
        </Source>

        {/* NASA GIBS MODIS Terra imagery overlay */}
        {activeLayers.gibs_imagery && gibsDate && (
          <Source
            key={`gibs-${gibsDate}`}
            id="gibs-src"
            type="raster"
            tiles={[`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`]}
            tileSize={256}
            maxzoom={9}
          >
            <Layer
              id="gibs-layer"
              type="raster"
              paint={{ 'raster-opacity': gibsOpacity }}
              {...(activeLayers.day_night ? { beforeId: 'night-fill' } : {})}
            />
          </Source>
        )}

        {/* Esri World Imagery overlay */}
        {activeLayers.esri_satellite && (
          <Source
            id="esri-sat-src"
            type="raster"
            tiles={['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']}
            tileSize={256}
            maxzoom={18}
          >
            <Layer
              id="esri-sat-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.85 }}
              {...(activeLayers.day_night ? { beforeId: 'night-fill' } : {})}
            />
          </Source>
        )}

        {/* Internet Outages */}
        <Source id="outages-src" type="geojson" data={outagesGeoJSON}>
          <Layer
            id="outages-circle"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 6, 50, 12, 100, 20],
              'circle-color': '#f43f5e',
              'circle-opacity': ['interpolate', ['linear'], ['get', 'score'], 0, 0.3, 50, 0.5, 100, 0.8],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#f43f5e',
              'circle-stroke-opacity': 0.4,
            }}
          />
          <Layer
            id="outages-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'country'],
              'text-size': 9,
              'text-offset': [0, -1.5],
              'text-font': ['Open Sans Regular'],
            }}
            paint={{
              'text-color': '#f43f5e',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
              'text-opacity': 0.7,
            }}
          />
        </Source>

        {/* Data Centers - clustered */}
        <Source id="datacenters-src" type="geojson" data={dataCentersGeoJSON} cluster clusterMaxZoom={10} clusterRadius={40}>
          <Layer
            id="datacenters-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-radius': ['step', ['get', 'point_count'], 8, 10, 12, 50, 16, 200, 22],
              'circle-color': '#818cf8',
              'circle-opacity': 0.5,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(129,140,248,0.3)',
            }}
          />
          <Layer
            id="datacenters-cluster-count"
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
            id="datacenters-unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': 4,
              'circle-color': '#818cf8',
              'circle-opacity': 0.5,
            }}
          />
        </Source>

        {/* Carrier Strike Groups - native symbol layer */}
        <Source id="carriers-src" type="geojson" data={carriersGeoJSON}>
          <Layer
            id="carriers-symbol"
            type="symbol"
            layout={{
              'icon-image': 'carrier-icon',
              'icon-size': 0.9,
              'icon-rotate': ['get', 'heading'],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'text-field': ['get', 'hull'],
              'text-size': 9,
              'text-offset': [0, 1.8],
              'text-font': ['Open Sans Regular'],
              'text-allow-overlap': true,
            }}
            paint={{
              'text-color': '#93c5fd',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            }}
          />
        </Source>

        {/* Flight markers - native symbol layer (GPU-rendered, no DOM elements) */}
        <Source id="flights-src" type="geojson" data={flightsGeoJSON}>
          <Layer
            id="flights-symbol"
            type="symbol"
            layout={{
              'icon-image': ['get', 'iconId'],
              'icon-size': ['match', ['get', 'category'],
                'TRACKED', 0.55,
                'MILITARY', 0.55,
                'PRIVATE', 0.4,
                0.38,
              ],
              'icon-rotate': ['get', 'heading'],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
        </Source>

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
});

export default GlobalMap;
