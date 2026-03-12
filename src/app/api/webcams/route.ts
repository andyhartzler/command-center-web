import { NextRequest, NextResponse } from 'next/server';

// KC Scout API types matching the actual response shape
interface KCScoutCameraEntity {
  ID?: string;
  OnStreetName?: string;
  Latitude?: number;
  Longitude?: number;
  AtStreetName?: string;
  Direction?: string;
}

interface CameraResult {
  id: string;
  name: string;
  streamFile: string;
  corridor: string;
  latitude: number;
  longitude: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const file = searchParams.get('file');

  try {
    if (action === 'stream' && file) {
      return await getStreamUrl(file);
    }

    return await listCameras();
  } catch (error) {
    console.error('Webcam API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webcam data' },
      { status: 500 }
    );
  }
}

async function listCameras(): Promise<NextResponse> {
  const response = await fetch(
    'https://www.kcscout.net/DataProvider.asmx/LoadEntities',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    // Fall back to default cameras if API is down
    return NextResponse.json({ cameras: DEFAULT_CAMERAS });
  }

  const data = await response.json();

  // KC Scout API structure: { d: { Camera: [...], ... } }
  // The "d" wrapper contains entity categories (Camera, DMS, etc.)
  const wrapper = data.d || data;
  let cameraEntities: KCScoutCameraEntity[] = [];

  if (wrapper && typeof wrapper === 'object') {
    // Try the Camera key first (matches Swift implementation)
    if (Array.isArray(wrapper.Camera)) {
      cameraEntities = wrapper.Camera;
    } else if (Array.isArray(wrapper)) {
      // Fallback: might be a flat array
      cameraEntities = wrapper;
    }
  }

  if (cameraEntities.length === 0) {
    // Fall back to defaults
    return NextResponse.json({ cameras: DEFAULT_CAMERAS });
  }

  const cameras: CameraResult[] = cameraEntities
    .filter((entity) => entity.ID)
    .map((entity) => {
      const id = String(entity.ID || '');
      const name = String(entity.OnStreetName || entity.AtStreetName || 'Camera');
      const streamFile = `customInstance/${id}-LQ.stream`;
      return {
        id,
        name,
        streamFile,
        corridor: id, // corridor prefix is the camera ID prefix
        latitude: Number(entity.Latitude || 0),
        longitude: Number(entity.Longitude || 0),
      };
    });

  return NextResponse.json({ cameras });
}

async function getStreamUrl(streamFile: string): Promise<NextResponse> {
  const response = await fetch(
    'https://www.kcscout.net/DataProvider.asmx/GetVideoParams',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({ file: streamFile }),
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: `KC Scout video params returned ${response.status}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  const token = data.d || data;

  if (!token || typeof token !== 'string') {
    return NextResponse.json(
      { error: 'No stream token returned' },
      { status: 502 }
    );
  }

  const streamUrl = `https://5fca316e7c40f.streamlock.net/live-secure/${streamFile}/playlist.m3u8?${token}`;

  return NextResponse.json({ streamUrl, streamFile, token });
}

// Default camera set matching Swift KCScoutCamera.defaults
const DEFAULT_CAMERAS: CameraResult[] = [
  { id: 'M070WBIPC-11', name: 'I-70 WB at 18th St', streamFile: 'customInstance/M070WBIPC-11-LQ.stream', corridor: 'M070', latitude: 39.099, longitude: -94.578 },
  { id: 'M070WBC-09', name: 'I-70 WB at Prospect Ave', streamFile: 'customInstance/M070WBC-09-LQ.stream', corridor: 'M070', latitude: 39.098, longitude: -94.548 },
  { id: 'M670WBC-01', name: 'I-670 WB at Baltimore', streamFile: 'customInstance/M670WBC-01-LQ.stream', corridor: 'M670', latitude: 39.098, longitude: -94.582 },
  { id: 'M035SBC-01', name: 'I-35 SB at Cambridge Cir', streamFile: 'customInstance/M035SBC-01-LQ.stream', corridor: 'M035', latitude: 39.076, longitude: -94.614 },
  { id: 'M070EBC-08', name: 'I-70 EB at Van Brunt', streamFile: 'customInstance/M070EBC-08-LQ.stream', corridor: 'M070', latitude: 39.099, longitude: -94.531 },
  { id: 'M070EBC-05', name: 'I-70 EB at The Paseo', streamFile: 'customInstance/M070EBC-05-LQ.stream', corridor: 'M070', latitude: 39.099, longitude: -94.555 },
  { id: 'M435NBC-28', name: 'I-435 NB at State Line', streamFile: 'customInstance/M435NBC-28-LQ.stream', corridor: 'M435', latitude: 38.933, longitude: -94.607 },
  { id: 'M435WBC-08', name: 'I-435 WB at I-70', streamFile: 'customInstance/M435WBC-08-LQ.stream', corridor: 'M435', latitude: 39.133, longitude: -94.519 },
  { id: 'M035NBC-06', name: 'I-35 NB at Southwest Blvd', streamFile: 'customInstance/M035NBC-06-LQ.stream', corridor: 'M035', latitude: 39.061, longitude: -94.599 },
  { id: 'M071NBC-01', name: 'US-71 NB at 63rd St', streamFile: 'customInstance/M071NBC-01-LQ.stream', corridor: 'M071', latitude: 38.981, longitude: -94.574 },
  { id: 'M670WBC-03', name: 'I-670 WB at Broadway', streamFile: 'customInstance/M670WBC-03-LQ.stream', corridor: 'M670', latitude: 39.099, longitude: -94.586 },
  { id: 'M029NBC-05', name: 'I-29 NB at I-635', streamFile: 'customInstance/M029NBC-05-LQ.stream', corridor: 'M029', latitude: 39.125, longitude: -94.675 },
  { id: 'K070WBC-01', name: 'I-70 WB at Lewis & Clark', streamFile: 'customInstance/K070WBC-01-LQ.stream', corridor: 'K070', latitude: 39.110, longitude: -94.610 },
  { id: 'K035NBC-16', name: 'I-35 NB at 7th St', streamFile: 'customInstance/K035NBC-16-LQ.stream', corridor: 'K035', latitude: 39.067, longitude: -94.620 },
  { id: 'K635NBC-01', name: 'I-635 NB at Parallel Pkwy', streamFile: 'customInstance/K635NBC-01-LQ.stream', corridor: 'K635', latitude: 39.119, longitude: -94.760 },
  { id: 'M470EBC-01', name: 'I-470 EB at View High Dr', streamFile: 'customInstance/M470EBC-01-LQ.stream', corridor: 'M470', latitude: 38.888, longitude: -94.540 },
];
