'use client';

import { useMemo } from 'react';
import { Newspaper } from 'lucide-react';
import { type NewsConfig, type WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
import { WidgetShell, Freshness } from './WidgetShell';
import { AnimatedList } from '../motion/AnimatedList';

const POLL_INTERVAL = 5 * 60_000;

interface Article {
  title: string;
  source: string;
  category: string;
  pubDate: string;
  link: string;
  snippet: string;
  imageURL: string | null;
}

interface NewsResponse {
  articles: Article[];
}

interface NewsWidgetProps {
  config: NewsConfig & { title?: string };
  style: WidgetStyle;
}

function categoryColor(cat: string): string {
  switch (cat) {
    case 'crime': return 'var(--color-critical)';
    case 'missouri': return 'var(--color-info)';
    case 'sports': return 'var(--color-warn)';
    case 'local':
    case 'politics': return 'var(--color-accent-400)';
    default: return 'var(--color-text-3)';
  }
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-1" aria-hidden>
      {['a', 'b', 'c', 'd'].map(id => (
        <div key={id} className="animate-pulse flex flex-col gap-1.5">
          <div className="h-3 w-24 rounded" style={{ background: 'var(--color-surface-2)' }} />
          <div className="h-4 w-full rounded" style={{ background: 'var(--color-surface-2)' }} />
        </div>
      ))}
    </div>
  );
}

export function NewsWidget({ config, style }: NewsWidgetProps) {
  const now = useSharedClock();

  const url = useMemo(() => {
    if (config.feeds?.length) {
      const feedUrls = config.feeds.map(f => f.url).filter(Boolean).join(',');
      if (feedUrls) {
        const feedNames = config.feeds.map(f => f.name || 'Custom').join(',');
        return `/api/news?feeds=${encodeURIComponent(feedUrls)}&sources=${encodeURIComponent(feedNames)}`;
      }
    }
    return '/api/news?type=local';
  }, [config.feeds]);

  const { data, phase, isStale, lastUpdated } = usePolledData<NewsResponse>(url, {
    interval: POLL_INTERVAL,
  });

  const displayed = useMemo(() => {
    let items = data?.articles ?? [];
    if (config.categories?.length) {
      items = items.filter(a => config.categories.includes(a.category));
    }
    const seen = new Set<string>();
    const unique: Article[] = [];
    for (const article of items) {
      const key = article.link || article.title;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(article);
    }
    return unique.slice(0, config.maxItems || 15);
  }, [data, config.categories, config.maxItems]);

  let body;
  if (displayed.length === 0 && phase === 'loading') {
    body = <ListSkeleton />;
  } else if (displayed.length === 0) {
    body = (
      <div className="h-full flex items-center justify-center">
        <span className="type-label">
          {phase === 'error' ? 'Sources unreachable' : 'No matching headlines'}
        </span>
      </div>
    );
  } else {
    body = (
      <AnimatedList className="flex flex-col">
        {displayed.map(article => {
          const key = article.link || article.title;
          return (
            <div
              key={key}
              data-key={key}
              className="border-b border-(--border-well) last:border-b-0"
            >
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 py-2"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2 font-mono text-[12px]">
                    <span className="font-semibold truncate" style={{ color: categoryColor(article.category) }}>
                      {article.source}
                    </span>
                    <span className="shrink-0" style={{ color: 'var(--color-text-3)' }}>
                      {formatAge(new Date(article.pubDate).getTime(), now)}
                    </span>
                  </div>
                  <p
                    className="type-body font-medium leading-snug line-clamp-2"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {article.title}
                  </p>
                  {article.snippet && (
                    <p className="text-[12px] leading-snug line-clamp-1" style={{ color: 'var(--color-text-3)' }}>
                      {article.snippet}
                    </p>
                  )}
                </div>
                {article.imageURL && (
                  <div
                    className="shrink-0 w-14 h-14 rounded-lg overflow-hidden"
                    style={{ background: 'var(--color-surface-2)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.imageURL}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </a>
            </div>
          );
        })}
      </AnimatedList>
    );
  }

  return (
    <WidgetShell
      icon={<Newspaper size={18} />}
      title={config.title || 'KC News'}
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-3">{body}</div>
    </WidgetShell>
  );
}
