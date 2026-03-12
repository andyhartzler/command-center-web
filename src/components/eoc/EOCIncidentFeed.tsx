'use client';
import type { EOCIncident } from '@/types/eoc';

interface EOCIncidentFeedProps {
  incidents: EOCIncident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isConnected: boolean;
  activeCount: number;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(seconds) || seconds < 0) return '';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function cardBg(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/[0.15]';
    case 'major': return 'bg-orange-500/[0.08]';
    default: return 'bg-white/[0.03]';
  }
}

function borderColor(severity: string, isSelected: boolean): string {
  if (isSelected) return 'border-cyan-500/60 border-[1.5px]';
  switch (severity) {
    case 'critical': return 'border-red-500/50 border-[1.5px]';
    case 'major': return 'border-orange-500/30 border';
    default: return 'border-white/[0.06] border';
  }
}

export function EOCIncidentFeed({ incidents, selectedId, onSelect, isConnected, activeCount }: EOCIncidentFeedProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header matching Swift: connection dot + LIVE INCIDENTS + count */}
      <div className="shrink-0 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold text-white/50 tracking-[3px]">LIVE INCIDENTS</span>
          <div className="flex-1" />
          <span className="text-sm font-bold text-white/70">{activeCount}</span>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Incident list */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="flex flex-col gap-1.5">
          {incidents.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="text-xs text-white/20">
                {isConnected ? 'No active incidents' : 'Connecting to EOC server...'}
              </span>
            </div>
          ) : (
            incidents.slice(0, 50).map(incident => {
              const isSelected = incident.id === selectedId;
              const policeUnit = incident.raw_data?.police;

              return (
                <button
                  key={incident.id}
                  onClick={() => onSelect(incident.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all duration-150 ${
                    isSelected ? 'bg-cyan-500/[0.15]' : cardBg(incident.severity)
                  } ${borderColor(incident.severity, isSelected)}`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Emoji */}
                    <span className="text-xl leading-none mt-0.5 shrink-0">
                      {incident.emoji || '🔵'}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="text-xs font-semibold text-white line-clamp-2 mb-0.5">
                        {incident.title}
                      </div>

                      {/* Address */}
                      {incident.address && (
                        <div className="text-[10px] text-white/50 truncate mb-1">
                          {incident.address}
                        </div>
                      )}

                      {/* Source + time + police unit */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold font-mono text-white/30 uppercase">
                          {incident.source}
                        </span>
                        <span className="text-[9px] text-white/30">
                          {timeAgo(incident.detected_at)}
                        </span>
                        {policeUnit && (
                          <span className="text-[8px] font-bold font-mono text-cyan-500/50">
                            {policeUnit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
