import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const woeid = searchParams.get('woeid') || '1';
  
  try {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      // Return mock data if no key is configured
      return NextResponse.json({
        trends: [
          { name: '#NextJS', tweet_volume: 120000 },
          { name: '#React', tweet_volume: 85000 },
          { name: 'Kansas City', tweet_volume: 45000 },
          { name: 'TypeScript', tweet_volume: 32000 },
          { name: 'Vercel', tweet_volume: null }
        ]
      });
    }

    const res = await fetch(`https://api.twitter.com/1.1/trends/place.json?id=${woeid}`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });

    if (!res.ok) throw new Error('Twitter API failed');
    
    const data = await res.json();
    const trends = data[0]?.trends || [];

    return NextResponse.json({ trends });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch trending topics' }, { status: 500 });
  }
}
