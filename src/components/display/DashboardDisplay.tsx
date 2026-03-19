'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppState } from '@/context/AppState';
import { BACKGROUND_THEMES } from '@/types/dashboard';
import { WidgetGrid } from './WidgetGrid';

export function DashboardDisplay() {
  const { pages, currentPageIndex, setCurrentPageIndex, setDisplayMode } = useAppState();
  const currentPage = pages[currentPageIndex];
  const autoRotateRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [showToolbar, setShowToolbar] = useState(false);
  const isTouchDevice = useRef(false);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Detect touch device
  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(hover: none)').matches;
  }, []);

  const goNext = useCallback(() => {
    if (pages.length <= 1) return;
    setCurrentPageIndex((currentPageIndex + 1) % pages.length);
  }, [currentPageIndex, pages.length, setCurrentPageIndex]);

  const goPrev = useCallback(() => {
    if (pages.length <= 1) return;
    setCurrentPageIndex((currentPageIndex - 1 + pages.length) % pages.length);
  }, [currentPageIndex, pages.length, setCurrentPageIndex]);

  // Touch: tap anywhere toggles toolbar, auto-hide after 4s
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

  // Swipe tracking (touch only)
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

    // Horizontal swipe: >50px within 500ms, more horizontal than vertical
    if (elapsed < 500 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();   // swipe left = next
      else goPrev();          // swipe right = prev
      return;
    }

    // If not a swipe, treat as tap to toggle toolbar
    handleTouchToggleToolbar();
  }, [goNext, goPrev, handleTouchToggleToolbar]);

  // Keyboard navigation (matches Swift: Escape, arrows, space)
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

  // Auto-rotate
  useEffect(() => {
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    if (currentPage?.autoRotateSeconds) {
      autoRotateRef.current = setInterval(goNext, currentPage.autoRotateSeconds * 1000);
    }
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [currentPage?.autoRotateSeconds, goNext]);

  // Cleanup toolbar timer
  useEffect(() => {
    return () => {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    };
  }, []);

  if (!currentPage) return null;

  const theme = BACKGROUND_THEMES[currentPage.backgroundTheme];

  return (
    <div
      className={`w-screen h-screen relative ${theme.className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Invisible hover zone at top (matches Swift: Color.clear .frame(height: 30)) */}
      <div
        className="display-toolbar-zone"
        onMouseEnter={() => setShowToolbar(true)}
        onMouseLeave={() => setShowToolbar(false)}
      />

      {/* Hover-reveal toolbar (matches Swift .ultraThinMaterial toolbar) */}
      <div
        className="display-toolbar"
        style={{ opacity: showToolbar ? 1 : 0 }}
        onMouseEnter={() => setShowToolbar(true)}
        onMouseLeave={() => setShowToolbar(false)}
      >
        <div className="flex items-center justify-between px-5 py-2.5"
          style={{ background: 'rgba(28,28,30,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[13px] font-medium text-white/50">
            CommandCenter
          </span>
          {pages.length > 1 && (
            <span className="text-[11px] text-white/25">
              Page {currentPageIndex + 1} of {pages.length}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDisplayMode(false); }}
            className="flex items-center gap-1 px-3 py-1.5 text-white/80 rounded-lg transition-colors hover:bg-white/[0.08]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span className="text-xs font-medium">Edit</span>
          </button>
        </div>
      </div>

      {/* Widget grid */}
      <WidgetGrid page={currentPage} />

    </div>
  );
}
