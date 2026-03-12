import { NextRequest, NextResponse } from 'next/server';

interface PolymarketOutcome {
  outcomePrices?: string;
  outcomes?: string;
}

interface PolymarketEvent {
  id?: string;
  title?: string;
  slug?: string;
  markets?: PolymarketOutcome[];
  volume24hr?: number;
}

export interface NormalizedPrediction {
  id: string;
  title: string;
  outcomes: { name: string; probability: number }[];
  volume24hr: number;
}

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get('limit') || '8';

  try {
    const url = `https://gamma-api.polymarket.com/events?closed=false&order=volume24hr&ascending=false&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Polymarket API returned ${res.status}` },
        { status: res.status },
      );
    }

    const events: PolymarketEvent[] = await res.json();

    const parsed: NormalizedPrediction[] = events.map((event) => {
      const market = event.markets?.[0];
      let outcomes: { name: string; probability: number }[] = [];

      if (market) {
        try {
          const names: string[] = typeof market.outcomes === 'string'
            ? JSON.parse(market.outcomes)
            : (market.outcomes as unknown as string[]) || [];
          const prices: string[] = typeof market.outcomePrices === 'string'
            ? JSON.parse(market.outcomePrices)
            : (market.outcomePrices as unknown as string[]) || [];

          outcomes = names.map((name, i) => ({
            name,
            probability: Math.round((parseFloat(prices[i]) || 0) * 100),
          }));
        } catch {
          // parsing failed, leave outcomes empty
        }
      }

      return {
        id: event.id || '',
        title: event.title || '',
        outcomes,
        volume24hr: event.volume24hr || 0,
      };
    });

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[predictions] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch prediction data' }, { status: 500 });
  }
}
