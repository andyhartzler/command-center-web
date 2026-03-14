'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Users, Loader2 } from 'lucide-react';
import { useAppleMap } from '@/hooks/useAppleMap';
import type { FindMyFriendsConfig, WidgetStyle } from '@/types/widget';

interface FriendLocation {
  handle: string;
  name: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  lastUpdated: number;
  status: string;
}

interface FindMyData {
  friends: FriendLocation[];
  avatars: Record<string, string>;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'live': return '#22c55e';
    case 'legacy': return '#eab308';
    default: return '#6b7280';
  }
}

interface Props {
  config: FindMyFriendsConfig;
  style: WidgetStyle;
}

export function FindMyFriendsWidget({ config, style: _style }: Props) {
  const [data, setData] = useState<FindMyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/findmy');
      if (!res.ok) throw new Error(`${res.status}`);
      const json: FindMyData = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, (config.refreshInterval || 180) * 1000);
    return () => clearInterval(interval);
  }, [fetchData, config.refreshInterval]);

  // ResizeObserver for container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter friends
  const friends = data?.friends.filter(f =>
    config.trackedHandles.length === 0 || config.trackedHandles.includes(f.handle)
  ) ?? [];

  const avatars = data?.avatars ?? {};

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <Loader2 size={20} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
        <MapPin size={20} className="text-white/15" />
        <p className="text-[10px] text-white/25 text-center">Find My unavailable</p>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
        <Users size={20} className="text-white/15" />
        <p className="text-[10px] text-white/25 text-center">No locations found</p>
      </div>
    );
  }

  const mode = config.displayMode || 'map';

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      {mode === 'map' && (
        <MapMode friends={friends} avatars={avatars} containerSize={containerSize} />
      )}
      {mode === 'pins' && (
        <PinsMode friends={friends} avatars={avatars} />
      )}
      {mode === 'list' && (
        <ListMode friends={friends} avatars={avatars} />
      )}
    </div>
  );
}

// --- Map Mode ---

function MapMode({ friends, avatars, containerSize }: {
  friends: FriendLocation[];
  avatars: Record<string, string>;
  containerSize: { w: number; h: number };
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const annotationsAdded = useRef(false);

  // Calculate center from friends
  const centerLat = friends.reduce((s, f) => s + f.lat, 0) / friends.length;
  const centerLng = friends.reduce((s, f) => s + f.lng, 0) / friends.length;

  const { map, isReady } = useAppleMap(mapContainerRef, {
    center: [centerLat, centerLng],
    zoom: 10,
    interactive: false,
  });

  // Add annotations when map is ready
  useEffect(() => {
    if (!isReady() || annotationsAdded.current) return;

    const m = map.current;
    if (!m) return;

    // Add custom annotations for each friend
    const annotations: mapkit.Annotation[] = [];
    for (const friend of friends) {
      const coord = new mapkit.Coordinate(friend.lat, friend.lng);
      const avatarUrl = avatars[friend.handle];
      const color = statusColor(friend.status);

      const annotation = new mapkit.Annotation(
        coord,
        () => {
          const el = document.createElement('div');
          el.style.cssText = 'position:relative;';

          if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.style.cssText = 'width:44px;height:44px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);object-fit:cover;';
            el.appendChild(img);
          } else {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `width:44px;height:44px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);background:#374151;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:600;`;
            placeholder.textContent = friend.name.charAt(0).toUpperCase();
            el.appendChild(placeholder);
          }

          // Status dot
          const dot = document.createElement('div');
          dot.style.cssText = `position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #1a1a1c;`;
          el.appendChild(dot);

          return el;
        },
        { anchorOffset: { x: 0, y: 0 } }
      );

      annotations.push(annotation);
    }

    m.addAnnotations(annotations);
    annotationsAdded.current = true;

    // Auto-zoom to fit all friends
    if (friends.length > 1) {
      const lats = friends.map(f => f.lat);
      const lngs = friends.map(f => f.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat2 = (minLat + maxLat) / 2;
      const centerLng2 = (minLng + maxLng) / 2;
      const latSpan = Math.max((maxLat - minLat) * 1.5, 0.01);
      const lngSpan = Math.max((maxLng - minLng) * 1.5, 0.01);
      m.setRegionAnimated(
        new mapkit.CoordinateRegion(
          new mapkit.Coordinate(centerLat2, centerLng2),
          new mapkit.CoordinateSpan(latSpan, lngSpan)
        ),
        false
      );
    }
  }, [isReady, map, friends, avatars, containerSize]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Overlay card */}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 max-w-[180px]">
        {friends.map(f => (
          <div key={f.handle} className="flex items-center gap-2 py-0.5">
            {avatars[f.handle] ? (
              <img src={avatars[f.handle]} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/60 font-semibold shrink-0">
                {f.name.charAt(0)}
              </div>
            )}
            <span className="text-[10px] text-white/80 truncate flex-1">{f.name}</span>
            <span className="text-[9px] text-white/30 shrink-0">{timeAgo(f.lastUpdated)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Pins Mode ---

function PinsMode({ friends, avatars }: {
  friends: FriendLocation[];
  avatars: Record<string, string>;
}) {
  return (
    <div className="w-full h-full bg-[#1a1a1c] flex items-center justify-center p-4">
      <div className="flex flex-wrap items-center justify-center gap-4">
        {friends.map(f => (
          <div key={f.handle} className="flex flex-col items-center gap-1.5 min-w-0">
            <div className="relative">
              {avatars[f.handle] ? (
                <img
                  src={avatars[f.handle]}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                  alt=""
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-white/60 text-lg font-semibold">
                  {f.name.charAt(0)}
                </div>
              )}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1a1c]"
                style={{ background: statusColor(f.status) }}
              />
            </div>
            <div className="text-center max-w-[80px]">
              <div className="text-[10px] text-white/80 font-medium truncate">{f.name.split(' ')[0]}</div>
              <div className="text-[8px] text-white/30 truncate">{f.address || f.subtitle || timeAgo(f.lastUpdated)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- List Mode ---

function ListMode({ friends, avatars }: {
  friends: FriendLocation[];
  avatars: Record<string, string>;
}) {
  return (
    <div className="w-full h-full bg-[#1a1a1c] overflow-y-auto px-3 py-2">
      {friends.map(f => (
        <div key={f.handle} className="flex items-center gap-2.5 py-1.5 border-b border-white/[0.04] last:border-0">
          <div className="relative shrink-0">
            {avatars[f.handle] ? (
              <img
                src={avatars[f.handle]}
                className="w-8 h-8 rounded-full object-cover"
                alt=""
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-sm font-semibold">
                {f.name.charAt(0)}
              </div>
            )}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-[#1a1a1c]"
              style={{ background: statusColor(f.status) }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-white/80 font-medium truncate">{f.name}</div>
            <div className="text-[9px] text-white/30 truncate">{f.address || f.subtitle || 'Location unavailable'}</div>
          </div>
          <div className="text-[9px] text-white/25 shrink-0">{timeAgo(f.lastUpdated)}</div>
        </div>
      ))}
    </div>
  );
}
