'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { useAppState } from '@/context/AppState';
import { BACKGROUND_THEMES } from '@/types/dashboard';
import { WidgetGrid } from './WidgetGrid';

export function DashboardDisplay() {
  const { pages, currentPageIndex, setCurrentPageIndex, setDisplayMode } = useAppState();
  const currentPage = pages[currentPageIndex];
  const autoRotateRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [showToolbar, setShowToolbar] = useState(false);
  const [rotateKey, setRotateKey] = useState(0);
  const isTouchDevice = useRef(false);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(hover: none)').matches;
  }, []);

  const goTo = useCallback((index: number) => {
    const change = () => setCurrentPageIndex(index);
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => flushSync(change));
    } else {
      change();
    }
  }, [setCurrentPageIndex]);

  const goNext = useCallback(() => {
    if (pages.length <= 1) return;
    goTo((currentPageIndex + 1) % pages.length);
  }, [currentPageIndex, pages.length, goTo]);

  const goPrev = useCallback(() => {
    if (pages.length <= 1) return;
    goTo((currentPageIndex - 1 + pages.length) % pages.length);
  }, [currentPageIndex, pages.length, goTo]);

  const handleTouchToggleToolbar = useCallback(() => {
    if (!isTouchDevice.current) return;
    setShowToolbar(prev => {
      const next = !prev;
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
      if (next) {
        toolbarTimerRef.current = setTimeout(() => setShowToolbar(false), 4000);
      }
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      swipeStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !swipeStartRef.current) return;
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    const elapsed = Date.now() - swipeStartRef.current.time;
    swipeStartRef.current = null;

    if (elapsed < 500 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }

    handleTouchToggleToolbar();
  }, [goNext, goPrev, handleTouchToggleToolbar]);

  // Keyboard navigation: Escape and space exit, arrows page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        setDisplayMode(false);
      }
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setDisplayMode, goNext, goPrev]);

  // Auto-rotate with visible progress hairline
  useEffect(() => {
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    if (currentPage?.autoRotateSeconds) {
      autoRotateRef.current = setInterval(goNext, currentPage.autoRotateSeconds * 1000);
      setRotateKey(k => k + 1);
    }
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [currentPage?.autoRotateSeconds, currentPageIndex, goNext]);

  useEffect(() => {
    return () => {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    };
  }, []);

  if (!currentPage) return null;

  const theme = BACKGROUND_THEMES[currentPage.backgroundTheme] ?? BACKGROUND_THEMES.deepSpace;

  return (
    <div
      className={`w-screen h-screen relative ${theme.className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="grain-overlay" aria-hidden />

      {/* Auto-rotate progress hairline */}
      {currentPage.autoRotateSeconds ? (
        <div
          key={`rotate-${rotateKey}-${currentPageIndex}`}
          className="rotate-hairline"
          style={{ animationDuration: `${currentPage.autoRotateSeconds}s` }}
          aria-hidden
        />
      ) : null}

      {/* Hover zone reveals the toolbar */}
      <div
        className="display-toolbar-zone"
        onMouseEnter={() => setShowToolbar(true)}
        onMouseLeave={() => setShowToolbar(false)}
      />

      {/* Floating glass toolbar pill */}
      <div
        className="display-toolbar"
        style={{ opacity: showToolbar ? 1 : 0, pointerEvents: showToolbar ? 'auto' : 'none' }}
        onMouseEnter={() => setShowToolbar(true)}
        onMouseLeave={() => setShowToolbar(false)}
      >
        <div className="glass-chip flex items-center gap-4 px-4 py-2">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              style={{ width: 6, height: 6, background: 'var(--color-accent-500)' }}
            />
            <span
              className="font-mono text-[12px] font-medium"
              style={{ letterSpacing: '0.3em', color: 'var(--color-text-3)' }}
            >
              COMMAND CENTER
            </span>
          </span>

          {pages.length > 1 && (
            <span className="page-indicator" role="tablist" aria-label="Pages">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={i === currentPageIndex}
                  aria-label={p.name}
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  className={`page-dot ${i === currentPageIndex ? 'page-dot--active' : ''}`}
                />
              ))}
            </span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setDisplayMode(false); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] transition-colors"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--border-card)',
              color: 'var(--color-text-2)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span className="text-[13px] font-medium">Edit</span>
          </button>
        </div>
      </div>

      {/* Widget grid participates in the page view transition */}
      <div style={{ viewTransitionName: 'cc-page' }} className="absolute inset-0">
        <WidgetGrid page={currentPage} />
      </div>
    </div>
  );
}
