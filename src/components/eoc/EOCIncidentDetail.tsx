'use client';
import { useState, useMemo, useRef } from 'react';
import type { EOCIncident, EOCUpdate, EOCRadioClip, EOCLiveStream } from '@/types/eoc';

interface EOCIncidentDetailProps {
  incident: EOCIncident;
  serverURL: string;
  onDismiss: () => void;
}

type DetailTab = 'overview' | 'timeline' | 'media';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  major: 'bg-orange-500',
  minor: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-zinc-500',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return dateStr; }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ''; }
}

function updateTypeLabel(type?: string): string {
  switch (type) {
    case 'ROOT': return 'Initial';
    case 'TEXT': return 'Update';
    case 'LOCATION_CHANGE': return 'Location';
    default: return type || 'Update';
  }
}

function updateBadgeColor(type?: string): string {
  switch (type) {
    case 'ROOT': return 'bg-blue-500/60';
    case 'TEXT': return 'bg-green-500/50';
    case 'LOCATION_CHANGE': return 'bg-cyan-500/50';
    default: return 'bg-zinc-500/50';
  }
}

// Build Mux HLS URL from stream ID
function getHlsUrl(stream: EOCLiveStream): string | null {
  if (!stream.videoStreamId) return null;
  const muxId = stream.videoStreamId.replace('mux:', '');
  return `https://stream.mux.com/${muxId}.m3u8`;
}

export function EOCIncidentDetail({ incident, serverURL, onDismiss }: EOCIncidentDetailProps) {
  const [tab, setTab] = useState<DetailTab>('overview');

  const rawData = incident.raw_data;

  // Sorted updates (by timestamp ascending)
  const sortedUpdates = useMemo(() => {
    if (!rawData?.updates) return [];
    return Object.values(rawData.updates).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  }, [rawData?.updates]);

  // Live streams
  const liveStreams = useMemo(() => {
    if (!rawData?.liveStreamers) return [];
    return Object.values(rawData.liveStreamers);
  }, [rawData?.liveStreamers]);

  // All radio clips from updates
  const allRadioClips = useMemo(() => {
    return sortedUpdates.flatMap(u => u.radioClips || []);
  }, [sortedUpdates]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-[28px] leading-none mt-1 shrink-0">{incident.emoji || '🔵'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-white leading-tight mb-1">
              {incident.title}
            </div>
            {incident.address && (
              <div className="text-[11px] text-white/60 mb-2">{incident.address}</div>
            )}
            {/* Severity + badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full text-white ${SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.info}`}>
                {incident.severity.toUpperCase()}
              </span>
              {rawData?.confirmed && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white bg-green-500/50">
                  CONFIRMED
                </span>
              )}
              {rawData?.police && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white bg-blue-500/50">
                  {rawData.police}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            title="Close detail"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tab picker */}
      <div className="shrink-0 flex bg-white/[0.03]">
        {(['overview', 'timeline', 'media'] as DetailTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              tab === t
                ? 'text-white bg-white/10 font-bold'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <OverviewTab incident={incident} rawData={rawData} />
        )}
        {tab === 'timeline' && (
          <TimelineTab updates={sortedUpdates} />
        )}
        {tab === 'media' && (
          <MediaTab liveStreams={liveStreams} radioClips={allRadioClips} />
        )}
      </div>
    </div>
  );
}

