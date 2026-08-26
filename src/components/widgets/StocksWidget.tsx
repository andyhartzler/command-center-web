'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { MarketRow } from './market/MarketRow';
import type { StocksConfig, WidgetStyle } from '@/types/widget';

// Re-exported so existing catalog consumers (WidgetConfigPanel) keep working.
export { STOCK_CATALOG } from '@/data/marketCatalogs';

const POLL_INTERVAL = 60_000;
// Continuous ticker speed, pixels per second. Slow and calm — the whole S&P 500
// drifts by; the wall is watched from across the room, not raced through.
const SCROLL_SPEED = 9;

interface StockQuote {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  spark: number[] | null;
}

interface StocksWidgetProps {
  config: StocksConfig;
  style: WidgetStyle;
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StocksWidget({ config, style }: StocksWidgetProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const symbols = useMemo(
    () => config.symbols.map(s => s.trim().toUpperCase()).filter(s => s.length > 0),
    [config.symbols],
  );
  const url = symbols.length > 0 ? `/api/stocks?symbols=${symbols.join(',')}` : null;
  const { data, phase, isStale, lastUpdated } = usePolledData<StockQuote[]>(url, {
    interval: POLL_INTERVAL,
  });

  const quotes = useMemo(() => {
    const bySymbol = new Map((Array.isArray(data) ? data : []).map(q => [q.symbol, q]));
    return symbols.map(sym => bySymbol.get(sym) ?? { symbol: sym, price: null, changePercent: null, spark: null });
  }, [data, symbols]);

  // Sparklines are one SVG per row; with hundreds of tickers (rendered twice for
  // the marquee) that is too many nodes to paint smoothly, so drop them on big lists.
  const showSpark = width >= 250 && symbols.length <= 80;

  // Continuous vertical marquee: the list is rendered twice back-to-back and the
  // track is translated up by exactly one copy's height on an infinite linear
  // loop, so the seam is invisible and the scroll never stops. Duration is
  // derived from measured height so speed stays constant regardless of how many
  // symbols are configured. Falls back to a static column (no animation) when the
  // content is shorter than the viewport or the viewer prefers reduced motion.
  useEffect(() => {
    const track = trackRef.current;
    const list = listRef.current;
    const body = bodyRef.current;
    if (!track || !list || !body || !data) return;

    let anim: Animation | null = null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const build = () => {
      anim?.cancel();
      const copyHeight = list.offsetHeight;
      const viewport = body.clientHeight;
      // Nothing to loop if a single copy already fits, or motion is disabled.
      if (reduce || copyHeight <= viewport + 4) {
        track.style.transform = 'translateY(0)';
        return;
      }
      anim = track.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(-${copyHeight}px)` }],
        { duration: (copyHeight / SCROLL_SPEED) * 1000, iterations: Infinity, easing: 'linear' },
      );
    };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(list);
    ro.observe(body);
    return () => {
      ro.disconnect();
      anim?.cancel();
    };
  }, [data, quotes.length, showSpark]);

  const pause = () => trackRef.current?.getAnimations().forEach(a => a.pause());
  const resume = () => trackRef.current?.getAnimations().forEach(a => a.play());

  const renderRow = (quote: StockQuote, key: string, withRule: boolean) => (
    <div key={key}>
      <MarketRow
        symbol={quote.symbol}
        price={quote.price}
        changePercent={quote.changePercent}
        spark={quote.spark ?? undefined}
        showName={false}
        showSpark={showSpark}
        format={formatPrice}
      />
      {withRule && <div className="h-px" style={{ background: 'var(--border-card)' }} />}
    </div>
  );

  return (
    <div className="w-full h-full" style={{ opacity: style.opacity }}>
      <WidgetShell
        icon={<TrendingUp size={18} />}
        title="Markets"
        status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
        style={style}
      >
        <div
          ref={bodyRef}
          className="absolute inset-0 overflow-hidden px-3.5 pb-3"
          onMouseEnter={pause}
          onMouseLeave={resume}
        >
          {!data ? (
            <div className="w-full h-full flex items-center justify-center">
              {phase === 'error' ? (
                <span className="type-label">no market data</span>
              ) : (
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-surface-3)', borderTopColor: 'var(--color-text-3)' }}
                />
              )}
            </div>
          ) : (
            <div ref={trackRef} className="will-change-transform">
              {/* Copy A — the measured one. */}
              <div ref={listRef} className="flex flex-col">
                {quotes.map((q, i) => renderRow(q, `a-${q.symbol}`, i < quotes.length - 1))}
              </div>
              {/* Copy B — seamless continuation; hidden from a11y/measurement. */}
              <div className="flex flex-col" aria-hidden>
                {quotes.map((q, i) => renderRow(q, `b-${q.symbol}`, i < quotes.length - 1))}
              </div>
            </div>
          )}
        </div>
      </WidgetShell>
    </div>
  );
}
