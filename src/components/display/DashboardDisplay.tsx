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

  const goNext = useCallback(() => {
    if (pages.length <= 1) return;
    setCurrentPageIndex((currentPageIndex + 1) % pages.length);
  }, [currentPageIndex, pages.length, setCurrentPageIndex]);

  const goPrev = useCallback(() => {
    if (pages.length <= 1) return;
    setCurrentPageIndex((currentPageIndex - 1 + pages.length) % pages.length);
  }, [currentPageIndex, pages.length, setCurrentPageIndex]);

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

  if (!currentPage) return null;

  const theme = BACKGROUND_THEMES[currentPage.backgroundTheme];

  return (
    <div className={`w-screen h-screen relative ${theme.className}`}>
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
          style={{ background: 'rgba(6,10,20,0.65)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)', borderBottom: '1px solid rgba(148,197,255,0.06)' }}
        >
          <span className="text-[13px] font-medium text-white/60" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            CommandCenter
          </span>
          {pages.length > 1 && (
            <span className="text-[11px] text-white/30" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Page {currentPageIndex + 1} of {pages.length}
            </span>
          )}
          <button
            onClick={() => setDisplayMode(false)}
            className="flex items-center gap-1 px-3 py-1.5 text-white/90 rounded-lg transition-colors hover:bg-white/10"
            style={{ background: 'rgba(59,130,246,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(59,130,246,0.15)' }}
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

      {/* Page indicator dots at bottom (matches Swift pageIndicator with Capsule background) */}
      {pages.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50">
          <div className="page-indicator">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPageIndex(i)}
                className="transition-all duration-200"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i === currentPageIndex ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
