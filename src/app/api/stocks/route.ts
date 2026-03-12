import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get('symbols') || 'SPY,QQQ,AAPL';
  const apiKey = process.env.TWELVE_DATA_KEY || 'demo';

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 30 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Twelve Data API returned ${res.status}` },
        { status: res.status },
      );
    }

    const raw = await res.json();

    // Twelve Data returns a single object when one symbol is requested,
    // or an object keyed by symbol when multiple are requested.
    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
    let parsed: { symbol: string; price: number; changePercent: number }[];

    if (symbolList.length === 1) {
      // single symbol response is a flat object
      const d = raw;
      parsed = [
        {
          symbol: d.symbol ?? symbolList[0],
          price: parseFloat(d.close) || 0,
          changePercent: parseFloat(d.percent_change) || 0,
        },
      ];
    } else {
      // multiple symbols: response is keyed by symbol name
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
  } catch (err) {
    console.error('[stocks] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
