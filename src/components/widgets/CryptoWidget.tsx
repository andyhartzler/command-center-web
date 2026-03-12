'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CryptoConfig, WidgetStyle } from '@/types/widget';

interface CoinData {
  id: string;
  name: string;
  price: number;
  change24h: number;
}

const COIN_SYMBOLS: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  dogecoin: 'DOGE',
  cardano: 'ADA',
  polkadot: 'DOT',
  avalanche: 'AVAX',
  chainlink: 'LINK',
  polygon: 'MATIC',
  litecoin: 'LTC',
  ripple: 'XRP',
  tron: 'TRX',
};

const COIN_NAMES: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  solana: 'Solana',
  dogecoin: 'Dogecoin',
  cardano: 'Cardano',
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

  const fetchCrypto = useCallback(async () => {
    try {
      const coinIds = config.coins.join(',');
      const res = await fetch(`/api/crypto?coins=${coinIds}`);
      if (!res.ok) return;
      const data: CoinData[] = await res.json();
      if (Array.isArray(data)) {
        setCoins(data);
      }
    } catch (err) {
      console.error('[CryptoWidget] fetch error', err);
    }
  }, [config.coins]);

  useEffect(() => {
    fetchCrypto();
    const interval = setInterval(fetchCrypto, 60_000); // Match Swift: 60s
    return () => clearInterval(interval);
  }, [fetchCrypto]);

  if (coins.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden">
      {/* Header - matches Swift: CRYPTO with tracking */}
      <div
        className="text-[10px] font-bold text-white/30 uppercase mb-3"
        style={{ letterSpacing: '4px' }}
      >
        Crypto
      </div>

      {/* Coin list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="flex flex-col">
          {coins.map((coin, i) => {
            const isUp = coin.change24h >= 0;
            const ArrowIcon = isUp ? ArrowUpRight : ArrowDownRight;
            const ticker = COIN_SYMBOLS[coin.id] || coin.id.toUpperCase().slice(0, 4);
            const name = COIN_NAMES[coin.id] || coin.name || coin.id.charAt(0).toUpperCase() + coin.id.slice(1);

            return (
              <div key={coin.id}>
                <div className="flex items-center gap-2.5 py-[7px]">
                  {/* Symbol */}
                  <span className="text-xs font-bold text-white/50 w-[36px]">
                    {ticker}
                  </span>

                  {/* Name */}
                  <span className="text-xs text-white/60 truncate">
                    {name}
                  </span>

                  <div className="flex-1" />

                  {/* Price + Change */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[13px] font-light text-white/85 tabular-nums">
                      {formatPrice(coin.price)}
                    </span>
                    <div
                      className={`flex items-center gap-0.5 ${
                        isUp ? 'text-green-500/80' : 'text-red-500/80'
                      }`}
                    >
                      <ArrowIcon size={8} strokeWidth={3} />
                      <span className="text-[10px] font-medium tabular-nums">
                        {Math.abs(coin.change24h).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                {i < coins.length - 1 && (
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
