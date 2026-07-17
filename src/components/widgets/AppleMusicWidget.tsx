'use client';

import { useEffect, useRef, useState } from 'react';
import { Music } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
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

interface ChartsPayload {
  songs?: ChartSong[];
  error?: string;
}

interface Props {
  config: Record<string, never>;
  style: WidgetStyle;
}

const POLL_INTERVAL = 15 * 60 * 1000;

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AppleMusicWidget({ style }: Props) {
  const { data, phase, isStale, lastUpdated } = usePolledData<ChartsPayload>('/api/apple-music', {
    interval: POLL_INTERVAL,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCompact(el.clientWidth < 280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const songs = data?.songs ?? [];

  return (
    <WidgetShell
      icon={<Music size={18} />}
      title="Top Charts"
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
      style={style}
    >
      <div ref={containerRef} className="w-full h-full overflow-y-auto scrollbar-thin px-2.5 pb-2">
        {phase === 'loading' && songs.length === 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-11 rounded-[10px] animate-pulse"
                style={{ background: 'var(--color-surface-2)', opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {phase !== 'loading' && songs.length === 0 && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Music size={20} style={{ color: 'var(--color-text-3)' }} />
            <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
              Charts unavailable
            </span>
          </div>
        )}

        {songs.map((song, i) => (
          <a
            key={song.id}
            href={song.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-1 py-1.5 rounded-[10px] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <span
              className="text-[12px] font-mono w-6 text-right shrink-0"
              style={{ color: 'var(--color-text-3)' }}
            >
              {i + 1}
            </span>

            <div
              className="w-9 h-9 rounded-md overflow-hidden shrink-0"
              style={{
                background: 'var(--color-surface-2)',
                boxShadow: 'inset 0 0 0 1px var(--border-card)',
              }}
            >
              <img
                src={song.artwork}
                alt=""
                className="w-full h-full object-cover"
                style={{ boxShadow: 'inset 0 0 0 1px var(--border-card)' }}
                loading="lazy"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-medium truncate leading-tight"
                style={{ color: 'var(--color-text-1)' }}
              >
                {song.name}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--color-text-3)' }}>
                {song.artistName}
                {!compact && song.albumName ? ` · ${song.albumName}` : ''}
              </div>
            </div>

            {!compact && (
              <span
                className="text-[12px] font-mono shrink-0"
                style={{ color: 'var(--color-text-3)' }}
              >
                {formatDuration(song.durationMs)}
              </span>
            )}
          </a>
        ))}
      </div>
    </WidgetShell>
  );
}
