import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bridgeIp = searchParams.get('bridgeIp');
  const applicationKey = searchParams.get('applicationKey');

  if (!bridgeIp || !applicationKey) {
    return NextResponse.json({ error: 'Missing Hue Bridge credentials' }, { status: 400 });
  }

  try {
    // In a real environment with local network access to the Hue Bridge:
    // const res = await fetch(`http://${bridgeIp}/api/${applicationKey}/lights`);
    // const data = await res.json();
    
    // Mock response for the widget UI
    const mockLights = {
      "1": { state: { on: true, bri: 254, hue: 10000, sat: 254 }, name: "Living Room 1" },
      "2": { state: { on: false, bri: 100, hue: 40000, sat: 100 }, name: "Bedroom" },
      "3": { state: { on: true, bri: 200, hue: 5000, sat: 200 }, name: "Office" },
    };

    return NextResponse.json(mockLights);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Hue lights' }, { status: 500 });
  }
}
