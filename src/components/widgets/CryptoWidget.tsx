'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bitcoin } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { MarketRow } from './market/MarketRow';
import { COIN_NAMES, COIN_SYMBOLS } from '@/data/marketCatalogs';
import type { CryptoConfig, WidgetStyle } from '@/types/widget';

// Re-exported so existing catalog consumers (WidgetConfigPanel) keep working.
export { COIN_CATALOG } from '@/data/marketCatalogs';

const POLL_INTERVAL = 60_000;

interface CoinQuote {
  id: string;
  name: string;
  price: number | null;
  change24h: number | null;
  spark: number[] | null;
}

interface CryptoWidgetProps {
  config: CryptoConfig;
  style: WidgetStyle;
}

function formatPrice(p: number): string {
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${p.toFixed(4)}`;
}

export function CryptoWidget({ config, style }: CryptoWidgetProps) {
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

  const coinIds = useMemo(
    () => config.coins.map(c => c.trim()).filter(c => c.length > 0),
    [config.coins],
  );
  const url = coinIds.length > 0
    ? `/api/crypto?coins=${coinIds.join(',')}&sparkline=true`
    : null;
  const { data, phase, isStale, lastUpdated } = usePolledData<CoinQuote[]>(url, {
    interval: POLL_INTERVAL,
  });

  const quotes = useMemo(() => {
    const byId = new Map((Array.isArray(data) ? data : []).map(q => [q.id, q]));
    return coinIds.map(id =>
      byId.get(id) ?? { id, name: id.charAt(0).toUpperCase() + id.slice(1), price: null, change24h: null, spark: null },
    );
  }, [data, coinIds]);

  const useGrid = width > 380 && quotes.length > 4;
  const colWidth = useGrid ? (width - 24) / 2 : width;
  const showSpark = colWidth >= 250;
  const showName = colWidth >= 200;

  return (
    <div className="w-full h-full" style={{ opacity: style.opacity }}>
      <WidgetShell
        icon={<Bitcoin size={18} />}
        title="Crypto"
        status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
        style={style}
      >
        <div ref={bodyRef} className="absolute inset-0 overflow-y-auto scrollbar-thin px-3.5 pb-3">
          {!data ? (
            <div className="w-full h-full flex items-center justify-center">
              {phase === 'error' ? (
                <span className="type-label">no crypto data</span>
              ) : (
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-surface-3)', borderTopColor: 'var(--color-text-3)' }}
                />
              )}
            </div>
          ) : (
            <div className={useGrid ? 'grid grid-cols-2 gap-x-6' : 'flex flex-col'}>
              {quotes.map((quote, i) => {
                const ticker = COIN_SYMBOLS[quote.id] || quote.id.toUpperCase().slice(0, 4);
                const name = COIN_NAMES[quote.id] || quote.name;
                return (
                  <div key={quote.id}>
                    <MarketRow
                      symbol={ticker}
                      name={name}
                      price={quote.price}
                      changePercent={quote.change24h}
                      spark={quote.spark ?? undefined}
                      showName={showName}
                      showSpark={showSpark}
                      format={formatPrice}
                    />
                    {i < quotes.length - (useGrid ? 2 : 1) && (
                      <div className="h-px" style={{ background: 'var(--border-card)' }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </WidgetShell>
    </div>
  );
}
