'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ShieldAlert, Wifi, WifiOff, Monitor } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import type { EOCIncident, ScannerFeed, ScannerTranscript } from '@/types/eoc';
import type { EOCScope } from '@/types/dashboard';
import { EOCIncidentFeed } from './EOCIncidentFeed';
import { EOCMap } from './EOCMap';
import { EOCStatsPanel } from './EOCStatsPanel';
import { EOCIncidentDetail } from './EOCIncidentDetail';
import { EOCTicker } from './EOCTicker';

const SCOPE_LABELS: Record<EOCScope, string> = {
  kc: 'KC',
  usa: 'USA',
  global: 'Global',
};

type TimeFilter = '1H' | '6H' | '24H' | '7D' | 'ALL';

const TIME_FILTER_INTERVALS: Record<TimeFilter, number | null> = {
  '1H': 3600 * 1000,
  '6H': 6 * 3600 * 1000,
  '24H': 24 * 3600 * 1000,
  '7D': 7 * 86400 * 1000,
  ALL: null,
};

/** Polling intervals (ms) */
const INCIDENTS_POLL_MS = 5_000;
const TRANSCRIPTS_POLL_MS = 10_000;

function isKansasCity(incident: EOCIncident): boolean {
  const address = incident.address?.toLowerCase();
  if (!address) return false;
  if (!address.includes('kansas city')) return false;
  if (address.includes(', ks') || address.includes('kansas city, k')) return false;
  return true;
}

