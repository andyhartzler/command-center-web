import { NextRequest, NextResponse } from 'next/server';

export interface CoinQuote {
  id: string;
  name: string;
  price: number | null;
  change24h: number | null;
  /** 7d hourly price series for the sparkline, oldest first */
  spark: number[] | null;
}

const SPARK_POINTS = 40;

interface MarketsCoin {
  id: string;
  name?: string;
  current_price?: number;
  price_change_percentage_24h?: number;
  sparkline_in_7d?: { price?: number[] };
}

/** Drop bad values and downsample the 7d series to a fixed budget. */
function toSpark(prices: unknown): number[] | null {
  if (!Array.isArray(prices)) return null;
  const clean = prices.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (clean.length < 2) return null;
  if (clean.length <= SPARK_POINTS) return clean;
  const out: number[] = [];
  for (let i = 0; i < SPARK_POINTS; i++) {
    out.push(clean[Math.round((i / (SPARK_POINTS - 1)) * (clean.length - 1))]);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const coins = request.nextUrl.searchParams.get('coins') || 'bitcoin,ethereum';
  const wantSparkline = request.nextUrl.searchParams.get('sparkline') === 'true';

  try {
    // Primary: coins/markets carries sparkline_in_7d when requested
    const marketsUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coins}&order=market_cap_desc&per_page=250&sparkline=${wantSparkline}&price_change_percentage=24h`;
    const marketsRes = await fetch(marketsUrl, { next: { revalidate: 60 } });

    if (marketsRes.ok) {
      const raw: MarketsCoin[] = await marketsRes.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const parsed: CoinQuote[] = raw.map(c => ({
          id: c.id,
          name: c.name ?? c.id.charAt(0).toUpperCase() + c.id.slice(1),
          price: typeof c.current_price === 'number' ? c.current_price : null,
          change24h: typeof c.price_change_percentage_24h === 'number' ? c.price_change_percentage_24h : null,
          spark: wantSparkline ? toSpark(c.sparkline_in_7d?.price) : null,
        }));
        return NextResponse.json(parsed);
      }
    }

    // Fallback: simple/price (no sparkline series available)
    const simpleUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd&include_24hr_change=true`;
    const simpleRes = await fetch(simpleUrl, { next: { revalidate: 60 } });

    if (!simpleRes.ok) {
      return NextResponse.json(
        { error: `CoinGecko API returned ${simpleRes.status}` },
        { status: simpleRes.status },
      );
    }

    const raw: Record<string, { usd?: number; usd_24h_change?: number }> = await simpleRes.json();

    const parsed: CoinQuote[] = Object.entries(raw).map(([id, data]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      price: typeof data.usd === 'number' ? data.usd : null,
      change24h: typeof data.usd_24h_change === 'number' ? data.usd_24h_change : null,
      spark: null,
    }));

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[crypto] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch crypto data' }, { status: 500 });
  }
}
