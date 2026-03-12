'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Monitor, ShieldAlert, Wifi, WifiOff, Globe } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import type { EOCScope } from '@/types/dashboard';
import { GlobalLayerPanel, DEFAULT_LAYERS } from './GlobalLayerPanel';
import type { ActiveLayers } from './GlobalLayerPanel';
import { GlobalNewsFeed } from './GlobalNewsFeed';
import { GlobalLocateBar } from './GlobalLocateBar';
import { GlobalMarketsTicker } from './GlobalMarketsTicker';

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
const SLOW_POLL = 180_000; // 3 min: fires, news

export function GlobalView() {
  const { eocScope, setEocScope, setAppMode } = useAppState();
  const [activeLayers, setActiveLayers] = useState<ActiveLayers>(DEFAULT_LAYERS);
  const [isConnected, setIsConnected] = useState(false);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Data stores
  const [flights, setFlights] = useState<any>(null);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [fires, setFires] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [utcTime, setUtcTime] = useState(new Date().toISOString().slice(11, 19));

  // ETag caching for conditional requests
  const etagsRef = useRef<Record<string, string>>({});

  // Counts for layer panel
  const counts: Record<string, number> = {
    flights: (flights?.commercial?.length || 0),
    military: (flights?.military?.length || 0),
    private: (flights?.private?.length || 0),
    earthquakes: earthquakes.length,
    fires: fires.length,
    news_markers: news.filter(n => n.coords).length,
  };

  // Fast data fetcher (flights + earthquakes)
  const fetchFast = useCallback(async () => {
    const results = await Promise.allSettled([
      // Flights
      (async () => {
        if (!activeLayers.flights && !activeLayers.military && !activeLayers.private) return;
        try {
          const res = await fetch('/api/global/flights');
          if (res.ok) {
            const data = await res.json();
            setFlights(data);
            setIsConnected(true);
          }
        } catch { setIsConnected(false); }
      })(),
      // Earthquakes
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
  }, [activeLayers.flights, activeLayers.military, activeLayers.private, activeLayers.earthquakes]);

  // Slow data fetcher (fires + news + space weather)
  const fetchSlow = useCallback(async () => {
    await Promise.allSettled([
      // Fires
      (async () => {
        if (!activeLayers.fires) return;
        try {
          const res = await fetch('/api/global/fires');
          if (res.ok) {
            const data = await res.json();
            setFires(data);
          }
        } catch {}
      })(),
      // News
      (async () => {
        try {
          const res = await fetch('/api/global/news');
          if (res.ok) {
            const data = await res.json();
            setNews(data);
          }
        } catch {}
      })(),
      // Space weather
      (async () => {
        try {
          const res = await fetch('/api/global/space-weather');
          if (res.ok) {
            const data = await res.json();
            setSpaceWeather(data);
          }
        } catch {}
      })(),
    ]);
  }, [activeLayers.fires]);

  // UTC clock
  useEffect(() => {
    const id = setInterval(() => setUtcTime(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFast();
    fetchSlow();
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

  const handleNewsFlyTo = useCallback((lat: number, lng: number) => {
    setFlyToLocation({ lat, lng });
    setTimeout(() => setFlyToLocation(null), 2000);
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
              {(flights?.total || 0).toLocaleString()} AIRCRAFT
            </span>
          </div>
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
          flyToLocation={flyToLocation}
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

        {/* Right HUD: News feed */}
        <div className="absolute top-4 right-4 w-[300px] z-10 flex flex-col gap-3 pointer-events-none max-h-[calc(100%-2rem)]">
          <GlobalNewsFeed news={news} onFlyTo={handleNewsFlyTo} />
        </div>

        {/* Top center: Locate bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <GlobalLocateBar onFlyTo={(lat, lng) => handleNewsFlyTo(lat, lng)} />
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

        {/* Bottom bar: status + markets ticker */}
        <div className="absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between px-4 pb-1.5 pointer-events-none z-10">
          <div className="flex items-center gap-4 text-[9px] font-mono text-white/25">
            <span className="text-cyan-500/50">REC</span>
            <span className="text-white/40">{utcTime} UTC</span>
            <span>·</span>
            <span>SOURCES: {Object.values(activeLayers).filter(Boolean).length} ACTIVE</span>
            <span>·</span>
            <span>EQ: {earthquakes.length} · FIRES: {fires.length} · NEWS: {news.length}</span>
            <span>·</span>
            <span>MIL: {flights?.military?.length || 0} · CIV: {(flights?.commercial?.length || 0) + (flights?.private?.length || 0)}</span>
          </div>
          <GlobalMarketsTicker />
        </div>
      </div>
    </div>
  );
}
