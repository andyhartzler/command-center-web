'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Monitor, ShieldAlert, Wifi, WifiOff, Globe, Satellite, Anchor, Camera, Star, Ship, Settings, Filter, Ruler } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import type { EOCScope } from '@/types/dashboard';
import { GlobalLayerPanel, DEFAULT_LAYERS } from './GlobalLayerPanel';
import type { ActiveLayers } from './GlobalLayerPanel';
import { GlobalNewsFeed } from './GlobalNewsFeed';
import { GlobalLocateBar } from './GlobalLocateBar';
import { GlobalMarketsTicker } from './GlobalMarketsTicker';
import { GlobalRadioPanel } from './GlobalRadioPanel';
import { GlobalDossierPanel } from './GlobalDossierPanel';
import { GlobalMapLegend } from './GlobalMapLegend';
import { GlobalMapStyleSwitcher, type MapStyleId } from './GlobalMapStyleSwitcher';
import { GlobalCRTOverlay } from './GlobalCRTOverlay';
import { GlobalSettingsPanel, DEFAULT_SETTINGS, type SettingsConfig } from './GlobalSettingsPanel';
import { GlobalOnboardingModal, useOnboarding } from './GlobalOnboardingModal';
import { GlobalMeasureTool, type MeasurePoint } from './GlobalMeasureTool';
import { GlobalAdvancedFilter } from './GlobalAdvancedFilter';

// Dynamic import to avoid SSR issues with MapLibre
const GlobalMap = dynamic(() => import('./GlobalMap').then(m => ({ default: m.GlobalMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0e1a]">
      <div className="text-white/30 font-mono text-sm animate-pulse">INITIALIZING GLOBAL SENSORS...</div>
    </div>
  ),
});

const SCOPE_LABELS: Record<EOCScope, string> = {
  kc: 'KC',
  usa: 'USA',
  global: 'Global',
};

// Polling intervals
const FAST_POLL = 60_000;  // 1 min: flights, earthquakes
const SLOW_POLL = 180_000; // 3 min: fires, news, satellites, carriers
const GLACIAL_POLL = 600_000; // 10 min: cctv, kiwisdr

