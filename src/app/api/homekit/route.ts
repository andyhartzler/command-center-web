import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const token = process.env.HOME_ASSISTANT_TOKEN;
  const baseUrl = process.env.HOME_ASSISTANT_URL || 'http://192.168.4.32:8123';

  if (!token) {
    // Never fabricate device states: without a Home Assistant token the
    // widget renders its not-connected state instead of fake devices.
    return NextResponse.json(
      { error: 'HOME_ASSISTANT_TOKEN not configured', configured: false },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${baseUrl}/api/states`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 10 } // Cache for 10 seconds
    });

    if (!res.ok) {
      throw new Error(`Home Assistant error: ${res.status}`);
    }

    const allEntities = await res.json();
    
    // Filter for interesting entities (fans, media players, vacuums, sensors, locks, lights)
    const filtered = allEntities.filter((e: any) => 
      e.entity_id.startsWith('fan.') ||
      e.entity_id.startsWith('media_player.') ||
      e.entity_id.startsWith('vacuum.') ||
      e.entity_id.startsWith('sensor.leafypod') || // Specifically for leafypod
      e.entity_id.startsWith('lock.') ||
      e.entity_id.startsWith('light.') ||
      e.entity_id.startsWith('switch.')
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('[HomeKit/HA API Error]:', error);
    return NextResponse.json({ error: 'Failed to connect to Home Assistant' }, { status: 500 });
  }
}
