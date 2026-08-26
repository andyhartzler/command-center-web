import { NextRequest, NextResponse } from 'next/server';

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  shortName?: string;
}

export interface StockQuote {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  /** 1d/5m close series for the sparkline, oldest first */
  spark: number[] | null;
}

const SPARK_POINTS = 40;
// Yahoo's spark endpoint rejects requests with more than ~20 symbols (HTTP 400),
// so fetch in small chunks and merge; the whole S&P 500 loads fine this way.
const CHUNK = 20;

/** Drop nulls and downsample the intraday close series to a fixed budget. */
function toSpark(closes: unknown): number[] | null {
  if (!Array.isArray(closes)) return null;
  const clean = closes.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (clean.length < 2) return null;
  if (clean.length <= SPARK_POINTS) return clean;
  const out: number[] = [];
  for (let i = 0; i < SPARK_POINTS; i++) {
    out.push(clean[Math.round((i / (SPARK_POINTS - 1)) * (clean.length - 1))]);
  }
  return out;
}

function chunkList<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Catalog keys use '_' for class shares (BRK_B, BF_B); Yahoo expects '-'.
const toYahoo = (sym: string) => sym.replace(/_/g, '-');

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseSpark(data: any, sym: string): StockQuote {
  const y = toYahoo(sym);
  // New format: data[SYMBOL] = { close: [...], previousClose, chartPreviousClose }
  const symData = data?.[y];
  if (symData && Array.isArray(symData.close) && symData.close.length > 0) {
    const spark = toSpark(symData.close);
    const price = spark?.[spark.length - 1] ?? symData.close[symData.close.length - 1] ?? null;
    const prevClose = symData.previousClose ?? symData.chartPreviousClose ?? null;
    const changePercent = price !== null && typeof prevClose === 'number' && prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : null;
    return { symbol: sym, price, changePercent, spark };
  }
  // Market closed / no intraday bars: fall back to the last close so the tile
  // still shows a price (nights, weekends, holidays) instead of "--".
  if (symData) {
    const prev = symData.previousClose ?? symData.chartPreviousClose;
    if (typeof prev === 'number' && prev > 0) {
      return { symbol: sym, price: prev, changePercent: null, spark: null };
    }
  }
  // Legacy format: data.spark.result[].response[0].meta
  const legacy = data?.spark?.result?.find((r: { symbol: string }) => r.symbol === y);
  const response = legacy?.response?.[0];
  const meta = response?.meta;
  if (meta) {
    const price = meta.regularMarketPrice ?? null;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const changePercent = typeof price === 'number' && typeof prevClose === 'number' && prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : null;
    return { symbol: sym, price, changePercent, spark: toSpark(response?.indicators?.quote?.[0]?.close) };
  }
  return { symbol: sym, price: null, changePercent: null, spark: null };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get('symbols') || 'SPY,QQQ,AAPL';
  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
  const chunks = chunkList(symbolList, CHUNK);
  const none = (): StockQuote[] =>
    symbolList.map(sym => ({ symbol: sym, price: null, changePercent: null, spark: null }));

  try {
    // Primary: Yahoo v8 spark endpoint, batched (no API key needed).
    const bySymbol = new Map<string, StockQuote>();
    await Promise.all(chunks.map(async chunk => {
      const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${chunk.map(toYahoo).join(',')}&range=1d&interval=5m`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 30 } });
        if (!res.ok) return;
        const data = await res.json();
        for (const sym of chunk) bySymbol.set(sym, parseSpark(data, sym));
      } catch { /* skip this chunk, others still populate */ }
    }));
    if (bySymbol.size > 0) {
      const results = symbolList.map(sym => bySymbol.get(sym) ?? { symbol: sym, price: null, changePercent: null, spark: null });
      if (results.some(r => r.price !== null && r.price > 0)) {
        return NextResponse.json(results);
      }
    }

    // Fallback: Yahoo v7 quote endpoint, batched (no spark series available).
    const v7Map = new Map<string, StockQuote>();
    await Promise.all(chunks.map(async chunk => {
      const v7Url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${chunk.map(toYahoo).join(',')}`;
      try {
        const v7Res = await fetch(v7Url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 30 } });
        if (!v7Res.ok) return;
        const v7Data = await v7Res.json();
        const quotes: YahooQuote[] = v7Data.quoteResponse?.result ?? [];
        for (const sym of chunk) {
          const q = quotes.find(qq => qq.symbol === toYahoo(sym));
          v7Map.set(sym, {
            symbol: sym,
            price: q?.regularMarketPrice ?? null,
            changePercent: q?.regularMarketChangePercent ?? null,
            spark: null,
          });
        }
      } catch { /* skip */ }
    }));
    if (v7Map.size > 0) {
      const results = symbolList.map(sym => v7Map.get(sym) ?? { symbol: sym, price: null, changePercent: null, spark: null });
      if (results.some(r => r.price !== null && r.price > 0)) {
        return NextResponse.json(results);
      }
    }

    // Fallback 2: Twelve Data if a key is set (no spark series available).
    const apiKey = process.env.TWELVE_DATA_KEY;
    if (apiKey && apiKey !== 'demo') {
      const tdUrl = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${apiKey}`;
      const tdRes = await fetch(tdUrl, { next: { revalidate: 30 } });
      if (tdRes.ok) {
        const raw = await tdRes.json();
        let parsed: StockQuote[];
        if (symbolList.length === 1) {
          parsed = [{
            symbol: raw.symbol ?? symbolList[0],
            price: parseFloat(raw.close) || null,
            changePercent: parseFloat(raw.percent_change) || null,
            spark: null,
          }];
        } else {
          parsed = symbolList.map(sym => {
            const d = raw[sym] || {};
            return {
              symbol: d.symbol ?? sym,
              price: parseFloat(d.close) || null,
              changePercent: parseFloat(d.percent_change) || null,
              spark: null,
            };
          });
        }
        return NextResponse.json(parsed);
      }
    }

    // All sources failed: explicit no-data rows.
    return NextResponse.json(none());
  } catch (err) {
    console.error('[stocks] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
