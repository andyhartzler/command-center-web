'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Droplet } from 'lucide-react';

interface TickerData {
  symbol: string;
  price: number;
  change: number;
}

// Defense sector + commodity tickers
const DEFENSE_TICKERS = ['RTX', 'LMT', 'NOC', 'GD', 'BA', 'PLTR'];

export function GlobalMarketsTicker() {
  const [stocks, setStocks] = useState<TickerData[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks');
        if (!res.ok) return;
        const data = await res.json();
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
    const id = setInterval(fetchStocks, 300_000);
    return () => clearInterval(id);
  }, []);

  if (stocks.length === 0) return null;

  // Sort: put defense tickers first
  const sorted = [...stocks].sort((a, b) => {
    const aDef = DEFENSE_TICKERS.includes(a.symbol) ? -1 : 0;
    const bDef = DEFENSE_TICKERS.includes(b.symbol) ? -1 : 0;
    return aDef - bDef;
  });

  return (
    <div className="flex items-center gap-3 overflow-x-auto pointer-events-auto">
      {sorted.slice(0, expanded ? 20 : 8).map(s => (
        <div key={s.symbol} className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-mono ${
            DEFENSE_TICKERS.includes(s.symbol) ? 'text-cyan-400/60' : 'text-white/40'
          }`}>{s.symbol}</span>
          <span className="text-[9px] font-mono text-white/60">${s.price.toFixed(2)}</span>
          <span className={`text-[8px] font-mono flex items-center gap-0.5 ${
            s.change >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {s.change >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
            {Math.abs(s.change).toFixed(2)}%
          </span>
        </div>
      ))}
      {stocks.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/20 hover:text-white/40 transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
        </button>
      )}
    </div>
  );
}
