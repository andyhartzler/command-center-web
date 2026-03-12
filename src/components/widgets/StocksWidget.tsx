'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { StocksConfig, WidgetStyle } from '@/types/widget';

interface StockData {
  symbol: string;
  price: number;
  changePercent: number;
}

interface StocksWidgetProps {
  config: StocksConfig;
  style: WidgetStyle;
}

function formatPrice(price: number): string {
  if (price >= 10000) return `$${Math.round(price).toLocaleString()}`;
  if (price >= 1000) return `$${Math.round(price).toLocaleString()}`;
  return `$${price.toFixed(2)}`;
}

export function StocksWidget({ config }: StocksWidgetProps) {
  const [stocks, setStocks] = useState<StockData[]>([]);

  const fetchStocks = useCallback(async () => {
    try {
      const symbols = config.symbols.join(',');
      const res = await fetch(`/api/stocks?symbols=${symbols}`);
      if (!res.ok) return;
      const data: StockData[] = await res.json();
      if (Array.isArray(data)) {
        setStocks(data);
      }
    } catch (err) {
      console.error('[StocksWidget] fetch error', err);
    }
  }, [config.symbols]);

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60_000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  if (stocks.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden">
      {/* Header - matches Swift: MARKETS with tracking */}
      <div
        className="text-[10px] font-bold text-white/30 uppercase mb-3.5"
        style={{ letterSpacing: '4px' }}
      >
        Markets
      </div>

      {/* Stock list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="flex flex-col">
          {stocks.map((stock, i) => {
            const isUp = stock.changePercent >= 0;
            const ArrowIcon = isUp ? ArrowUpRight : ArrowDownRight;

            return (
              <div key={stock.symbol}>
                <div className="flex items-center py-2">
                  {/* Symbol */}
                  <span className="text-[13px] font-medium text-white/70 w-[50px]">
                    {stock.symbol}
                  </span>

                  <div className="flex-1" />

                  {/* Price */}
                  <span className="text-sm font-light text-white/60 tabular-nums">
                    {formatPrice(stock.price)}
                  </span>

                  {/* Change */}
                  <div
                    className={`flex items-center gap-0.5 w-[60px] justify-end ${
                      isUp ? 'text-green-500/80' : 'text-red-500/80'
                    }`}
                  >
                    <ArrowIcon size={8} strokeWidth={3} />
                    <span className="text-[11px] font-medium tabular-nums">
                      {Math.abs(stock.changePercent).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Divider */}
                {i < stocks.length - 1 && (
                  <div className="h-px bg-white/[0.04]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
