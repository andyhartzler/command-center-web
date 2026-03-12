'use client';
import { useState, useRef, useEffect } from 'react';
import type { EOCIncident, ScannerFeed, ScannerTranscript } from '@/types/eoc';
import { SCANNER_STREAM_URLS } from '@/types/eoc';

type TimeFilter = '1H' | '6H' | '24H' | '7D' | 'ALL';

interface EOCStatsPanelProps {
  incidents: EOCIncident[];
  activeIncidents: EOCIncident[];
  allIncidents: EOCIncident[];
  timeFilter: TimeFilter;
  onTimeFilterChange: (f: TimeFilter) => void;
  scannerFeeds: ScannerFeed[];
  transcripts: ScannerTranscript[];
  showTranscripts: boolean;
  onToggleTranscripts: () => void;
  selectedFeedFilter: string | null;
  onFeedFilterChange: (id: string | null) => void;
}

const TIME_FILTERS: TimeFilter[] = ['1H', '6H', '24H', '7D', 'ALL'];

function shortFeedLabel(feedId: string): string {
  switch (feedId) {
    case 'kcpd': return 'KCPD';
    case 'kcfd': return 'KCFD';
    case 'kc_regional': return 'RGNL';
    default: return feedId.slice(0, 4).toUpperCase();
  }
}

function feedColor(feedId: string): string {
  switch (feedId) {
    case 'kcpd': return '#22d3ee';     // cyan
    case 'kcfd': return '#f97316';     // orange
    case 'kc_regional': return '#22c55e'; // green
    default: return '#ffffff';
  }
}

function feedColorClass(feedId: string): string {
  switch (feedId) {
    case 'kcpd': return 'text-cyan-400';
    case 'kcfd': return 'text-orange-400';
    case 'kc_regional': return 'text-green-400';
    default: return 'text-white';
  }
}

function feedBgClass(feedId: string): string {
  switch (feedId) {
    case 'kcpd': return 'bg-cyan-400/[0.12]';
    case 'kcfd': return 'bg-orange-400/[0.12]';
    case 'kc_regional': return 'bg-green-400/[0.12]';
    default: return 'bg-white/[0.12]';
  }
}

function transcriptTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function EOCStatsPanel({
  incidents,
  activeIncidents,
  allIncidents,
  timeFilter,
  onTimeFilterChange,
  scannerFeeds,
  transcripts,
  showTranscripts,
  onToggleTranscripts,
  selectedFeedFilter,
  onFeedFilterChange,
}: EOCStatsPanelProps) {
  const [playingFeeds, setPlayingFeeds] = useState<Record<string, boolean>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  function countCategory(cat: string): number {
    return activeIncidents.filter(i => i.category === cat).length;
  }

  function hasRecentFrom(source: string): boolean {
    const cutoff = Date.now() - 3600000;
    return allIncidents.some(i => i.source === source && new Date(i.detected_at).getTime() > cutoff);
  }

  function toggleAudio(feedId: string) {
    const streamUrl = SCANNER_STREAM_URLS[feedId];
    if (!streamUrl) return;

    if (playingFeeds[feedId]) {
      // Stop
      audioRefs.current[feedId]?.pause();
      delete audioRefs.current[feedId];
      setPlayingFeeds(prev => ({ ...prev, [feedId]: false }));
    } else {
      // Play
      const audio = new Audio(streamUrl);
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRefs.current[feedId] = audio;
      setPlayingFeeds(prev => ({ ...prev, [feedId]: true }));
    }
  }

  const filteredTranscripts = selectedFeedFilter
    ? transcripts.filter(t => t.feed_id === selectedFeedFilter)
    : transcripts;

  // Count helpers
  const fireCount = activeIncidents.filter(i => i.category === 'fire').length;
  const medicalCount = activeIncidents.filter(i => i.category === 'medical').length;
  const crimeCount = activeIncidents.filter(i => i.category === 'crime').length;
  const trafficCount = activeIncidents.filter(i => i.category === 'traffic').length;
  const shootingCount = activeIncidents.filter(i => i.category === 'shooting').length;
  const otherCount = activeIncidents.filter(i => !['fire', 'medical', 'crime', 'traffic', 'shooting'].includes(i.category)).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header: EOC + time filter pills */}
      <div className="shrink-0 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/50 tracking-[3px]">EOC</span>
        <div className="flex items-center gap-0.5">
          {TIME_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => onTimeFilterChange(f)}
              className={`px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors ${
                timeFilter === f
                  ? 'font-bold text-cyan-400 bg-cyan-500/[0.15]'
                  : 'text-white/35 hover:text-white/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Active stats */}
      <div className="px-4 py-3">
        <div className="text-[9px] font-bold text-white/40 tracking-[2px] mb-2">ACTIVE</div>
        <div className="space-y-1.5">
          <StatRow emoji="🔥" label="Fire" count={fireCount} />
          <StatRow emoji="🚑" label="Medical" count={medicalCount} />
          <StatRow emoji="🚔" label="Crime" count={crimeCount} />
          <StatRow emoji="🚗" label="Traffic" count={trafficCount} />
          <StatRow emoji="🚨" label="Shooting" count={shootingCount} />
          <StatRow emoji="❗" label="Other" count={otherCount} />
        </div>
      </div>

      <div className="h-px bg-white/10 mx-4" />

      {/* Sources */}
      <div className="px-4 py-3">
        <div className="text-[9px] font-bold text-white/40 tracking-[2px] mb-2">SOURCES</div>
        <div className="space-y-1.5">
          <SourceRow name="Scanner" isOnline={hasRecentFrom('scanner')} />
          <SourceRow name="Citizen" isOnline={hasRecentFrom('citizen')} />
          <SourceRow name="KCPD" isOnline={hasRecentFrom('kcpd')} />
        </div>
      </div>

      <div className="h-px bg-cyan-500/15" />

      {/* RADIO section */}
      <div className="px-3 py-2 flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4"/>
          <circle cx="12" cy="12" r="2"/>
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4"/>
          <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
        </svg>
        <span className="text-[9px] font-bold text-white/50 tracking-[2px]">RADIO</span>
        <div className="flex-1" />
        <button
          onClick={onToggleTranscripts}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          title="Toggle live transcriptions"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={showTranscripts ? '#22d3ee' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      {/* Feed rows with audio toggle */}
      <div className="px-3 space-y-1">
        {scannerFeeds.length > 0 ? (
          scannerFeeds.map(feed => (
            <div key={feed.feed_id} className="flex items-center gap-1.5">
              <div className={`w-[5px] h-[5px] rounded-full ${feed.is_active ? 'bg-green-500' : 'bg-red-500/50'}`} />
              <span className="text-[10px] font-medium text-white/60 truncate flex-1">
                {feed.feed_name}
              </span>
              <button
                onClick={() => toggleAudio(feed.feed_id)}
                className="p-1 rounded hover:bg-white/5 transition-colors"
                title={playingFeeds[feed.feed_id] ? `Mute ${feed.feed_name}` : `Listen to ${feed.feed_name}`}
              >
                {playingFeeds[feed.feed_id] ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                )}
              </button>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
            <span className="text-[10px] text-white/40">No feeds connected</span>
          </div>
        )}
      </div>

      {/* Transcripts section */}
      {showTranscripts && (
        <>
          <div className="h-px bg-white/5 mt-2" />

          {/* Feed filter pills */}
          <div className="px-3 py-1 flex items-center gap-0.5 flex-wrap">
            <button
              onClick={() => onFeedFilterChange(null)}
              className={`px-1.5 py-0.5 text-[8px] font-mono rounded transition-colors ${
                selectedFeedFilter === null
                  ? 'font-bold text-cyan-400 bg-cyan-500/[0.15]'
                  : 'text-white/35 hover:text-white/50'
              }`}
            >
              ALL
            </button>
            {scannerFeeds.map(feed => (
              <button
                key={feed.feed_id}
                onClick={() => onFeedFilterChange(feed.feed_id)}
                className={`px-1.5 py-0.5 text-[8px] font-mono rounded transition-colors ${
                  selectedFeedFilter === feed.feed_id
                    ? 'font-bold text-cyan-400 bg-cyan-500/[0.15]'
                    : 'text-white/35 hover:text-white/50'
                }`}
              >
                {shortFeedLabel(feed.feed_id)}
              </button>
            ))}
          </div>

          {/* Transcript list */}
          <div className="flex-1 overflow-y-auto px-3 py-1">
            <div className="space-y-0.5">
              {filteredTranscripts.length > 0 ? (
                filteredTranscripts.slice(0, 20).map(entry => (
                  <div key={entry.id} className="flex items-start gap-1.5">
                    <span
                      className={`text-[7px] font-bold font-mono px-1 py-0.5 rounded ${feedColorClass(entry.feed_id)} ${feedBgClass(entry.feed_id)}`}
                    >
                      {shortFeedLabel(entry.feed_id)}
                    </span>
                    <span className="text-[8px] font-mono text-white/25 shrink-0 mt-0.5">
                      {transcriptTime(entry.created_at)}
                    </span>
                    <span className="text-[10px] font-mono text-white/70 line-clamp-2">
                      {entry.transcript}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-3">
                  <span className="text-[10px] font-mono text-white/25">
                    Waiting for transmissions...
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Stat row: emoji + label + count
function StatRow({ emoji, label, count }: { emoji: string; label: string; count: number }) {
  return (
    <div className="flex items-center">
      <span className="text-sm mr-2">{emoji}</span>
      <span className="text-xs font-medium text-white/70">{label}</span>
      <div className="flex-1" />
      <span className="text-sm font-bold text-white">{count}</span>
    </div>
  );
}

// Source row: dot + name
function SourceRow({ name, isOnline }: { name: string; isOnline: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500/50'}`} />
      <span className="text-[11px] font-medium text-white/60">{name}</span>
    </div>
  );
}
