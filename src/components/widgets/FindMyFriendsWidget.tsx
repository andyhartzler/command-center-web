'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Users, Loader2, RefreshCw } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const fetchData = useCallback(async (refresh = false) => {
    try {
      const url = refresh ? '/api/findmy?action=refresh' : '/api/findmy';
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.includes('error') ? JSON.parse(text).error : `HTTP ${res.status}`);
      }
      const json: FindMyData = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('[FindMy] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

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
        <MapMode friends={friends} avatars={avatars} />
      )}
      {mode === 'pins' && (
        <PinsMode friends={friends} avatars={avatars} />
      )}
      {mode === 'list' && (
        <ListMode friends={friends} avatars={avatars} />
      )}

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors"
        title="Refresh locations"
      >
        <RefreshCw size={13} className={`text-white/60 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

// --- Map Mode ---

function MapMode({ friends, avatars }: {
  friends: FriendLocation[];
  avatars: Record<string, string>;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const prevFriendsKey = useRef('');

  // Only show friends with valid coordinates on the map
  const mappable = friends.filter(f => f.lat !== 0 || f.lng !== 0);

  // Default center to KC area if no mappable friends
  const centerLat = mappable.length > 0
    ? mappable.reduce((s, f) => s + f.lat, 0) / mappable.length
    : 39.0997;
  const centerLng = mappable.length > 0
    ? mappable.reduce((s, f) => s + f.lng, 0) / mappable.length
    : -94.5786;

  const { map, ready, isReady } = useAppleMap(mapContainerRef, {
    center: [centerLat, centerLng],
    zoom: 8,
    interactive: false,
  });

  // Add/update annotations when map is ready or friends change
  useEffect(() => {
    if (!ready || !isReady()) return;
    const m = map.current;
    if (!m) return;

    // Build a key to detect changes
    const key = mappable.map(f => `${f.handle}:${f.lat}:${f.lng}:${f.status}`).join('|');
    if (key === prevFriendsKey.current) return;
    prevFriendsKey.current = key;

    // Clear previous annotations
    m.removeAnnotations(m.annotations);

    // Offset overlapping pins (same lat/lng) so they don't stack
    const coordCounts: Record<string, number> = {};
    const coordIndex: Record<string, number> = {};
    for (const f of mappable) {
      const key = `${f.lat.toFixed(4)},${f.lng.toFixed(4)}`;
      coordCounts[key] = (coordCounts[key] || 0) + 1;
      coordIndex[key] = 0;
    }

    // Add photo annotations for each mappable friend
    for (const friend of mappable) {
      const key = `${friend.lat.toFixed(4)},${friend.lng.toFixed(4)}`;
      const total = coordCounts[key];
      const idx = coordIndex[key]++;
      // Offset overlapping pins horizontally
      const offsetX = total > 1 ? (idx - (total - 1) / 2) * 28 : 0;

      const coord = new mapkit.Coordinate(friend.lat, friend.lng);
      const avatarUrl = avatars[friend.handle];

      const annotation = new mapkit.Annotation(
        coord,
        () => {
          const el = document.createElement('div');
          el.style.cssText = 'cursor:default;overflow:visible;';

          if (avatarUrl) {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.style.cssText = 'width:36px;height:36px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);object-fit:cover;display:block;';
            el.appendChild(img);
          } else {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `width:36px;height:36px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);background:#374151;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:600;`;
            placeholder.textContent = friend.name.charAt(0).toUpperCase();
            el.appendChild(placeholder);
          }

          return el;
        },
        { anchorOffset: new DOMPoint(offsetX, 0) }
      );

      m.addAnnotation(annotation);
    }

    // Set map padding so pins aren't hidden behind the bottom-left overlay
    (m as any).padding = new (mapkit as any).Padding(40, 40, 100, 20);

    // Auto-zoom to fit all friends with padding
    if (mappable.length > 1) {
      const lats = mappable.map(f => f.lat);
      const lngs = mappable.map(f => f.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const cLat = (minLat + maxLat) / 2;
      const cLng = (minLng + maxLng) / 2;
      const latSpan = Math.max((maxLat - minLat) * 1.5, 0.08);
      const lngSpan = Math.max((maxLng - minLng) * 1.5, 0.08);
      m.setRegionAnimated(
        new mapkit.CoordinateRegion(
          new mapkit.Coordinate(cLat, cLng),
          new mapkit.CoordinateSpan(latSpan, lngSpan)
        ),
        false
      );
    } else if (mappable.length === 1) {
      m.setRegionAnimated(
        new mapkit.CoordinateRegion(
          new mapkit.Coordinate(mappable[0].lat, mappable[0].lng),
          new mapkit.CoordinateSpan(0.05, 0.05)
        ),
        false
      );
    }
  }, [ready, isReady, map, mappable, avatars]);

  return (
    <div className="w-full h-full relative">
      {/* Full-bleed map */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Friend list overlay — bottom left */}
      <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        {friends.map(f => (
          <div key={f.handle} className="flex items-center gap-2 py-0.5">
            {avatars[f.handle] ? (
              <img src={avatars[f.handle]} className="w-4 h-4 rounded-full object-cover shrink-0" alt="" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/60 font-semibold shrink-0">
                {f.name.charAt(0)}
              </div>
            )}
            <span className="text-[10px] text-white/80 font-medium whitespace-nowrap">{f.name.split(' ')[0]}</span>
            {f.subtitle && (
              <span className="text-[9px] text-white/35 whitespace-nowrap">{f.subtitle}</span>
            )}
            <span className="text-[8px] text-white/20 whitespace-nowrap">{timeAgo(f.lastUpdated)}</span>
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
