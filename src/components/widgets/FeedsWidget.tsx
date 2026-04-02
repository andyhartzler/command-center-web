'use client';
import { useState, useEffect, useCallback } from 'react';
import { Rss, AlertTriangle } from 'lucide-react';
import { type FeedsConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: FeedsConfig;
  style: WidgetStyle;
}

interface FeedItem {
  title: string;
  description: string;
  date: string;
  source: string;
}

export function FeedsWidget({ config, style }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      const urlsParam = encodeURIComponent(config.feedUrls.join(','));
      const res = await fetch(`/api/feeds?urls=${urlsParam}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [config.feedUrls]);

  useEffect(() => {
    fetchFeeds();
    const interval = setInterval(fetchFeeds, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFeeds]);

  if (error && items.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <Rss size={24} className="text-white/20 mb-2" />
        <span className="text-xs text-white/40 text-center">
          {error}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Rss size={14} className="text-emerald-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Global Alerts</span>
      </div>
      
      <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        {items.slice(0, config.maxItems).map((item, i) => (
          <div key={i} className="flex flex-col gap-1 border-l-2 border-emerald-500/50 pl-3 py-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-white/90 leading-tight">
                {item.title}
              </span>
              {item.title.includes('KEV') && <AlertTriangle size={14} className="text-red-400 shrink-0" />}
            </div>
            <span className="text-xs text-white/50 line-clamp-2 leading-relaxed">
              {item.description}
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wide">{item.source}</span>
              <span className="text-[10px] text-white/40">{new Date(item.date).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}} />
    </div>
  );
}
