import { NextRequest, NextResponse } from 'next/server';

interface FAAStatus {
  airport: string;
  delay: boolean;
  delayType: string | null;
  avgDelay: string | null;
  reason: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const airportsParam = searchParams.get('airports');

  if (!airportsParam) {
    return NextResponse.json({ error: 'airports query param required' }, { status: 400 });
  }

  const codes = airportsParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);

  if (codes.length === 0) {
    return NextResponse.json({ error: 'No valid airport codes provided' }, { status: 400 });
  }

  try {
    const results: FAAStatus[] = await Promise.all(
      codes.map(async (code): Promise<FAAStatus> => {
        try {
          const res = await fetch(
            `https://nasstatus.faa.gov/api/airport-status-information/${code}`,
            {
              next: { revalidate: 120 },
              headers: { 'Accept': 'application/json' },
            },
          );

          if (!res.ok) {
            return { airport: code, delay: false, delayType: null, avgDelay: null, reason: null };
          }

          const data = await res.json();

          // FAA API returns an array of delay programs or empty
          const hasDelay = Array.isArray(data) && data.length > 0;
          let delayType: string | null = null;
          let avgDelay: string | null = null;
          let reason: string | null = null;

          if (hasDelay) {
            const first = data[0];
            delayType = first.type || first.program || 'Delay';
            avgDelay = first.averageDelay || first.avg || null;
            reason = first.reason || null;
          }

          return { airport: code, delay: hasDelay, delayType, avgDelay, reason };
        } catch {
          return { airport: code, delay: false, delayType: null, avgDelay: null, reason: null };
        }
      }),
    );

    return NextResponse.json({ airports: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch FAA delays' },
      { status: 500 },
    );
  }
}
