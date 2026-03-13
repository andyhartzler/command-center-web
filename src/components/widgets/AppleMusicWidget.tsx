'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Music, ExternalLink } from 'lucide-react';
import type { WidgetStyle } from '@/types/widget';

interface ChartSong {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  artwork: string;
  url: string;
  durationMs: number;
}

interface Props {
  config: Record<string, never>;
  style: WidgetStyle;
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AppleMusicWidget({}: Props) {
  const [songs, setSongs] = useState<ChartSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 300 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchCharts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/apple-music');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSongs(data.songs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCharts();
    const interval = setInterval(fetchCharts, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCharts]);

  const isCompact = dims.w < 280;

  if (loading && songs.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center bg-[#1a1a1c] rounded-2xl">
        <div className="w-4 h-4 border-2 border-white/10 border-t-[#fa2d48]/50 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && songs.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#1a1a1c] rounded-2xl p-4">
        <Music size={20} className="text-[#fa2d48]/40" />
        <span className="text-[10px] text-white/30 text-center">{error}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-[#1a1a1c] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1 shrink-0">
        <Music size={14} className="text-[#fa2d48]" />
        <span className="text-[11px] font-semibold text-white/90 tracking-wide">Top Charts</span>
        <span className="text-[9px] text-white/20 ml-auto">Apple Music</span>
      </div>

      {/* Songs list */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin px-1">
        {songs.map((song, i) => (
          <a
            key={song.id}
            href={song.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.04] rounded-lg transition-colors group"
          >
            {/* Rank */}
            <span className="text-[10px] font-bold text-white/20 w-5 text-right shrink-0 tabular-nums">
              {i + 1}
            </span>

            {/* Album art */}
            <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 bg-white/[0.05]">
              <img
                src={song.artwork}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Song info */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-white/85 truncate leading-tight">
                {song.name}
              </div>
              <div className="text-[9px] text-white/35 truncate">
                {song.artistName}
                {!isCompact && ` — ${song.albumName}`}
              </div>
            </div>

            {/* Duration + link */}
            {!isCompact && (
              <span className="text-[9px] text-white/20 tabular-nums shrink-0">
                {formatDuration(song.durationMs)}
              </span>
            )}
            <ExternalLink size={10} className="text-white/0 group-hover:text-white/20 transition-colors shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