export function EOCDisplay() {
  const { eocScope, setEocScope, setAppMode } = useAppState();

  const [incidents, setIncidents] = useState<EOCIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailIncident, setDetailIncident] = useState<EOCIncident | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24H');
  const [scannerFeeds, setScannerFeeds] = useState<ScannerFeed[]>([]);
  const [transcripts, setTranscripts] = useState<ScannerTranscript[]>([]);
  const [showTranscripts, setShowTranscripts] = useState(true);
  const [selectedFeedFilter, setSelectedFeedFilter] = useState<string | null>(null);
  const [toastIncident, setToastIncident] = useState<EOCIncident | null>(null);
  const [flashBorder, setFlashBorder] = useState(false);
  const [flyToCoord, setFlyToCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapZoomed, setIsMapZoomed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const prevFirstIdRef = useRef<string | null>(null);

  // Filter incidents to KC only and by time
  const kcIncidents = incidents.filter(isKansasCity);
  const filteredIncidents = (() => {
    const interval = TIME_FILTER_INTERVALS[timeFilter];
    if (!interval) return kcIncidents;
    const cutoff = Date.now() - interval;
    return kcIncidents.filter(i => new Date(i.detected_at).getTime() > cutoff);
  })();
  const activeIncidents = filteredIncidents.filter(i => !i.resolved_at);

  // --- Fetch helpers that go through the local Next.js API proxy ---
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/eoc/incidents?active=true&limit=200');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.incidents) setIncidents(data.incidents);
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, []);

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch('/api/eoc/scanner/feeds');
      if (!res.ok) return;
      const data = await res.json();
      if (data.feeds) setScannerFeeds(data.feeds);
    } catch { /* ignore */ }
  }, []);

  const fetchTranscripts = useCallback(async () => {
    try {
      const res = await fetch('/api/eoc/scanner/transcripts?limit=30');
      if (!res.ok) return;
      const data = await res.json();
      if (data.transcripts) setTranscripts(data.transcripts);
    } catch { /* ignore */ }
  }, []);

  // Initial load
  useEffect(() => {
    fetchIncidents();
    fetchFeeds();
    fetchTranscripts();
  }, [fetchIncidents, fetchFeeds, fetchTranscripts]);

  // Poll incidents every 5 seconds
  useEffect(() => {
    const id = setInterval(fetchIncidents, INCIDENTS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchIncidents]);

  // Poll transcripts every 10 seconds
  useEffect(() => {
    const id = setInterval(() => {
      fetchTranscripts();
      fetchFeeds();
    }, TRANSCRIPTS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchTranscripts, fetchFeeds]);

  // Handle new critical/major incidents (toast + flash)
  useEffect(() => {
    const firstKc = kcIncidents[0];
    if (!firstKc) return;
    if (prevFirstIdRef.current === firstKc.id) return;
    prevFirstIdRef.current = firstKc.id;

    if (firstKc.severity === 'critical') {
      setFlashBorder(true);
      setTimeout(() => setFlashBorder(false), 600);

      if (!selectedId) {
        setFlyToCoord({ lat: firstKc.latitude, lng: firstKc.longitude });
        setIsMapZoomed(true);
        setTimeout(() => setFlyToCoord(null), 1500);
      }

      setToastIncident(firstKc);
      setTimeout(() => setToastIncident(prev => (prev?.id === firstKc.id ? null : prev)), 8000);
    } else if (firstKc.severity === 'major') {
      if (!selectedId) {
        setFlyToCoord({ lat: firstKc.latitude, lng: firstKc.longitude });
        setIsMapZoomed(true);
        setTimeout(() => setFlyToCoord(null), 1500);
      }

      setToastIncident(firstKc);
      setTimeout(() => setToastIncident(prev => (prev?.id === firstKc.id ? null : prev)), 5000);
    }
  }, [kcIncidents, selectedId]);

  // Select incident -> show detail, fly to location
  const handleSelectIncident = useCallback((id: string) => {
    setSelectedId(id);
    const incident = incidents.find(i => i.id === id);
    if (incident) {
      setFlyToCoord({ lat: incident.latitude, lng: incident.longitude });
      setIsMapZoomed(true);
      setTimeout(() => setFlyToCoord(null), 1500);

      // Fetch full detail through proxy
      fetch(`/api/eoc/incidents/${encodeURIComponent(id)}`)
        .then(res => res.json())
        .then(full => {
          if (full && !full.error) {
            setDetailIncident(full);
          } else {
            setDetailIncident(incident);
          }
          setShowDetail(true);
        })
        .catch(() => {
          setDetailIncident(incident);
          setShowDetail(true);
        });
    }
  }, [incidents]);

  const handleDismissDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedId(null);
    setDetailIncident(null);
  }, []);

  const handleResetMapView = useCallback(() => {
    setSelectedId(null);
    setDetailIncident(null);
    setShowDetail(false);
    setIsMapZoomed(false);
    setFlyToCoord({ lat: -999, lng: -999 }); // Signal reset
    setTimeout(() => setFlyToCoord(null), 100);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDetail) {
          handleDismissDetail();
        } else if (isMapZoomed) {
          handleResetMapView();
        }
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = filteredIncidents.slice(0, 50);
        if (list.length === 0) return;

        const currentIdx = selectedId ? list.findIndex(i => i.id === selectedId) : -1;
        let newIdx: number;
        if (e.key === 'ArrowDown') {
          newIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, list.length - 1);
        } else {
          newIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
        }
        handleSelectIncident(list[newIdx].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDetail, isMapZoomed, selectedId, filteredIncidents, handleDismissDetail, handleResetMapView, handleSelectIncident]);

  const selectedIncident = selectedId
    ? incidents.find(i => i.id === selectedId) || null
    : null;

  return (
    <div className="w-screen h-screen flex flex-col bg-[#060a14] overflow-hidden relative">
      {/* Critical flash border */}
      {flashBorder && (
        <div className="absolute inset-0 border-[6px] border-red-500 z-50 pointer-events-none animate-pulse" />
      )}

      {/* Toast notification */}
      {toastIncident && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 transition-all duration-300">
          <button
            onClick={() => handleSelectIncident(toastIncident.id)}
            className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-w-[500px] hover:bg-black/90 transition-colors"
          >
            <span className="text-3xl">{toastIncident.emoji || '🔴'}</span>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-bold text-white truncate">{toastIncident.title}</div>
              {toastIncident.address && (
                <div className="text-[11px] text-white/60 truncate">{toastIncident.address}</div>
              )}
            </div>
            <span className={`text-[9px] font-black px-2 py-1 rounded-full ${
              toastIncident.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              {toastIncident.severity.toUpperCase()}
            </span>
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="shrink-0 h-12 border-b border-white/10 flex items-center justify-between px-4">
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
                  ? 'bg-white/10 text-white/90'
                  : 'text-white/35 hover:text-white/55'
              }`}
            >
              {SCOPE_LABELS[scope]}
            </button>
          ))}
        </div>

        {/* Right: connection indicator */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5">
              <Wifi size={12} className="text-green-400" />
              <span className="text-[10px] text-green-400/80">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <WifiOff size={12} className="text-white/25" />
              <span className="text-[10px] text-white/25">Connecting...</span>
            </div>
          )}
        </div>
      </div>

      {/* Main 3-panel content - always shown (no placeholder) */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Left: Incident feed (320px) */}
        <div className="shrink-0 w-[320px] overflow-hidden flex flex-col rounded-xl bg-[#0d1421] border border-cyan-500/10">
          <EOCIncidentFeed
            incidents={filteredIncidents}
            selectedId={selectedId}
            onSelect={handleSelectIncident}
            isConnected={isConnected}
            activeCount={activeIncidents.length}
          />
        </div>

        {/* Center: Map */}
        <div className="flex-1 overflow-hidden relative rounded-xl border border-cyan-500/10 shadow-[0_0_20px_rgba(0,255,255,0.03)]">
          <EOCMap
            incidents={filteredIncidents.slice(0, 200)}
            selectedId={selectedId}
            onSelect={handleSelectIncident}
            flyToCoord={flyToCoord}
          />

          {/* Reset view button */}
          {isMapZoomed && (
            <button
              onClick={handleResetMapView}
              className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1.5 bg-black/60 backdrop-blur-sm border border-cyan-500/20 rounded-lg text-white text-[9px] font-bold tracking-wider hover:bg-black/80 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              RESET VIEW
            </button>
          )}
        </div>

        {/* Right: Stats/Detail + Radio (320px) */}
        <div className="shrink-0 w-[320px] overflow-hidden flex flex-col rounded-xl bg-[#0d1421] border border-cyan-500/10">
          {showDetail && detailIncident ? (
            <EOCIncidentDetail
              incident={detailIncident}
              onDismiss={handleDismissDetail}
            />
          ) : (
            <EOCStatsPanel
              incidents={filteredIncidents}
              activeIncidents={activeIncidents}
              allIncidents={incidents}
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              scannerFeeds={scannerFeeds}
              transcripts={transcripts}
              showTranscripts={showTranscripts}
              onToggleTranscripts={() => setShowTranscripts(v => !v)}
              selectedFeedFilter={selectedFeedFilter}
              onFeedFilterChange={setSelectedFeedFilter}
            />
          )}
        </div>
      </div>

      {/* Bottom ticker - always shown */}
      <EOCTicker incidents={filteredIncidents} activeCount={activeIncidents.length} />
    </div>
  );
}
