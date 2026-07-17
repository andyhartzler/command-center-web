'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { subscribeMoments, type Moment } from '@/lib/moments';
import { useAppState } from '@/context/AppState';

// Renders at most one moment at a time. The source widget gets a one-shot
// 2.5s conic border glow sweep; high-priority moments auto-navigate the
// display to the widget's page for 90 seconds, then return.

interface MomentContextValue {
  /** widget id currently glowing, or null */
  activeWidgetId: string | null;
  headline: string | null;
}

const MomentContext = createContext<MomentContextValue>({ activeWidgetId: null, headline: null });

export function useActiveMoment() {
  return useContext(MomentContext);
}

const GLOW_MS = 2600;
const AUTONAV_HOLD_MS = 90_000;

export function MomentProvider({ children }: { children: ReactNode }) {
  const { currentPageIndex, setCurrentPageIndex, isDisplayMode } = useAppState();
  const [active, setActive] = useState<Moment | null>(null);
  const queueRef = useRef<Moment[]>([]);
  const busyRef = useRef(false);
  const returnRef = useRef<{ pageIndex: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const pageRef = useRef(currentPageIndex);
  pageRef.current = currentPageIndex;
  const displayRef = useRef(isDisplayMode);
  displayRef.current = isDisplayMode;

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      busyRef.current = false;
      return;
    }
    busyRef.current = true;
    setActive(next);

    // High-priority moments navigate the kiosk to the source page and return
    if (
      next.priority === 'high' &&
      displayRef.current &&
      typeof next.pageIndex === 'number' &&
      next.pageIndex !== pageRef.current
    ) {
      if (returnRef.current) clearTimeout(returnRef.current.timer);
      const homeIndex = returnRef.current?.pageIndex ?? pageRef.current;
      setCurrentPageIndex(next.pageIndex);
      returnRef.current = {
        pageIndex: homeIndex,
        timer: setTimeout(() => {
          setCurrentPageIndex(homeIndex);
          returnRef.current = null;
        }, AUTONAV_HOLD_MS),
      };
    }

    setTimeout(() => {
      setActive(null);
      // small settle gap between queued moments
      setTimeout(playNext, 400);
    }, GLOW_MS);
  }, [setCurrentPageIndex]);

  useEffect(() => {
    const unsub = subscribeMoments(moment => {
      queueRef.current.push(moment);
      if (!busyRef.current) playNext();
    });
    return () => {
      unsub();
      if (returnRef.current) clearTimeout(returnRef.current.timer);
    };
  }, [playNext]);

  return (
    <MomentContext.Provider
      value={{ activeWidgetId: active?.widgetId ?? null, headline: active?.headline ?? null }}
    >
      {children}
    </MomentContext.Provider>
  );
}
