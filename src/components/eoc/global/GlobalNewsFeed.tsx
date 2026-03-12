'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Newspaper } from 'lucide-react';

interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
  summary: string;
  risk_score: number;
  coords: [number, number] | null;
}

interface Props {
  news: NewsItem[];
  onFlyTo?: (lat: number, lng: number) => void;
}

function riskColor(score: number): string {
  if (score >= 8) return 'text-red-400 bg-red-500/20 border-red-500/30';
  if (score >= 5) return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
  if (score >= 3) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
  return 'text-green-400 bg-green-500/20 border-green-500/30';
}

function riskLabel(score: number): string {
  if (score >= 8) return 'CRITICAL';
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return 'now';
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch {
    return '';
  }
}

export function GlobalNewsFeed({ news, onFlyTo }: Props) {
  const [minimized, setMinimized] = useState(false);

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl flex flex-col overflow-hidden pointer-events-auto">
      <div
        className="flex justify-between items-center p-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          <Newspaper size={12} className="text-cyan-500" />
          <span className="text-[10px] text-white/40 font-mono tracking-widest">SIGINT FEED</span>
          {news.length > 0 && (
            <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-sm">
              {news.length}
            </span>
          )}
        </div>
        <button className="text-white/30 hover:text-white/60 transition-colors">
          {minimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!minimized && (
        <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto styled-scrollbar">
          {news.length === 0 && (
            <div className="p-4 text-center text-white/20 text-xs font-mono">Loading feeds...</div>
          )}
          {news.slice(0, 25).map((item, i) => (
            <div
              key={i}
              className="flex flex-col gap-1 p-2.5 px-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
              onClick={() => {
                if (item.coords && onFlyTo) {
                  onFlyTo(item.coords[0], item.coords[1]);
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] text-white/80 font-medium leading-tight line-clamp-2 group-hover:text-white transition-colors">
                  {item.title}
                </span>
                <span className={`shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${riskColor(item.risk_score)}`}>
                  {riskLabel(item.risk_score)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-white/25 font-mono">
                <span className="text-cyan-500/60">{item.source}</span>
                {item.published && <span>{timeAgo(item.published)}</span>}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/20 hover:text-cyan-400 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
