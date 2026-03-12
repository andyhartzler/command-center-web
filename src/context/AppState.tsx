'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type DashboardWidget, type WidgetConfig, WIDGET_TYPE_META, FAMILY_GRID_SIZE, defaultConfig, type WidgetType, type WidgetFamily } from '@/types/widget';
import { type DashboardPage, GRID_COLUMNS, GRID_ROWS, type AppMode, type EOCScope } from '@/types/dashboard';

// Valid widget types (used to filter out removed types from saved state)
const VALID_WIDGET_TYPES = new Set(Object.keys(WIDGET_TYPE_META));

// Sanitize pages loaded from localStorage to handle schema changes
function sanitizePages(pages: DashboardPage[]): DashboardPage[] {
  return pages.map(page => {
    // Detect old 12x8 grid and migrate to 24x16
    const isOldGrid = (page.gridColumns ?? 12) <= 12 && (page.gridRows ?? 8) <= 8;

    return {
      ...page,
      gridColumns: isOldGrid ? 24 : (page.gridColumns ?? 24),
      gridRows: isOldGrid ? 16 : (page.gridRows ?? 16),
      widgets: page.widgets
        .filter(w => VALID_WIDGET_TYPES.has(w.widgetConfig?.type))
        .map(w => {
          if (!isOldGrid) return w;
          // Migrate positions and sizes: multiply by 2
          const newSize = FAMILY_GRID_SIZE[w.family];
          return {
            ...w,
            position: {
              column: Math.min(w.position.column * 2, GRID_COLUMNS - newSize.columns),
              row: Math.min(w.position.row * 2, GRID_ROWS - newSize.rows),
            },
            size: { columns: newSize.columns, rows: newSize.rows },
          };
        }),
    };
  });
}

