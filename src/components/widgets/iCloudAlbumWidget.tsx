'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { WidgetShell } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { type ICloudAlbumConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: ICloudAlbumConfig;
  style: WidgetStyle;
}

interface AlbumResponse {
  urls?: string[];
}

// Signed asset URLs expire; refetch the list well inside their lifetime.
// The API route caches server-side, so this is cheap.
const URL_REFRESH_MS = 30 * 60 * 1000;
const TRANSITION_MS = 1200;

type LayerId = 0 | 1;

export function ICloudAlbumWidget({ config, style }: Props) {
  const token = useMemo(() => {
    const raw = config.albumUrl ?? '';
    const t = raw.includes('#') ? raw.split('#')[1] : raw;
    return t.trim();
  }, [config.albumUrl]);

  const { data, phase } = usePolledData<AlbumResponse>(
    token ? `/api/icloud-album?token=${encodeURIComponent(token)}` : null,
    { interval: URL_REFRESH_MS },
  );
  const urls = useMemo(() => data?.urls ?? [], [data]);

  const cycleMs = Math.max(5, config.cycleIntervalSeconds || 30) * 1000;
  const effect = config.transitionEffect || 'crossfade';

  // Two stacked layers; `front` is the visible one. The back layer gets the
  // next (preloaded) image, then the roles swap for a real crossfade.
  const [layerUrls, setLayerUrls] = useState<[string | null, string | null]>([null, null]);
  const [front, setFront] = useState<LayerId>(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Advances once per slide; parity picks the Ken Burns pan direction.
  const [slideSeq, setSlideSeq] = useState(0);

  const frontRef = useRef<LayerId>(0);
  frontRef.current = front;
  const photoIndexRef = useRef(0);
  photoIndexRef.current = photoIndex;

  const imgARef = useRef<HTMLImageElement>(null);
  const imgBRef = useRef<HTMLImageElement>(null);
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);

  // Seed the first slide, and when the URL list refreshes (expired links get
  // re-signed) clamp the index and repoint the visible layer at a fresh URL.
  useEffect(() => {
    if (urls.length === 0) return;
    const clamped = photoIndexRef.current < urls.length ? photoIndexRef.current : 0;
    setPhotoIndex(clamped);
    setLayerUrls(prev => {
      const which = frontRef.current;
      if (prev[which] === urls[clamped]) return prev;
      const next: [string | null, string | null] = [...prev];
      next[which] = urls[clamped];
      return next;
    });
  }, [urls]);

  // Cycle: preload the next photo off-DOM, then swap layers.
  useEffect(() => {
    if (urls.length <= 1) return;
    let cancelled = false;
    let preload: HTMLImageElement | null = null;

    const timer = setInterval(() => {
      const nextIndex = (photoIndexRef.current + 1) % urls.length;
      const nextUrl = urls[nextIndex];
      const commit = () => {
        if (cancelled) return;
        const back: LayerId = frontRef.current === 0 ? 1 : 0;
        setLayerUrls(prev => {
          const next: [string | null, string | null] = [...prev];
          next[back] = nextUrl;
          return next;
        });
        setFront(back);
        setPhotoIndex(nextIndex);
        setSlideSeq(s => s + 1);
      };
      preload = new Image();
      preload.onload = commit;
      preload.onerror = commit;
      preload.src = nextUrl;
    }, cycleMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (preload) {
        preload.onload = null;
        preload.onerror = null;
      }
    };
  }, [urls, cycleMs]);

  // Perpetual Ken Burns on the active layer: scale 1.0 -> 1.06 across the
  // whole slide, pan direction alternating per slide. Transform-only, linear.
  const activeUrl = layerUrls[front];
  useEffect(() => {
    const img = front === 0 ? imgARef.current : imgBRef.current;
    if (!img || !activeUrl) return;
    const dir = slideSeq % 2 === 0 ? 1 : -1;
    const anim = img.animate(
      [
        { transform: 'translateX(0%) scale(1)' },
        { transform: `translateX(${dir * 2}%) scale(1.06)` },
      ],
      { duration: cycleMs + TRANSITION_MS, easing: 'linear', fill: 'forwards' },
    );
    return () => anim.cancel();
  }, [activeUrl, front, slideSeq, cycleMs]);

  // Slide transition: the incoming layer glides in over the old one.
  useEffect(() => {
    if (effect !== 'slide' || slideSeq === 0) return;
    const el = front === 0 ? layerARef.current : layerBRef.current;
    if (!el) return;
    const anim = el.animate(
      [{ transform: 'translateX(100%)' }, { transform: 'translateX(0%)' }],
      { duration: TRANSITION_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    );
    return () => anim.cancel();
  }, [effect, front, slideSeq]);

  const layerStyle = (which: LayerId): CSSProperties => {
    const isFront = front === which;
    if (effect === 'slide') {
      // The incoming layer covers the old one, so the back layer only needs
      // to vanish once the slide has landed.
      return {
        opacity: isFront ? 1 : 0,
        transition: isFront ? 'none' : `opacity 0ms linear ${TRANSITION_MS}ms`,
        zIndex: isFront ? 2 : 1,
      };
    }
    return {
      opacity: isFront ? 1 : 0,
      transition: `opacity ${TRANSITION_MS}ms ease-in-out`,
      zIndex: isFront ? 2 : 1,
    };
  };

  const empty = urls.length === 0;
  let emptyMessage: string | null = null;
  if (empty) {
    if (!token) emptyMessage = 'No album configured';
    else if (phase === 'error') emptyMessage = 'Album unavailable';
    else if (phase === 'ready') emptyMessage = 'No photos in album';
  }

  return (
    <WidgetShell icon={<ImageIcon size={18} />} title="Photos" style={style} chromeless>
      <div className="w-full h-full relative overflow-hidden" style={{ background: 'var(--color-bg-0)' }}>
        {([0, 1] as const).map(which => (
          <div
            key={which}
            ref={which === 0 ? layerARef : layerBRef}
            className="absolute inset-0 will-change-transform"
            style={layerStyle(which)}
          >
            {layerUrls[which] && (
              <img
                ref={which === 0 ? imgARef : imgBRef}
                src={layerUrls[which] ?? undefined}
                alt=""
                className="absolute inset-0 w-full h-full object-cover will-change-transform"
                draggable={false}
              />
            )}
          </div>
        ))}

        {!empty && (
          <div
            className="absolute bottom-2 right-2 z-10 glass-chip px-2 py-0.5 font-mono text-[12px]"
            style={{ color: 'var(--color-text-2)' }}
          >
            {photoIndex + 1} / {urls.length}
          </div>
        )}

        {emptyMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageIcon size={20} style={{ color: 'var(--color-text-3)' }} aria-hidden />
            <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              {emptyMessage}
            </span>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