export function GlobalView() {
  const { eocScope, setEocScope, setAppMode } = useAppState();
  const [activeLayers, setActiveLayers] = useState<ActiveLayers>(DEFAULT_LAYERS);
  const [isConnected, setIsConnected] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Region dossier
  const [dossierCoords, setDossierCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapStyleId, setMapStyleId] = useState<MapStyleId>('dark');

  // Settings & modals
  const [settingsConfig, setSettingsConfig] = useState<SettingsConfig>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const { showOnboarding, setShowOnboarding } = useOnboarding();

  // Measure mode
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);

  // Data stores
  const [flights, setFlights] = useState<any>(null);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [fires, setFires] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  const [satellites, setSatellites] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [cctv, setCctv] = useState<any[]>([]);
  const [kiwisdr, setKiwisdr] = useState<any[]>([]);
  const [frontlines, setFrontlines] = useState<any>(null);
  const [gdeltIncidents, setGdeltIncidents] = useState<any[]>([]);
  const [ships, setShips] = useState<any[]>([]);
  const [liveuamapEvents, setLiveuamapEvents] = useState<any[]>([]);

  // Previous flight positions for smooth interpolation
  const prevFlightsRef = useRef<Map<string, { lat: number; lng: number; ts: number }>>(new Map());

  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [utcTime, setUtcTime] = useState(new Date().toISOString().slice(11, 19));

  // Counts for layer panel
  const counts: Record<string, number> = {
    flights: (flights?.commercial?.length || 0),
    military: (flights?.military?.length || 0),
    private: (flights?.private?.length || 0),
    tracked: (flights?.tracked?.length || 0),
    gps_jamming: (flights?.jammingZones?.length || 0),
    earthquakes: earthquakes.length,
    fires: fires.length,
    news_markers: news.filter(n => n.coords).length,
    satellites: satellites.length,
    carriers: carriers.length,
    cctv: cctv.length,
    kiwisdr: kiwisdr.length,
    frontlines: frontlines ? 1 : 0,
    gdelt_incidents: gdeltIncidents.filter(g => g.lat != null).length,
    ships: ships.length,
    liveuamap: liveuamapEvents.length,
  };

  // Fast data fetcher (flights + earthquakes)
  const fetchFast = useCallback(async () => {
    await Promise.allSettled([
      (async () => {
        if (!activeLayers.flights && !activeLayers.military && !activeLayers.private && !activeLayers.tracked && !activeLayers.gps_jamming) return;
        try {
          const res = await fetch('/api/global/flights');
          if (res.ok) {
            const data = await res.json();
            setFlights(data);
            setIsConnected(true);
          }
        } catch { setIsConnected(false); }
      })(),
      (async () => {
        if (!activeLayers.earthquakes) return;
        try {
          const res = await fetch('/api/global/earthquakes');
          if (res.ok) {
            const data = await res.json();
            setEarthquakes(data);
            setIsConnected(true);
          }
        } catch {}
      })(),
    ]);
    setLastUpdated(new Date().toISOString());
  }, [activeLayers.flights, activeLayers.military, activeLayers.private, activeLayers.tracked, activeLayers.gps_jamming, activeLayers.earthquakes]);

  // Slow data fetcher (fires + news + space weather + satellites + carriers + geopolitics)
  const fetchSlow = useCallback(async () => {
    await Promise.allSettled([
      (async () => {
        if (!activeLayers.fires) return;
        try {
          const res = await fetch('/api/global/fires');
          if (res.ok) setFires(await res.json());
        } catch {}
      })(),
      (async () => {
        try {
          const res = await fetch('/api/global/news');
          if (res.ok) setNews(await res.json());
        } catch {}
      })(),
      (async () => {
        try {
          const res = await fetch('/api/global/space-weather');
          if (res.ok) setSpaceWeather(await res.json());
        } catch {}
      })(),
      (async () => {
        if (!activeLayers.satellites) return;
        try {
          const res = await fetch('/api/global/satellites');
          if (res.ok) {
            const data = await res.json();
            setSatellites(data.satellites || []);
          }
        } catch {}
      })(),
      (async () => {
        if (!activeLayers.carriers) return;
        try {
          const res = await fetch('/api/global/carriers');
          if (res.ok) setCarriers(await res.json());
        } catch {}
      })(),
      (async () => {
        if (!activeLayers.frontlines && !activeLayers.gdelt_incidents) return;
        try {
          const res = await fetch('/api/global/geopolitics');
          if (res.ok) {
            const data = await res.json();
            if (data.frontlines) setFrontlines(data.frontlines);
            if (data.incidents) setGdeltIncidents(data.incidents);
          }
        } catch {}
      })(),
      (async () => {
        if (!activeLayers.ships) return;
        try {
          const res = await fetch('/api/global/ships');
          if (res.ok) {
            const data = await res.json();
            setShips(data.vessels || []);
          }
        } catch {}
      })(),
      (async () => {
        if (!activeLayers.liveuamap) return;
        try {
          const res = await fetch('/api/global/liveuamap');
          if (res.ok) {
            const data = await res.json();
            setLiveuamapEvents(data.events || []);
          }
        } catch {}
      })(),
    ]);
  }, [activeLayers.fires, activeLayers.satellites, activeLayers.carriers, activeLayers.frontlines, activeLayers.gdelt_incidents, activeLayers.ships, activeLayers.liveuamap]);

  // Glacial fetcher (cctv + kiwisdr)
  const fetchGlacial = useCallback(async () => {
    await Promise.allSettled([
      (async () => {
        if (!activeLayers.cctv) return;
        try {
          const res = await fetch('/api/global/cctv');
          if (res.ok) {
            const data = await res.json();
            setCctv(data.cameras || []);
          }
        } catch {}
      })(),
      (async () => {
        if (!activeLayers.kiwisdr) return;
        try {
          const res = await fetch('/api/global/kiwisdr');
          if (res.ok) {
            const data = await res.json();
            setKiwisdr(data.nodes || []);
          }
        } catch {}
      })(),
    ]);
  }, [activeLayers.cctv, activeLayers.kiwisdr]);

  // UTC clock
  useEffect(() => {
    const id = setInterval(() => setUtcTime(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFast();
    fetchSlow();
    fetchGlacial();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fast poll
  useEffect(() => {
    const id = setInterval(fetchFast, FAST_POLL);
    return () => clearInterval(id);
  }, [fetchFast]);

  // Slow poll
  useEffect(() => {
    const id = setInterval(fetchSlow, SLOW_POLL);
    return () => clearInterval(id);
  }, [fetchSlow]);

  // Glacial poll
  useEffect(() => {
    const id = setInterval(fetchGlacial, GLACIAL_POLL);
    return () => clearInterval(id);
  }, [fetchGlacial]);

  const handleNewsFlyTo = useCallback((lat: number, lng: number) => {
    setFlyToLocation({ lat, lng });
    setTimeout(() => setFlyToLocation(null), 2000);
  }, []);

  const handleContextMenu = useCallback((lat: number, lng: number) => {
    setDossierCoords({ lat, lng });
  }, []);

  const handleMeasureClick = useCallback((lat: number, lng: number) => {
    setMeasurePoints(prev => [...prev, { lat, lng }]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'm': // Toggle military
          setActiveLayers(prev => ({ ...prev, military: !prev.military }));
          break;
        case 'c': // Toggle commercial
          setActiveLayers(prev => ({ ...prev, flights: !prev.flights }));
          break;
        case 'p': // Toggle private
          setActiveLayers(prev => ({ ...prev, private: !prev.private }));
          break;
        case 't': // Toggle tracked
          setActiveLayers(prev => ({ ...prev, tracked: !prev.tracked }));
          break;
        case 's': // Toggle satellites
          setActiveLayers(prev => ({ ...prev, satellites: !prev.satellites }));
          break;
        case 'e': // Toggle earthquakes
          setActiveLayers(prev => ({ ...prev, earthquakes: !prev.earthquakes }));
          break;
        case 'f': // Toggle fires
          setActiveLayers(prev => ({ ...prev, fires: !prev.fires }));
          break;
        case 'n': // Toggle night
          setActiveLayers(prev => ({ ...prev, day_night: !prev.day_night }));
          break;
        case 'k': // Cycle map styles
          setMapStyleId(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'satellite' : 'dark');
          break;
        case 'r': // Toggle CRT
          setSettingsConfig(prev => ({ ...prev, crtEnabled: !prev.crtEnabled }));
          break;
        case 'd': // Toggle measure mode
          setMeasureActive(prev => {
            if (!prev) setMeasurePoints([]);
            return !prev;
          });
          break;
        case 'g': // Open settings
          setSettingsOpen(prev => !prev);
          break;
        case 'escape':
          setDossierCoords(null);
          setMeasureActive(false);
          setFilterOpen(false);
          setSettingsOpen(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0a0e1a] overflow-hidden relative">
      {/* Top bar */}
      <div className="shrink-0 h-11 border-b border-white/10 flex items-center justify-between px-4 bg-black/40 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAppMode('dashboard')}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/35 hover:text-white/55 hover:bg-white/5 transition-colors"
          >
            <Monitor size={13} />
            Dashboard
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            <span className="text-sm font-bold text-white/90">EOC</span>
          </div>
        </div>

        {/* Center: scope selector */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
          {(Object.keys(SCOPE_LABELS) as EOCScope[]).map(scope => (
            <button
              key={scope}
              onClick={() => setEocScope(scope)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                eocScope === scope
                  ? scope === 'global'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-white/10 text-white/90'
                  : 'text-white/35 hover:text-white/55'
              }`}
            >
              {SCOPE_LABELS[scope]}
            </button>
          ))}
        </div>

        {/* Right: status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Globe size={11} className="text-cyan-500/60" />
            <span className="text-[9px] text-white/30 font-mono">
              {(flights?.total || 0).toLocaleString()} AC
            </span>
          </div>
          {satellites.length > 0 && (
            <div className="flex items-center gap-1">
              <Satellite size={10} className="text-purple-400/60" />
              <span className="text-[9px] text-white/30 font-mono">{satellites.length} SAT</span>
            </div>
          )}
          {(flights?.tracked?.length || 0) > 0 && (
            <div className="flex items-center gap-1">
              <Star size={10} className="text-pink-400/60" />
              <span className="text-[9px] text-white/30 font-mono">{flights.tracked.length} TRK</span>
            </div>
          )}
          {carriers.length > 0 && (
            <div className="flex items-center gap-1">
              <Anchor size={10} className="text-blue-400/60" />
              <span className="text-[9px] text-white/30 font-mono">{carriers.length} CSG</span>
            </div>
          )}
          {cctv.length > 0 && (
            <div className="flex items-center gap-1">
              <Camera size={10} className="text-green-400/60" />
              <span className="text-[9px] text-white/30 font-mono">{cctv.length} CAM</span>
            </div>
          )}
          {ships.length > 0 && (
            <div className="flex items-center gap-1">
              <Ship size={10} className="text-teal-400/60" />
              <span className="text-[9px] text-white/30 font-mono">{ships.length} VES</span>
            </div>
          )}
          {isConnected ? (
            <div className="flex items-center gap-1">
              <Wifi size={11} className="text-green-400" />
              <span className="text-[9px] text-green-400/80 font-mono">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <WifiOff size={11} className="text-white/25" />
              <span className="text-[9px] text-white/25 font-mono">SYNC</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content: full-screen map with HUD overlays */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map */}
        <GlobalMap
          activeLayers={activeLayers}
          flights={flights}
          earthquakes={earthquakes}
          fires={fires}
          news={news}
          satellites={satellites}
          carriers={carriers}
          cctv={cctv}
          kiwisdr={kiwisdr}
          frontlines={frontlines}
          gdeltIncidents={gdeltIncidents}
          ships={ships}
          liveuamapEvents={liveuamapEvents}
          measurePoints={measurePoints}
          measureActive={measureActive}
          mapStyle={mapStyleId}
          flyToLocation={flyToLocation}
          onContextMenu={handleContextMenu}
          onMeasureClick={handleMeasureClick}
        />

        {/* Left HUD: Layer panel */}
        <div className="absolute top-4 left-4 w-[260px] z-10 flex flex-col gap-3 pointer-events-none max-h-[calc(100%-2rem)]">
          <GlobalLayerPanel
            activeLayers={activeLayers}
            setActiveLayers={setActiveLayers}
            counts={counts}
            lastUpdated={lastUpdated}
          />
        </div>

        {/* Right HUD: News feed + Radio */}
        <div className="absolute top-4 right-4 w-[300px] z-10 flex flex-col pointer-events-none max-h-[calc(100%-2rem)] overflow-y-auto styled-scrollbar">
          <GlobalNewsFeed news={news} onFlyTo={handleNewsFlyTo} />
          <GlobalRadioPanel />
        </div>

        {/* Top center: Locate bar + toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <GlobalLocateBar onFlyTo={(lat, lng) => handleNewsFlyTo(lat, lng)} />
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setSettingsOpen(true)}
              className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors text-white/30 hover:text-white/50"
              title="Settings (G)"
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => setFilterOpen(true)}
              className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors text-white/30 hover:text-white/50"
              title="Advanced Filter"
            >
              <Filter size={12} />
            </button>
            <button
              onClick={() => {
                setMeasureActive(!measureActive);
                if (!measureActive) setMeasurePoints([]);
              }}
              className={`bg-black/60 backdrop-blur-sm border rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors ${
                measureActive ? 'border-cyan-500/50 text-cyan-400' : 'border-white/10 text-white/30 hover:text-white/50'
              }`}
              title="Measure Tool (D)"
            >
              <Ruler size={12} />
            </button>
            <button
              onClick={() => setSettingsConfig(prev => ({ ...prev, crtEnabled: !prev.crtEnabled }))}
              className={`bg-black/60 backdrop-blur-sm border rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors text-[9px] font-mono ${
                settingsConfig.crtEnabled ? 'border-green-500/50 text-green-400' : 'border-white/10 text-white/30 hover:text-white/50'
              }`}
              title="CRT Effect (R)"
            >
              CRT
            </button>
          </div>
        </div>

        {/* Space weather badge (top right corner) */}
        {spaceWeather?.scales && (
          <div className="absolute top-4 right-[320px] z-10 pointer-events-auto mr-4">
            <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-[9px] font-mono">
              <div className="text-white/40 tracking-widest mb-1">SPACE WEATHER</div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`font-bold ${spaceWeather.scales.radio_blackout.scale > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    R{spaceWeather.scales.radio_blackout.scale}
                  </span>
                  <span className="text-white/20">RADIO</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`font-bold ${spaceWeather.scales.solar_radiation.scale > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    S{spaceWeather.scales.solar_radiation.scale}
                  </span>
                  <span className="text-white/20">SOLAR</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`font-bold ${spaceWeather.scales.geomagnetic_storm.scale > 0 ? 'text-purple-400' : 'text-green-400'}`}>
                    G{spaceWeather.scales.geomagnetic_storm.scale}
                  </span>
                  <span className="text-white/20">GEO</span>
                </div>
                {spaceWeather.kp_index != null && (
                  <div className="flex flex-col items-center">
                    <span className={`font-bold ${spaceWeather.kp_index >= 5 ? 'text-red-400' : spaceWeather.kp_index >= 4 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {spaceWeather.kp_index.toFixed(1)}
                    </span>
                    <span className="text-white/20">Kp</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Region Dossier Panel */}
        {dossierCoords && (
          <GlobalDossierPanel
            lat={dossierCoords.lat}
            lng={dossierCoords.lng}
            onClose={() => setDossierCoords(null)}
          />
        )}

        {/* Bottom-left: Legend + Map Style */}
        <div className="absolute bottom-12 left-4 z-10 flex flex-col gap-2">
          <GlobalMapLegend />
          <GlobalMapStyleSwitcher current={mapStyleId} onChange={setMapStyleId} />
        </div>

        {/* Bottom bar: status + markets ticker */}
        <div className="absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between px-4 pb-1.5 pointer-events-none z-10">
          <div className="flex items-center gap-4 text-[9px] font-mono text-white/25">
            <span className="text-cyan-500/50">REC</span>
            <span className="text-white/40">{utcTime} UTC</span>
            <span>·</span>
            <span>LAYERS: {Object.values(activeLayers).filter(Boolean).length} ACTIVE</span>
            <span>·</span>
            <span>EQ: {earthquakes.length} · FIRE: {fires.length} · SAT: {satellites.length} · CCTV: {cctv.length} · VES: {ships.length}</span>
            <span>·</span>
            <span>MIL: {flights?.military?.length || 0} · CIV: {(flights?.commercial?.length || 0) + (flights?.private?.length || 0)} · CSG: {carriers.length} · UA: {liveuamapEvents.length}</span>
          </div>
          <GlobalMarketsTicker />
        </div>

        {/* Measure tool overlay */}
        <GlobalMeasureTool
          active={measureActive}
          points={measurePoints}
          onClear={() => setMeasurePoints([])}
          onDeactivate={() => setMeasureActive(false)}
        />
      </div>

      {/* CRT Scanline Overlay */}
      <GlobalCRTOverlay enabled={settingsConfig.crtEnabled} />

      {/* Settings Panel */}
      <GlobalSettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settingsConfig}
        onSettingsChange={setSettingsConfig}
      />

      {/* Onboarding Modal */}
      {showOnboarding && (
        <GlobalOnboardingModal
          onClose={() => setShowOnboarding(false)}
          onOpenSettings={() => { setShowOnboarding(false); setSettingsOpen(true); }}
        />
      )}

      {/* Advanced Filter Modal */}
      <GlobalAdvancedFilter
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        fields={[
          { key: 'aircraft_type', label: 'AIRCRAFT TYPE', options: ['Commercial', 'Military', 'Private Jet', 'Helicopter', 'Cargo', 'POTUS Fleet'] },
          { key: 'vessel_type', label: 'VESSEL TYPE', options: ['Cargo', 'Tanker', 'Passenger', 'Military', 'Yacht', 'Other'] },
          { key: 'event_type', label: 'EVENT TYPE', options: ['Earthquake', 'Fire', 'Military Incident', 'Conflict', 'News', 'LiveUA'] },
          { key: 'region', label: 'REGION', options: ['North America', 'Europe', 'Middle East', 'Asia Pacific', 'Africa', 'South America', 'Arctic', 'Antarctic'] },
        ]}
        activeFilters={activeFilters}
        onApply={setActiveFilters}
      />
    </div>
  );
}