interface AppStateContextType {
  pages: DashboardPage[];
  setPages: React.Dispatch<React.SetStateAction<DashboardPage[]>>;
  currentPageIndex: number;
  setCurrentPageIndex: (i: number) => void;
  isDisplayMode: boolean;
  setDisplayMode: (v: boolean) => void;
  appMode: AppMode;
  setAppMode: (m: AppMode) => void;
  eocScope: EOCScope;
  setEocScope: (s: EOCScope) => void;
  eocServerURL: string;
  setEocServerURL: (u: string) => void;
  addPage: () => void;
  deletePage: (index: number) => void;
  renamePage: (index: number, name: string) => void;
  addWidget: (type: WidgetType, family: WidgetFamily, configOverride?: WidgetConfig) => void;
  deleteWidget: (id: string) => void;
  moveWidget: (id: string, to: { column: number; row: number }) => void;
  updateWidget: (id: string, updates: Partial<DashboardWidget>) => void;
  resizeWidget: (id: string, family: WidgetFamily) => void;
  hasSpaceForWidget: (size: { columns: number; rows: number }, page: DashboardPage) => boolean;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

/** Helper: create a widget with size derived from family (positions are 0-indexed, matching Swift) */
function demoWidget(
  id: string,
  type: WidgetType,
  family: WidgetFamily,
  column: number,
  row: number,
): DashboardWidget {
  const size = FAMILY_GRID_SIZE[family];
  return {
    id,
    widgetConfig: defaultConfig(type),
    family,
    position: { column, row },
    size: { columns: size.columns, rows: size.rows },
    style: { showTitle: true, showBorder: true, opacity: 1, cornerRadius: 24 },
  };
}

/**
 * Demo page layout.
 * Grid: 24 columns x 16 rows.
 *
 * Layout (using new 24x16 grid):
 *   Row 0-3:  clock(6x4@0,0)  weather(6x4@6,0)  crypto(6x4@12,0)  sun(6x4@18,0)
 *   Row 4-9:  news(8x6@0,4)   stocks(8x6@8,4)   worldNews(8x6@16,4)
 *   Row 10-13: sports(6x4@0,10) faaDelays(6x4@6,10) predictions(6x4@12,10) moon(4x4@18,10)
 */
const DEMO_PAGE: DashboardPage = {
  id: 'demo',
  name: 'Main',
  gridColumns: 24,
  gridRows: 16,
  widgets: [
    // Top row: four medium (6x4) widgets
    demoWidget('w1', 'clock',              'medium', 0, 0),
    demoWidget('w2', 'weather',            'medium', 6, 0),
    demoWidget('w3', 'crypto',             'medium', 12, 0),
    demoWidget('w4', 'sun',                'medium', 18, 0),
    // Middle row: three large (8x6) widgets
    demoWidget('w5', 'news',               'large',  0, 4),
    demoWidget('w6', 'stocks',             'large',  8, 4),
    demoWidget('w7', 'worldNews',          'large',  16, 4),
    // Bottom row: three medium + one small
    demoWidget('w8', 'sports',             'medium', 0, 10),
    demoWidget('w9', 'faaDelays',          'medium', 6, 10),
    demoWidget('w10', 'predictionMarkets', 'medium', 12, 10),
    demoWidget('w11', 'moonPhase',         'small',  18, 10),
  ],
  backgroundTheme: 'deepSpace',
  autoRotateSeconds: null,
};

/**
 * Find the first open position in a 0-indexed grid that can fit `size`.
 */
function findOpenPosition(widgets: DashboardWidget[], size: { columns: number; rows: number }): { column: number; row: number } | null {
  const occupied = new Set<string>();
  for (const w of widgets) {
    const ws = w.size ?? FAMILY_GRID_SIZE[w.family];
    for (let r = w.position.row; r < w.position.row + ws.rows; r++) {
      for (let c = w.position.column; c < w.position.column + ws.columns; c++) {
        occupied.add(`${c},${r}`);
      }
    }
  }

  // 0-indexed scan
  for (let r = 0; r <= GRID_ROWS - size.rows; r++) {
    for (let c = 0; c <= GRID_COLUMNS - size.columns; c++) {
      let fits = true;
      for (let dr = 0; dr < size.rows && fits; dr++) {
        for (let dc = 0; dc < size.columns && fits; dc++) {
          if (occupied.has(`${c + dc},${r + dr}`)) fits = false;
        }
      }
      if (fits) return { column: c, row: r };
    }
  }
  return null;
}

function checkCollision(
  widgets: DashboardWidget[],
  excludeId: string,
  position: { column: number; row: number },
  size: { columns: number; rows: number }
): boolean {
  for (const w of widgets) {
    if (w.id === excludeId) continue;
    const ws = w.size ?? FAMILY_GRID_SIZE[w.family];
    const wRight = w.position.column + ws.columns;
    const wBottom = w.position.row + ws.rows;
    const pRight = position.column + size.columns;
    const pBottom = position.row + size.rows;
    if (
      position.column < wRight &&
      pRight > w.position.column &&
      position.row < wBottom &&
      pBottom > w.position.row
    ) {
      return true;
    }
  }
  return false;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<DashboardPage[]>([DEMO_PAGE]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isDisplayMode, setDisplayMode] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('dashboard');
  const [eocScope, setEocScope] = useState<EOCScope>('kc');
  const [eocServerURL, setEocServerURL] = useState('http://192.168.4.21:8080');
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('commandcenter-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pages?.length) setPages(sanitizePages(parsed.pages));
        if (typeof parsed.currentPageIndex === 'number') setCurrentPageIndex(parsed.currentPageIndex);
        if (parsed.eocServerURL) setEocServerURL(parsed.eocServerURL);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem('commandcenter-state', JSON.stringify({
        pages,
        currentPageIndex,
        eocServerURL,
      }));
    } catch { /* ignore */ }
  }, [pages, currentPageIndex, eocServerURL, loaded]);

  const addPage = useCallback(() => {
    setPages(prev => {
      const newPage: DashboardPage = {
        id: crypto.randomUUID(),
        name: `Page ${prev.length + 1}`,
        widgets: [],
        backgroundTheme: 'deepSpace',
        autoRotateSeconds: null,
        gridColumns: 12,
        gridRows: 8,
      };
      return [...prev, newPage];
    });
    setCurrentPageIndex(pages.length);
  }, [pages.length]);

  const deletePage = useCallback((index: number) => {
    setPages(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setCurrentPageIndex(prev => Math.min(prev, Math.max(0, pages.length - 2)));
  }, [pages.length]);

  const renamePage = useCallback((index: number, name: string) => {
    setPages(prev => {
      if (index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  }, []);

  const addWidget = useCallback((type: WidgetType, family: WidgetFamily, configOverride?: WidgetConfig) => {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      const size = FAMILY_GRID_SIZE[family];
      const pos = findOpenPosition(page.widgets, size);
      if (!pos) return prev;

      const widget: DashboardWidget = {
        id: crypto.randomUUID(),
        widgetConfig: configOverride || defaultConfig(type),
        family,
        position: pos,
        size: { columns: size.columns, rows: size.rows },
        style: { showTitle: true, showBorder: true, opacity: 1, cornerRadius: 24 },
      };
      page.widgets = [...page.widgets, widget];
      next[currentPageIndex] = page;
      return next;
    });
  }, [currentPageIndex]);

  const deleteWidget = useCallback((id: string) => {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      page.widgets = page.widgets.filter(w => w.id !== id);
      next[currentPageIndex] = page;
      return next;
    });
  }, [currentPageIndex]);

  const moveWidget = useCallback((id: string, to: { column: number; row: number }) => {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      const widgetIdx = page.widgets.findIndex(w => w.id === id);
      if (widgetIdx === -1) return prev;

      const widget = page.widgets[widgetIdx];
      const size = widget.size ?? FAMILY_GRID_SIZE[widget.family];

      // Validate bounds (0-indexed)
      if (to.column < 0 || to.row < 0 ||
          to.column + size.columns > GRID_COLUMNS ||
          to.row + size.rows > GRID_ROWS) {
        return prev;
      }

      // Check collision
      if (checkCollision(page.widgets, id, to, size)) {
        return prev;
      }

      page.widgets = page.widgets.map(w =>
        w.id === id ? { ...w, position: to } : w
      );
      next[currentPageIndex] = page;
      return next;
    });
  }, [currentPageIndex]);

  const resizeWidget = useCallback((id: string, family: WidgetFamily) => {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      const widgetIdx = page.widgets.findIndex(w => w.id === id);
      if (widgetIdx === -1) return prev;

      const widget = page.widgets[widgetIdx];
      const newSize = FAMILY_GRID_SIZE[family];

      // Check bounds (0-indexed)
      if (widget.position.column + newSize.columns > GRID_COLUMNS ||
          widget.position.row + newSize.rows > GRID_ROWS) {
        return prev;
      }

      // Check collision
      if (checkCollision(page.widgets, id, widget.position, newSize)) {
        return prev;
      }

      page.widgets = page.widgets.map(w =>
        w.id === id ? { ...w, family, size: { columns: newSize.columns, rows: newSize.rows } } : w
      );
      next[currentPageIndex] = page;
      return next;
    });
  }, [currentPageIndex]);

  const updateWidget = useCallback((id: string, updates: Partial<DashboardWidget>) => {
    setPages(prev => {
      const next = [...prev];
      const page = { ...next[currentPageIndex] };
      page.widgets = page.widgets.map(w => w.id === id ? { ...w, ...updates } : w);
      next[currentPageIndex] = page;
      return next;
    });
  }, [currentPageIndex]);

  const hasSpaceForWidget = useCallback((size: { columns: number; rows: number }, page: DashboardPage) => {
    return findOpenPosition(page.widgets, size) !== null;
  }, []);

  return (
    <AppStateContext.Provider value={{
      pages, setPages, currentPageIndex, setCurrentPageIndex,
      isDisplayMode, setDisplayMode, appMode, setAppMode,
      eocScope, setEocScope, eocServerURL, setEocServerURL,
      addPage, deletePage, renamePage,
      addWidget, deleteWidget, moveWidget, updateWidget, resizeWidget,
      hasSpaceForWidget,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