// Overview tab
function OverviewTab({ incident, rawData }: { incident: EOCIncident; rawData?: EOCIncident['raw_data'] }) {
  return (
    <div className="px-4 py-3 space-y-3">
      {/* Description */}
      {incident.description && (
        <p className="text-xs text-white/80 leading-relaxed">{incident.description}</p>
      )}

      {/* Info grid */}
      <div className="space-y-2">
        {rawData?.neighborhood && (
          <InfoRow icon="building" label="Neighborhood" value={rawData.neighborhood} />
        )}
        {rawData?.police && (
          <InfoRow icon="shield" label="Police Unit" value={rawData.police} />
        )}
        {rawData?.incidentScore && rawData.incidentScore > 0 && (
          <InfoRow icon="chart" label="Incident Score" value={String(rawData.incidentScore)} />
        )}
        {rawData?.level && (
          <InfoRow icon="alert" label="Level" value={String(rawData.level)} />
        )}
        {rawData?.categories && rawData.categories.length > 0 && (
          <InfoRow icon="tag" label="Categories" value={rawData.categories.join(', ')} />
        )}
        <InfoRow icon="clock" label="Detected" value={formatDate(incident.detected_at)} />
        <InfoRow icon="refresh" label="Updated" value={formatDate(incident.updated_at)} />
        {incident.resolved_at && (
          <InfoRow icon="check" label="Resolved" value={formatDate(incident.resolved_at)} />
        )}
      </div>

      {/* Share map image */}
      {rawData?.shareMap && (
        <img
          src={rawData.shareMap}
          alt="Incident map"
          className="w-full rounded-lg"
          loading="lazy"
        />
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-3 text-center shrink-0">
        {icon === 'building' && '🏢'}
        {icon === 'shield' && '🛡'}
        {icon === 'chart' && '📊'}
        {icon === 'alert' && '⚠'}
        {icon === 'tag' && '🏷'}
        {icon === 'clock' && '🕐'}
        {icon === 'refresh' && '🔄'}
        {icon === 'check' && '✅'}
      </span>
      <span className="text-[10px] font-medium text-white/50">{label}</span>
      <div className="flex-1" />
      <span className="text-[10px] font-medium text-white/80 text-right">{value}</span>
    </div>
  );
}

// Timeline tab
function TimelineTab({ updates }: { updates: EOCUpdate[] }) {
  if (updates.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <span className="text-xs text-white/40">No updates available</span>
      </div>
    );
  }

  return (
    <div className="py-2">
      {updates.map((update, idx) => (
        <div key={`${update.ts}-${update.type}-${idx}`}>
          <div className="px-4 py-1.5">
            {/* Type badge + timestamp */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white ${updateBadgeColor(update.type)}`}>
                {updateTypeLabel(update.type)}
              </span>
              {update.ts && (
                <span className="text-[9px] font-mono text-white/40">
                  {formatTime(update.ts)}
                </span>
              )}
            </div>

            {/* Update text */}
            {update.text && (
              <p className="text-[11px] text-white/80 leading-relaxed">{update.text}</p>
            )}

            {/* Location change */}
            {update.type === 'LOCATION_CHANGE' && update.displayLocation && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[8px] text-cyan-500/70">📍</span>
                <span className="text-[10px] text-cyan-500/70">{update.displayLocation}</span>
              </div>
            )}

            {/* Inline radio clips */}
            {update.radioClips && update.radioClips.map((clip, ci) => (
              <RadioClipPlayer key={clip.audioFileUrl || ci} clip={clip} />
            ))}
          </div>

          {idx < updates.length - 1 && (
            <div className="h-px bg-white/[0.08] mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}

// Media tab
function MediaTab({ liveStreams, radioClips }: { liveStreams: EOCLiveStream[]; radioClips: EOCRadioClip[] }) {
  const hasContent = liveStreams.length > 0 || radioClips.length > 0;

  if (!hasContent) {
    return (
      <div className="px-4 py-10 text-center">
        <div className="text-2xl text-white/15 mb-2">🔇</div>
        <span className="text-xs text-white/40">No media available</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Live streams */}
      {liveStreams.length > 0 && (
        <div>
          <div className="text-[9px] font-bold text-white/40 tracking-[2px] mb-2">LIVE STREAMS</div>
          {liveStreams.map((stream, idx) => (
            <LiveStreamCard key={stream.videoStreamId || idx} stream={stream} />
          ))}
        </div>
      )}

      {/* Radio clips */}
      {radioClips.length > 0 && (
        <div>
          <div className="text-[9px] font-bold text-white/40 tracking-[2px] mb-2">RADIO DISPATCH</div>
          {radioClips.map((clip, idx) => (
            <RadioClipPlayer key={clip.audioFileUrl || idx} clip={clip} />
          ))}
        </div>
      )}
    </div>
  );
}

// Radio clip player component
function RadioClipPlayer({ clip }: { clip: EOCRadioClip }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePlay() {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current && clip.audioFileUrl) {
        audioRef.current = new Audio(clip.audioFileUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }

  const durationSec = clip.duration ? (clip.duration / 1000).toFixed(1) : '0.0';

  return (
    <div className="p-2.5 mt-1.5 rounded-lg bg-cyan-500/[0.06]">
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          disabled={!clip.audioFileUrl}
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.2"/>
              <rect x="9" y="8" width="2" height="8" rx="0.5"/>
              <rect x="13" y="8" width="2" height="8" rx="0.5"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.2"/>
              <polygon points="10,8 16,12 10,16"/>
            </svg>
          )}
        </button>
        <div>
          <div className="text-[11px] font-semibold text-white">
            {clip.source || 'Radio Dispatch'}
          </div>
          <div className="text-[9px] font-mono text-white/40">
            {durationSec}s
          </div>
        </div>
      </div>

      {/* Transcription */}
      {clip.transcription?.text && (
        <div className="mt-2 p-2 rounded bg-white/5 text-[11px] text-white/70 line-clamp-4">
          {clip.transcription.text}
        </div>
      )}
    </div>
  );
}

// Live stream card
function LiveStreamCard({ stream }: { stream: EOCLiveStream }) {
  const hlsUrl = getHlsUrl(stream);
  const isLive = stream.isOnAir && !stream.hlsDone;

  return (
    <div className="p-2.5 rounded-lg bg-white/5 mb-2">
      {hlsUrl && (
        <div className="w-full h-[180px] rounded-lg overflow-hidden bg-black mb-2">
          <video
            src={hlsUrl}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        {isLive ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[9px] font-black text-red-400">LIVE</span>
          </>
        ) : stream.hlsDone ? (
          <span className="text-[9px] font-black text-white/30">ENDED</span>
        ) : null}

        <span className="text-[11px] font-semibold text-white">
          {stream.userFullName || stream.username || 'Stream'}
        </span>
      </div>
    </div>
  );
}
