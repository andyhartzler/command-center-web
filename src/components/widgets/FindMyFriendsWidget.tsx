'use client';

import { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
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

function statusColor(status: string): string {
  switch (status) {
    case 'live': return 'var(--color-ok)';
    case 'legacy': return 'var(--color-warn)';
    default: return 'var(--color-text-3)';
  }
}

interface Props {
  config: FindMyFriendsConfig;
  style: WidgetStyle;
}

export function FindMyFriendsWidget({ config, style }: Props) {
  const interval = Math.max(60, config.refreshInterval || 180) * 1000;
  const { data, phase, isStale, lastUpdated } = usePolledData<FindMyData>('/api/findmy', {
    interval,
  });

  // Labels arrive prepared from the server; the widget only filters and renders
  const friends =
    data?.friends.filter(
      f => config.trackedHandles.length === 0 || config.trackedHandles.includes(f.handle),
    ) ?? [];
  const avatars = data?.avatars ?? {};

  const mode = config.displayMode || 'map';

  return (
    <WidgetShell
      icon={<Users size={18} />}
      title="Friends"
      status={<Freshness lastUpdated={lastUpdated} interval={interval} isStale={isStale} />}
      style={style}
    >
      {phase === 'loading' && !data && (
        <div className="w-full h-full flex flex-col gap-2 px-3.5 pt-1 pb-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-[10px] animate-pulse"
              style={{ background: 'var(--color-surface-2)', opacity: 0.5 }}
            />
          ))}
        </div>
      )}

      {phase === 'error' && !data && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
          <Users size={20} style={{ color: 'var(--color-text-3)' }} />
          <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
            Locations unavailable
          </span>
        </div>
      )}

      {data && friends.length === 0 && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
          <Users size={20} style={{ color: 'var(--color-text-3)' }} />
          <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
            No shared locations
          </span>
        </div>
      )}

      {friends.length > 0 && (
        <div className="w-full h-full overflow-hidden relative">
          {mode === 'map' && <MapMode friends={friends} avatars={avatars} />}
          {mode === 'pins' && <PinsMode friends={friends} avatars={avatars} />}
          {mode === 'list' && <ListMode friends={friends} avatars={avatars} />}
        </div>
      )}
    </WidgetShell>
  );
}

// --- Map Mode ---

function MapMode({ friends, avatars }: {
  friends: FriendLocation[];
  avatars: Record<string, string>;
}) {
  const now = useSharedClock();
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
            placeholder.style.cssText = `width:36px;height:36px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);background:var(--color-surface-3);display:flex;align-items:center;justify-content:center;color:var(--color-text-1);font-size:14px;font-weight:600;`;
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

      {/* Friend list overlay, bottom left */}
      <div className="glass-chip absolute bottom-2 left-2 z-10 px-2.5 py-1.5">
        {friends.map(f => (
          <div key={f.handle} className="flex items-center gap-2 py-0.5">
            {avatars[f.handle] ? (
              <img src={avatars[f.handle]} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-2)' }}
              >
                {f.name.charAt(0)}
              </div>
            )}
            <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--color-text-1)' }}>
              {f.name.split(' ')[0]}
            </span>
            {f.subtitle && (
              <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
                {f.subtitle}
              </span>
            )}
            <span className="text-[12px] font-mono whitespace-nowrap" style={{ color: 'var(--color-text-3)' }}>
              {formatAge(f.lastUpdated, now)}
            </span>
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
  const now = useSharedClock();
  return (
    <div
      className="w-full h-full flex items-center justify-center p-4"
      style={{ background: 'var(--color-well)' }}
    >
      <div className="flex flex-wrap items-center justify-center gap-4">
        {friends.map(f => (
          <div key={f.handle} className="flex flex-col items-center gap-1.5 min-w-0">
            <div className="relative">
              {avatars[f.handle] ? (
                <img
                  src={avatars[f.handle]}
                  className="w-12 h-12 rounded-full object-cover"
                  style={{ border: '2px solid var(--border-hover)' }}
                  alt=""
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold"
                  style={{
                    background: 'var(--color-surface-3)',
                    border: '2px solid var(--border-hover)',
                    color: 'var(--color-text-2)',
                  }}
                >
                  {f.name.charAt(0)}
                </div>
              )}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                style={{ background: statusColor(f.status), border: '2px solid var(--color-well)' }}
              />
            </div>
            <div className="text-center max-w-[96px]">
              <div className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-1)' }}>
                {f.name.split(' ')[0]}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--color-text-3)' }}>
                {f.address || f.subtitle || formatAge(f.lastUpdated, now)}
              </div>
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
  const now = useSharedClock();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const ro = new ResizeObserver(() => {
      const ch = container.clientHeight;
      const cw = container.clientWidth;
      const sh = content.scrollHeight;
      const sw = content.scrollWidth;
      if (sh > 0 && sw > 0) {
        setScale(Math.min(ch / sh, cw / sw, 1));
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [friends.length]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden flex items-center justify-center"
      style={{ background: 'var(--color-well)' }}
    >
      <div
        ref={contentRef}
        className="w-full px-3 py-2 origin-center"
        style={{ transform: `scale(${scale})` }}
      >
        {friends.map(f => (
          <div
            key={f.handle}
            className="flex items-center gap-2.5 py-1.5 last:border-0"
            style={{ borderBottom: '1px solid var(--border-card)' }}
          >
            <div className="relative shrink-0">
              {avatars[f.handle] ? (
                <img
                  src={avatars[f.handle]}
                  className="w-8 h-8 rounded-full object-cover"
                  alt=""
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-2)' }}
                >
                  {f.name.charAt(0)}
                </div>
              )}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{
                  background: statusColor(f.status),
                  border: '1.5px solid var(--color-well)',
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-1)' }}>
                {f.name}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--color-text-3)' }}>
                {f.address || f.subtitle || 'Location unavailable'}
              </div>
            </div>
            <div className="text-[12px] font-mono shrink-0" style={{ color: 'var(--color-text-3)' }}>
              {formatAge(f.lastUpdated, now)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
