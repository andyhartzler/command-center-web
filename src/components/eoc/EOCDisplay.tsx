'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ShieldAlert, Wifi, WifiOff, Monitor } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { EOCIncident, EOCWSMessage, ScannerFeed, ScannerTranscript } from '@/types/eoc';
import { DEFAULT_EOC_SERVER_URL } from '@/types/eoc';
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

function isKansasCity(incident: EOCIncident): boolean {
  const address = incident.address?.toLowerCase();
  if (!address) return false;
  if (!address.includes('kansas city')) return false;
  if (address.includes(', ks') || address.includes('kansas city, k')) return false;
  return true;
}

export function EOCDisplay() {
  const { eocServerURL, eocScope, setEocScope, setAppMode } = useAppState();
  const serverURL = eocServerURL || DEFAULT_EOC_SERVER_URL;

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

  // Load initial data from REST API
  useEffect(() => {
    if (!serverURL) return;

    // Load incidents
    fetch(`${serverURL}/api/incidents?active=true&limit=200`)
      .then(res => res.json())
      .then(data => {
        if (data.incidents) setIncidents(data.incidents);
      })
      .catch(() => {});

    // Load scanner feeds
    fetch(`${serverURL}/api/scanner/feeds`)
      .then(res => res.json())
      .then(data => {
        if (data.feeds) setScannerFeeds(data.feeds);
      })
      .catch(() => {});

    // Load recent transcripts
    fetch(`${serverURL}/api/scanner/transcripts?limit=30`)
      .then(res => res.json())
      .then(data => {
        if (data.transcripts) setTranscripts(data.transcripts);
      })
      .catch(() => {});
  }, [serverURL]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((data: unknown) => {
    const msg = data as EOCWSMessage;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'incident':
      case 'new_incident':
        if (msg.data && 'title' in msg.data) {
          const incident = msg.data as EOCIncident;
          setIncidents(prev => {
            const filtered = prev.filter(i => i.id !== incident.id);
            const next = [incident, ...filtered];
            return next.length > 500 ? next.slice(0, 500) : next;
          });
        }
        break;
      case 'update_incident':
        if (msg.data && 'title' in msg.data) {
          const incident = msg.data as EOCIncident;
          setIncidents(prev =>
            prev.map(i => (i.id === incident.id ? incident : i))
          );
        }
        break;
      case 'resolve_incident':
      case 'remove_incident':
        if (msg.id) {
          setIncidents(prev => prev.filter(i => i.id !== msg.id));
          setSelectedId(prev => (prev === msg.id ? null : prev));
        }
        break;
      case 'scanner_transcript':
        if (msg.data && 'transcript' in msg.data) {
          const transcript = msg.data as ScannerTranscript;
          setTranscripts(prev => {
            const next = [transcript, ...prev];
            return next.length > 200 ? next.slice(0, 200) : next;
          });
          // Update feed activity
          setScannerFeeds(prev =>
            prev.map(f =>
              f.feed_id === transcript.feed_id
                ? { ...f, is_active: true, transcript_count: f.transcript_count + 1, last_transcript_at: transcript.created_at }
                : f
            )
          );
        }
        break;
      case 'bulk_incidents':
        if (Array.isArray(msg.data)) {
          setIncidents(msg.data as unknown as EOCIncident[]);
        }
        break;
      case 'pong':
        break;
    }
  }, []);

  // Build WebSocket URL matching Swift: replace http->ws, https->wss, append /ws/incidents
  const wsUrl = serverURL
    ? serverURL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/incidents'
    : null;

  const { isConnected } = useWebSocket({
    url: wsUrl,
    onMessage: handleWSMessage,
  });

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

      // Try to fetch full detail from API
      if (serverURL) {
        fetch(`${serverURL}/api/incidents/${id}`)
          .then(res => res.json())
          .then(full => {
            setDetailIncident(full);
            setShowDetail(true);
          })
          .catch(() => {
            setDetailIncident(incident);
            setShowDetail(true);
          });
      } else {
        setDetailIncident(incident);
        setShowDetail(true);
      }
    }
  }, [incidents, serverURL]);

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
    <div className="w-screen h-screen flex flex-col bg-zinc-950 overflow-hidden relative">
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
              <span className="text-[10px] text-white/25">
                {serverURL ? 'Connecting...' : 'Disconnected'}
              </span>
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
              serverURL={serverURL}
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
              serverURL={serverURL}
            />
          )}
        </div>
      </div>

      {/* Bottom ticker - always shown */}
      <EOCTicker incidents={filteredIncidents} activeCount={activeIncidents.length} />
    </div>
  );
}
