'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerData {
  symbol: string;
  price: number;
  change: number;
}

// Use existing stocks API from the command center
export function GlobalMarketsTicker() {
  const [stocks, setStocks] = useState<TickerData[]>([]);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks');
        if (!res.ok) return;
        const data = await res.json();
        // The existing stocks API returns different formats depending on implementation
        if (Array.isArray(data)) {
          setStocks(data.map((s: any) => ({
            symbol: s.symbol || s.ticker,
            price: s.price || s.regularMarketPrice || 0,
            change: s.changePercent || s.regularMarketChangePercent || 0,
          })));
        } else if (data.stocks) {
          setStocks(Object.entries(data.stocks).map(([sym, val]: [string, any]) => ({
            symbol: sym,
            price: val.price || 0,
            change: val.change_percent || val.changePercent || 0,
          })));
        }
      } catch {}
    };

    fetchStocks();
    const id = setInterval(fetchStocks, 300_000); // 5 minutes
    return () => clearInterval(id);
  }, []);

  // Defense sector tickers to show even if API doesn't return data
  const DEFENSE_TICKERS = ['RTX', 'LMT', 'NOC', 'GD', 'BA', 'PLTR'];

  if (stocks.length === 0) return null;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pointer-events-auto">
      {stocks.slice(0, 8).map(s => (
        <div key={s.symbol} className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono text-white/40">{s.symbol}</span>
          <span className="text-[9px] font-mono text-white/60">${s.price.toFixed(2)}</span>
          <span className={`text-[8px] font-mono flex items-center gap-0.5 ${
            s.change >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {s.change >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
            {Math.abs(s.change).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
