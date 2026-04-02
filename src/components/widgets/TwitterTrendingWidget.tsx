'use client';
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import { type TwitterTrendingConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: TwitterTrendingConfig;
  style: WidgetStyle;
}

interface Trend {
  name: string;
  tweet_volume: number | null;
}

export function TwitterTrendingWidget({ config, style }: Props) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    try {
      const res = await fetch(`/api/twitter-trending?woeid=${config.woeid}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTrends(data.trends || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [config.woeid]);

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrends]);

  if (error && trends.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <TrendingUp size={24} className="text-white/20 mb-2" />
        <span className="text-xs text-white/40 text-center">
          {error}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden bg-[#15202b]/80">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <TrendingUp size={16} className="text-[#1d9bf0]" />
        <span className="text-xs font-bold text-white/90 uppercase tracking-widest">Trending</span>
      </div>
      
      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        {trends.slice(0, config.maxTrends).map((trend, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-sm font-bold text-[#1d9bf0]/50 w-4 pt-0.5">{i + 1}</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white/90">{trend.name}</span>
              {trend.tweet_volume && (
                <span className="text-xs text-white/50">
                  {(trend.tweet_volume / 1000).toFixed(1)}K posts
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
