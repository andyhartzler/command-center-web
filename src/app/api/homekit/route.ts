import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // In a real scenario, this would use process.env.HOME_ASSISTANT_TOKEN
  // and fetch from http://192.168.4.32:8123/api/states
  
  // Returning mock data for now so the UI can be built and tested
  const mockDevices = [
    { entity_id: 'fan.dyson', state: 'on', attributes: { friendly_name: 'Dyson Purifier' } },
    { entity_id: 'fan.molekule', state: 'off', attributes: { friendly_name: 'Molekule Air' } },
    { entity_id: 'media_player.samsung_tv', state: 'playing', attributes: { friendly_name: 'Living Room TV' } },
    { entity_id: 'sensor.leafypod', state: 'healthy', attributes: { friendly_name: 'Leafypod' } },
    { entity_id: 'vacuum.litter_robot', state: 'docked', attributes: { friendly_name: 'Litter-Robot' } },
  ];

  return NextResponse.json(mockDevices);
}
