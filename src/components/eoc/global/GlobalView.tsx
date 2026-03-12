'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Monitor, ShieldAlert, Wifi, WifiOff, Globe } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import type { EOCScope } from '@/types/dashboard';
import { GlobalLayerPanel, DEFAULT_LAYERS } from './GlobalLayerPanel';
import type { ActiveLayers } from './GlobalLayerPanel';
import { GlobalNewsFeed } from './GlobalNewsFeed';

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
  const [lastUpdated, setLastUpdated] = useState<string>('');

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

  // Slow data fetcher (fires + news)
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
    ]);
  }, [activeLayers.fires]);

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

        {/* Bottom status bar */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-1 pointer-events-none z-10">
          <div className="flex items-center gap-4 text-[9px] font-mono text-white/25">
            <span>SYS: OPERATIONAL</span>
            <span>·</span>
            <span>UTC: {new Date().toISOString().slice(11, 19)}</span>
            <span>·</span>
            <span>SOURCES: {Object.values(activeLayers).filter(Boolean).length} ACTIVE</span>
            <span>·</span>
            <span>EQ: {earthquakes.length} · FIRES: {fires.length} · NEWS: {news.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
