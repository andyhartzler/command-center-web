'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CryptoConfig, WidgetStyle } from '@/types/widget';

interface CoinData {
  id: string;
  name: string;
  price: number;
  change24h: number;
}

const COIN_SYMBOLS: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', dogecoin: 'DOGE',
  cardano: 'ADA', polkadot: 'DOT', avalanche: 'AVAX', chainlink: 'LINK',
  polygon: 'MATIC', litecoin: 'LTC', ripple: 'XRP', tron: 'TRX',
};

const COIN_NAMES: Record<string, string> = {
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana', dogecoin: 'Dogecoin', cardano: 'Cardano',
};

interface CryptoWidgetProps {
  config: CryptoConfig;
  style: WidgetStyle;
}

function formatPrice(p: number): string {
  if (p >= 1000) return `$${Math.round(p).toLocaleString()}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

export function CryptoWidget({ config }: CryptoWidgetProps) {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 200, h: 160 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchCrypto = useCallback(async () => {
    try {
      const coinIds = config.coins.join(',');
      const res = await fetch(`/api/crypto?coins=${coinIds}`);
      if (!res.ok) return;
      const data: CoinData[] = await res.json();
      if (Array.isArray(data)) setCoins(data);
    } catch (err) {
      console.error('[CryptoWidget] fetch error', err);
    }
  }, [config.coins]);

  useEffect(() => {
    fetchCrypto();
    const interval = setInterval(fetchCrypto, 60_000);
    return () => clearInterval(interval);
  }, [fetchCrypto]);

  if (coins.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  const scale = Math.min(dims.w / 220, dims.h / 160);
  const isCompact = dims.h < 160;
  const padding = Math.max(6, Math.min(16, 12 * scale));
  const rowPy = Math.max(3, Math.min(8, 7 * scale));

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col overflow-hidden" style={{ padding }}>
      {!isCompact && (
        <div
          className="font-bold text-white/30 uppercase shrink-0"
          style={{ letterSpacing: '4px', fontSize: `${Math.max(8, 10 * scale)}px`, marginBottom: `${Math.max(4, 8 * scale)}px` }}
        >
          Crypto
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
        <div className="flex flex-col">
          {coins.map((coin, i) => {
            const isUp = coin.change24h >= 0;
            const ArrowIcon = isUp ? ArrowUpRight : ArrowDownRight;
            const ticker = COIN_SYMBOLS[coin.id] || coin.id.toUpperCase().slice(0, 4);
            const name = COIN_NAMES[coin.id] || coin.name || coin.id.charAt(0).toUpperCase() + coin.id.slice(1);

            return (
              <div key={coin.id}>
                <div className="flex items-center gap-2" style={{ paddingTop: `${rowPy}px`, paddingBottom: `${rowPy}px` }}>
                  <span className="font-bold text-white/50" style={{ fontSize: `${Math.max(10, 12 * scale)}px`, width: `${Math.max(30, 36 * scale)}px` }}>
                    {ticker}
                  </span>
                  {dims.w > 180 && (
                    <span className="text-white/60 truncate" style={{ fontSize: `${Math.max(9, 11 * scale)}px` }}>
                      {name}
                    </span>
                  )}
                  <div className="flex-1" />
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-light text-white/85 tabular-nums" style={{ fontSize: `${Math.max(10, 13 * scale)}px` }}>
                      {formatPrice(coin.price)}
                    </span>
                    <div className={`flex items-center gap-0.5 ${isUp ? 'text-green-500/80' : 'text-red-500/80'}`}>
                      <ArrowIcon size={Math.max(7, 8 * scale)} strokeWidth={3} />
                      <span className="font-medium tabular-nums" style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}>
                        {Math.abs(coin.change24h).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                {i < coins.length - 1 && <div className="h-px bg-white/[0.04]" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
