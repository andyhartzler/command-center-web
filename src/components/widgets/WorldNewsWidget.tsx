'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { useInterval } from '@/hooks/useInterval';
import { relativeTime } from '@/lib/time';
import type { WorldNewsConfig, WidgetStyle } from '@/types/widget';

interface Article {
  title: string;
  source: string;
  category: string;
  pubDate: string;
  link: string;
  snippet: string;
  imageURL: string | null;
}

interface WorldNewsWidgetProps {
  config: WorldNewsConfig;
  style: WidgetStyle;
}

// Category colors: teal=world, blue=us, blue=tech, mint=finance
function categoryColor(cat: string): string {
  switch (cat) {
    case 'world': return 'text-teal-400/80';
    case 'us': return 'text-[#6b8aab]';
    case 'tech': return 'text-[#6b8aab]';
    case 'finance': return 'text-emerald-300/80';
    case 'crisis': return 'text-red-400/80';
    default: return 'text-gray-400/80';
  }
}

export function WorldNewsWidget({ config }: WorldNewsWidgetProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news?type=world');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let items: Article[] = data.articles ?? [];

      // Filter by categories if configured
      if (config.categories?.length) {
        items = items.filter(a => config.categories.includes(a.category));
      }

      setArticles(items);
      setError(null);
      setHeroImgError(false);
    } catch (err) {
      console.error('[WorldNewsWidget] fetch error:', err);
      setError('Failed to load world news');
    } finally {
      setLoading(false);
    }
  }, [config.categories]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useInterval(fetchNews, 300_000); // 5 minutes - matches Swift

  const maxItems = config.maxItems || 15;

  // Filter by configured categories if provided
  const filtered = config.categories?.length
    ? articles.filter((a) => config.categories.includes(a.category))
    : articles;

  const displayed = filtered.slice(0, maxItems);
  const heroArticle = displayed[0] || null;
  const listArticles = displayed.slice(1);

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
        <Globe size={24} className="text-white/20" />
        <span className="text-xs text-white/40">{error}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden p-4">
      {/* Header - matches Swift: "World News" 15pt bold + relative time */}
      <div className="flex items-baseline justify-between pb-2.5 shrink-0">
        <span className="text-[15px] font-bold text-white/90" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          World News
        </span>
        {displayed.length > 0 && displayed[0].pubDate && (
          <span className="text-[11px] font-medium text-white/30">
            {relativeTime(displayed[0].pubDate)}
          </span>
        )}
      </div>

      {displayed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-white/30">No articles found</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex flex-col">
            {/* Hero article - matches Swift: image above, then source/time, then bold title, then snippet */}
            {heroArticle && (
              <a
                href={heroArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block pb-2.5 group cursor-pointer"
              >
                {/* Hero image - matches Swift: 120px tall, rounded-lg */}
                {heroArticle.imageURL && !heroImgError && (
                  <div className="w-full rounded-[10px] overflow-hidden mb-2 bg-white/[0.05]" style={{ height: '120px' }}>
                    <img
                      src={heroArticle.imageURL}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => setHeroImgError(true)}
                    />
                  </div>
                )}

                {/* Source + time */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[9px] font-bold uppercase ${categoryColor(heroArticle.category)}`} style={{ letterSpacing: '0.5px' }}>
                    {heroArticle.source}
                  </span>
                  {heroArticle.pubDate && (
                    <>
                      <div className="w-[2px] h-[2px] rounded-full bg-white/20" />
                      <span className="text-[9px] font-medium text-white/35">
                        {relativeTime(heroArticle.pubDate)}
                      </span>
                    </>
                  )}
                </div>

                {/* Title - matches Swift: 14pt bold */}
                <p className="text-[14px] font-bold text-white/90 leading-snug line-clamp-3 group-hover:text-white transition-colors">
                  {heroArticle.title}
                </p>

                {/* Snippet */}
                {heroArticle.snippet && (
                  <p className="mt-1 text-[11px] text-white/45 line-clamp-2">
                    {heroArticle.snippet}
                  </p>
                )}
              </a>
            )}

            {/* Divider after hero */}
            {heroArticle && listArticles.length > 0 && (
              <div className="bg-white/[0.06] mb-1.5" style={{ height: '0.5px' }} />
            )}

            {/* Article list - matches Swift: same layout as NewsWidget rows */}
            {listArticles.map((article, i) => (
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

                {/* Divider */}
                {i < listArticles.length - 1 && (
                  <div className="bg-white/[0.04]" style={{ height: '0.5px' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
