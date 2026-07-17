'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { MarketRow } from './market/MarketRow';
import { STOCK_CATALOG } from '@/data/marketCatalogs';
import type { StocksConfig, WidgetStyle } from '@/types/widget';

// Re-exported so existing catalog consumers (WidgetConfigPanel) keep working.
export { STOCK_CATALOG } from '@/data/marketCatalogs';

const POLL_INTERVAL = 60_000;

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

  const useGrid = width > 380 && quotes.length > 4;
  const colWidth = useGrid ? (width - 24) / 2 : width;
  const showSpark = colWidth >= 250;
  const showName = colWidth >= 200;

  return (
    <div className="w-full h-full" style={{ opacity: style.opacity }}>
      <WidgetShell
        icon={<TrendingUp size={18} />}
        title="Markets"
        status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
        style={style}
      >
        <div ref={bodyRef} className="absolute inset-0 overflow-y-auto scrollbar-thin px-3.5 pb-3">
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
            <div className={useGrid ? 'grid grid-cols-2 gap-x-6' : 'flex flex-col'}>
              {quotes.map((quote, i) => (
                <div key={quote.symbol}>
                  <MarketRow
                    symbol={quote.symbol}
                    name={STOCK_CATALOG[quote.symbol]}
                    price={quote.price}
                    changePercent={quote.changePercent}
                    spark={quote.spark ?? undefined}
                    showName={showName}
                    showSpark={showSpark}
                    format={formatPrice}
                  />
                  {i < quotes.length - (useGrid ? 2 : 1) && (
                    <div className="h-px" style={{ background: 'var(--border-card)' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </WidgetShell>
    </div>
  );
}
