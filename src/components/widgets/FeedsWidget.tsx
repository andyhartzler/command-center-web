'use client';
import { useMemo } from 'react';
import { Rss, AlertTriangle } from 'lucide-react';
import { type FeedsConfig, type WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
import { WidgetShell, Freshness } from './WidgetShell';
import { AnimatedList } from '../motion/AnimatedList';

const POLL_INTERVAL = 5 * 60_000;

interface Props {
  config: FeedsConfig;
  style: WidgetStyle;
}

interface FeedItem {
  title: string;
  description: string;
  date: string;
  source: string;
  link: string;
}

interface FeedsResponse {
  items: FeedItem[];
  fetchedAt: string;
}

// Deterministic per-source badge tint from the token palette.
const BADGE_COLORS = [
  'var(--color-accent-400)',
  'var(--color-info)',
  'var(--color-ok)',
  'var(--color-warn)',
];

function sourceColor(source: string): string {
  if (source === 'CISA KEV') return 'var(--color-critical)';
  let h = 0;
  for (let i = 0; i < source.length; i++) h = (h * 31 + source.charCodeAt(i)) >>> 0;
  return BADGE_COLORS[h % BADGE_COLORS.length];
}

function itemKey(item: FeedItem): string {
  return item.link || `${item.source}:${item.title}`;
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

export function FeedsWidget({ config, style }: Props) {
  const now = useSharedClock();

  const url = useMemo(() => {
    const feedUrls = (config.feedUrls ?? []).map(u => u.trim()).filter(Boolean);
    if (!feedUrls.length) return null;
    return `/api/feeds?urls=${encodeURIComponent(feedUrls.join(','))}`;
  }, [config.feedUrls]);

  const { data, phase, isStale, lastUpdated } = usePolledData<FeedsResponse>(url, {
    interval: POLL_INTERVAL,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const unique: FeedItem[] = [];
    for (const item of data?.items ?? []) {
      const key = itemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique.slice(0, config.maxItems || 10);
  }, [data, config.maxItems]);

  let body;
  if (!url) {
    body = (
      <div className="h-full flex items-center justify-center">
        <span className="type-label">No sources configured</span>
      </div>
    );
  } else if (items.length === 0 && phase === 'loading') {
    body = <ListSkeleton />;
  } else if (items.length === 0) {
    body = (
      <div className="h-full flex items-center justify-center">
        <span className="type-label">
          {phase === 'error' ? 'Sources unreachable' : 'No alerts from sources'}
        </span>
      </div>
    );
  } else {
    body = (
      <AnimatedList className="flex flex-col">
        {items.map(item => {
          const key = itemKey(item);
          return (
            <div
              key={key}
              data-key={key}
              className="py-2 border-b border-(--border-well) last:border-b-0"
            >
              <a
                href={item.link || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-0.5"
              >
                <div className="flex items-baseline justify-between gap-2 font-mono text-[12px]">
                  <span className="font-semibold truncate" style={{ color: sourceColor(item.source) }}>
                    {item.source}
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--color-text-3)' }}>
                    {formatAge(new Date(item.date).getTime(), now)}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <p
                    className="type-body font-medium leading-snug line-clamp-2 flex-1 min-w-0"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {item.title}
                  </p>
                  {item.source === 'CISA KEV' && (
                    <AlertTriangle
                      size={14}
                      className="shrink-0 mt-1"
                      style={{ color: 'var(--color-critical)' }}
                      aria-hidden
                    />
                  )}
                </div>
                {item.description && (
                  <p className="text-[12px] leading-snug line-clamp-2" style={{ color: 'var(--color-text-3)' }}>
                    {item.description}
                  </p>
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
      icon={<Rss size={18} />}
      title={config.title || 'Global Alerts'}
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
    >
      <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-3">{body}</div>
    </WidgetShell>
  );
}
