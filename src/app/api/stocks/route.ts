import { NextRequest, NextResponse } from 'next/server';

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  shortName?: string;
}

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get('symbols') || 'SPY,QQQ,AAPL';
  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());

  try {
    // Use Yahoo Finance v8 quote endpoint (no API key needed)
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbolList.join(',')}&range=1d&interval=5m`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const data = await res.json();
      const results = symbolList.map(sym => {
        const spark = data.spark?.result?.find((r: { symbol: string }) => r.symbol === sym);
        const meta = spark?.response?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice ?? 0;
          const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
          const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
          return { symbol: sym, price, changePercent };
        }
        return { symbol: sym, price: 0, changePercent: 0 };
      });

      // If we got valid data, return it
      if (results.some(r => r.price > 0)) {
        return NextResponse.json(results);
      }
    }

    // Fallback: try Yahoo v7 quote endpoint
    const v7Url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolList.join(',')}`;
    const v7Res = await fetch(v7Url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 30 },
    });

    if (v7Res.ok) {
      const v7Data = await v7Res.json();
      const quotes: YahooQuote[] = v7Data.quoteResponse?.result ?? [];
      const results = symbolList.map(sym => {
        const q = quotes.find(qq => qq.symbol === sym);
        return {
          symbol: sym,
          price: q?.regularMarketPrice ?? 0,
          changePercent: q?.regularMarketChangePercent ?? 0,
        };
      });
      if (results.some(r => r.price > 0)) {
        return NextResponse.json(results);
      }
    }

    // Fallback 2: try Twelve Data if key is set
    const apiKey = process.env.TWELVE_DATA_KEY;
    if (apiKey && apiKey !== 'demo') {
      const tdUrl = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${apiKey}`;
      const tdRes = await fetch(tdUrl, { next: { revalidate: 30 } });
      if (tdRes.ok) {
        const raw = await tdRes.json();
        let parsed: { symbol: string; price: number; changePercent: number }[];
        if (symbolList.length === 1) {
          parsed = [{
            symbol: raw.symbol ?? symbolList[0],
            price: parseFloat(raw.close) || 0,
            changePercent: parseFloat(raw.percent_change) || 0,
          }];
        } else {
          parsed = symbolList.map(sym => {
            const d = raw[sym] || {};
            return {
              symbol: d.symbol ?? sym,
              price: parseFloat(d.close) || 0,
              changePercent: parseFloat(d.percent_change) || 0,
            };
          });
        }
        return NextResponse.json(parsed);
      }
    }

    // If all fail, return zeros with error indication
    return NextResponse.json(
      symbolList.map(sym => ({ symbol: sym, price: 0, changePercent: 0 }))
    );
  } catch (err) {
    console.error('[stocks] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
