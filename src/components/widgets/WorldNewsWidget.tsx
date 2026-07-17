'use client';

import { useMemo } from 'react';
import { Globe } from 'lucide-react';
import { type WorldNewsConfig, type WidgetStyle } from '@/types/widget';
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

interface WorldNewsWidgetProps {
  config: WorldNewsConfig & { title?: string };
  style: WidgetStyle;
}

function categoryColor(cat: string): string {
  switch (cat) {
    case 'world': return 'var(--color-info)';
    case 'crisis': return 'var(--color-critical)';
    case 'finance': return 'var(--color-ok)';
    case 'us':
    case 'tech': return 'var(--color-accent-400)';
    default: return 'var(--color-text-3)';
  }
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-1" aria-hidden>
      <div className="animate-pulse h-[120px] w-full rounded-[10px]" style={{ background: 'var(--color-surface-2)' }} />
      {['a', 'b', 'c'].map(id => (
        <div key={id} className="animate-pulse flex flex-col gap-1.5">
          <div className="h-3 w-24 rounded" style={{ background: 'var(--color-surface-2)' }} />
          <div className="h-4 w-full rounded" style={{ background: 'var(--color-surface-2)' }} />
        </div>
      ))}
    </div>
  );
}

export function WorldNewsWidget({ config, style }: WorldNewsWidgetProps) {
  const now = useSharedClock();

  const { data, phase, isStale, lastUpdated } = usePolledData<NewsResponse>('/api/news?type=world', {
    interval: POLL_INTERVAL,
  });

  // Single relevance pass: filter by configured categories, dedupe by link,
  // cap at maxItems.
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

  const heroArticle = displayed[0] || null;
  const listArticles = displayed.slice(1);

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
        {/* Hero article: image above, source and age, bold title, snippet */}
        {heroArticle && (
          <div
            key={heroArticle.link || heroArticle.title}
            data-key={heroArticle.link || heroArticle.title}
            className="border-b border-(--border-well)"
          >
            <a
              href={heroArticle.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block pb-2.5"
            >
              {heroArticle.imageURL && (
                <div
                  className="w-full rounded-[10px] overflow-hidden mb-2"
                  style={{ height: '120px', background: 'var(--color-surface-2)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroArticle.imageURL}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="flex items-baseline gap-2 mb-1 font-mono text-[12px]">
                <span
                  className="font-semibold uppercase truncate"
                  style={{ color: categoryColor(heroArticle.category), letterSpacing: 'var(--tracking-caps)' }}
                >
                  {heroArticle.source}
                </span>
                <span className="shrink-0" style={{ color: 'var(--color-text-3)' }}>
                  {formatAge(new Date(heroArticle.pubDate).getTime(), now)}
                </span>
              </div>
              <p className="type-body font-bold leading-snug line-clamp-3" style={{ color: 'var(--color-text-1)' }}>
                {heroArticle.title}
              </p>
              {heroArticle.snippet && (
                <p className="mt-1 text-[12px] leading-snug line-clamp-2" style={{ color: 'var(--color-text-2)' }}>
                  {heroArticle.snippet}
                </p>
              )}
            </a>
          </div>
        )}

        {/* Remaining rows */}
        {listArticles.map(article => {
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
      icon={<Globe size={18} />}
      title={config.title || 'World News'}
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-3">{body}</div>
    </WidgetShell>
  );
}
