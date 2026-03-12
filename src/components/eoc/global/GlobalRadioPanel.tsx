'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Volume2, ChevronDown, ChevronUp, Users, ExternalLink } from 'lucide-react';

interface RadioFeed {
  id: string;
  listeners: number;
  location: string;
  name: string;
  category: string;
  streamUrl: string;
}

export function GlobalRadioPanel() {
  const [feeds, setFeeds] = useState<RadioFeed[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        const res = await fetch('/api/global/radio');
        if (res.ok) {
          const data = await res.json();
          setFeeds(data.feeds || []);
        }
      } catch {}
    };
    fetchFeeds();
    const id = setInterval(fetchFeeds, 300_000);
    return () => clearInterval(id);
  }, []);

  const togglePlay = (feed: RadioFeed) => {
    if (playing === feed.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }

    const audio = new Audio(feed.streamUrl);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlaying(feed.id);

    audio.addEventListener('error', () => setPlaying(null));
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (feeds.length === 0) return null;

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl flex flex-col overflow-hidden pointer-events-auto mt-3">
      <div
        className="flex justify-between items-center p-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-amber-500" />
          <span className="text-[10px] text-white/40 font-mono tracking-widest">RADIO INTERCEPT</span>
          {playing && (
            <span className="text-[8px] bg-red-500/30 text-red-400 px-1.5 py-0.5 rounded-sm animate-pulse">
              LIVE
            </span>
          )}
        </div>
        <button className="text-white/30 hover:text-white/60 transition-colors">
          {minimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!minimized && (
        <div className="flex flex-col max-h-[30vh] overflow-y-auto styled-scrollbar">
          {feeds.slice(0, 15).map(feed => (
            <div
              key={feed.id}
              className={`flex items-center gap-2 p-2 px-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                playing === feed.id ? 'bg-amber-500/10' : ''
              }`}
              onClick={() => togglePlay(feed)}
            >
              <button className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                {playing === feed.id ? (
                  <Pause size={10} className="text-amber-400" />
                ) : (
                  <Play size={10} className="text-white/50" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/70 truncate">{feed.name}</div>
                <div className="text-[9px] text-white/25 font-mono truncate">{feed.location} · {feed.category}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Users size={8} className="text-white/20" />
                <span className="text-[9px] text-white/30 font-mono">{feed.listeners}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
