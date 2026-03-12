'use client';

import { useState, useEffect, useCallback } from 'react';
import { Newspaper } from 'lucide-react';
import { useInterval } from '@/hooks/useInterval';
import { relativeTime } from '@/lib/time';
import type { NewsConfig, WidgetStyle } from '@/types/widget';

interface Article {
  title: string;
  source: string;
  category: string;
  pubDate: string;
  link: string;
  snippet: string;
  imageURL: string | null;
}

interface NewsWidgetProps {
  config: NewsConfig;
  style: WidgetStyle;
}

// Category colors matching Swift exactly
function categoryColor(cat: string): string {
  switch (cat) {
    case 'local': return 'text-[#6b8aab]';
    case 'crime': return 'text-red-400/80';
    case 'politics': return 'text-[#6b8aab]';
    case 'missouri': return 'text-teal-400/80';
    case 'sports': return 'text-yellow-400/80';
    default: return 'text-gray-400/80';
  }
}

export function NewsWidget({ config, style }: NewsWidgetProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      let url = '/api/news?type=local';

      // Pass custom feeds if configured
      if (config.feeds?.length) {
        const feedUrls = config.feeds.map(f => f.url).filter(Boolean).join(',');
        const feedNames = config.feeds.map(f => f.name || 'Custom').join(',');
        if (feedUrls) {
          url = `/api/news?feeds=${encodeURIComponent(feedUrls)}&sources=${encodeURIComponent(feedNames)}`;
        }
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let items: Article[] = data.articles ?? [];

      // Filter by categories if configured
      if (config.categories?.length) {
        items = items.filter(a => config.categories.includes(a.category));
      }

      setArticles(items);
      setError(null);
    } catch (err) {
      console.error('[NewsWidget] fetch error:', err);
      setError('Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [config.feeds, config.categories]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useInterval(fetchNews, 300_000); // 5 minutes - matches Swift timer

  const maxItems = config.maxItems || 15;
  const displayed = articles.slice(0, maxItems);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && articles.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
        <Newspaper size={24} className="text-white/20" />
        <span className="text-xs text-white/40">{error}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden p-4">
      {/* Header - matches Swift: "KC News" bold rounded + relative time */}
      <div className="flex items-baseline justify-between pb-2.5 shrink-0">
        <span className="text-[15px] font-bold text-white/90" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          KC News
        </span>
        {displayed.length > 0 && displayed[0].pubDate && (
          <span className="text-[11px] font-medium text-white/30">
            {relativeTime(displayed[0].pubDate)}
          </span>
        )}
      </div>

      {/* Article list */}
      {displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-white/30">No articles found</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex flex-col">
            {displayed.map((article, i) => (
              <div key={`${article.link}-${i}`}>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 py-[5px] group cursor-pointer"
                >
                  {/* Text content */}
                  <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    {/* Source + time */}
                    <div className="flex items-center gap-[5px]">
                      <span className={`text-[9px] font-bold ${categoryColor(article.category)}`}>
                        {article.source}
                      </span>
                      <span className="text-[9px] font-medium text-white/25">
                        {relativeTime(article.pubDate)}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-[12px] font-semibold text-white/85 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                      {article.title}
                    </p>

                    {/* Snippet */}
                    {article.snippet && (
                      <p className="text-[10px] text-white/35 line-clamp-1">
                        {article.snippet}
                      </p>
                    )}
                  </div>

                  {/* Thumbnail - matches Swift: 56x56 rounded-lg */}
                  {article.imageURL && (
                    <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/[0.04]">
                      <img
                        src={article.imageURL}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </a>

                {/* Divider - matches Swift: 0.5px white/4% */}
                {i < displayed.length - 1 && (
                  <div className="h-px bg-white/[0.04]" style={{ height: '0.5px' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
