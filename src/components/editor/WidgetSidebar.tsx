'use client';
import { useState, useMemo } from 'react';
import {
  Clock, CloudSun, Sun, Moon, Calendar, ListChecks, Newspaper, Globe,
  Video, Camera, Tv, Trophy, TrendingUp, Bitcoin, BarChart3, Activity,
  Plane, AlertTriangle, PlaneLanding, Flame, Heart, Home, Cpu, Wind,
  PlusCircle, Shield, MapPin, Search, X, PlaneTakeoff, Radar, Music,
} from 'lucide-react';
import { useAppState } from '@/context/AppState';
import {
  WIDGET_TYPE_META,
  FAMILY_DISPLAY_NAME,
  FAMILY_GRID_SIZE,
  type WidgetType,
  type WidgetCategory,
  type WidgetFamily,
} from '@/types/widget';
import { CameraBrowser } from './CameraBrowser';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  clock: Clock, 'cloud-sun': CloudSun, sun: Sun, moon: Moon,
  calendar: Calendar, 'list-checks': ListChecks, newspaper: Newspaper, globe: Globe,
  video: Video, camera: Camera, tv: Tv, trophy: Trophy,
  'trending-up': TrendingUp, bitcoin: Bitcoin, 'bar-chart-3': BarChart3, activity: Activity,
  plane: Plane, 'alert-triangle': AlertTriangle, 'plane-landing': PlaneLanding,
  'plane-takeoff': PlaneTakeoff, radar: Radar,
  flame: Flame, heart: Heart, home: Home, cpu: Cpu, wind: Wind, music: Music,
};

const CATEGORY_ORDER: WidgetCategory[] = [
  'Time & Location', 'Media', 'Finance', 'World Monitor', 'Productivity', 'System',
];

// Grand security cameras
const GRAND_CAMERAS: { label: string; url: string }[] = [
  { label: 'Parking Lot', url: '/api/grand-cameras/1/stream.m3u8' },
  { label: 'Grand Blvd South', url: '/api/grand-cameras/2/stream.m3u8' },
  { label: 'Grand Blvd North', url: '/api/grand-cameras/3/stream.m3u8' },
];

export function WidgetSidebar() {
  const { addWidget, pages, currentPageIndex, hasSpaceForWidget } = useAppState();
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<WidgetFamily | null>(null);
  const [showCameraBrowser, setShowCameraBrowser] = useState(false);

  const currentPage = pages[currentPageIndex];

  const widgetsByCategory = useMemo(() => {
    const groups: Record<WidgetCategory, { type: WidgetType; meta: (typeof WIDGET_TYPE_META)[WidgetType] }[]> = {
      'Time & Location': [], 'Productivity': [], 'Media': [], 'Finance': [], 'World Monitor': [], 'System': [],
    };
    for (const [type, meta] of Object.entries(WIDGET_TYPE_META)) {
      groups[meta.category].push({ type: type as WidgetType, meta });
    }
    return groups;
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORY_ORDER;
    const q = search.toLowerCase();
    return CATEGORY_ORDER.filter(cat =>
      widgetsByCategory[cat].some(w =>
        w.meta.displayName.toLowerCase().includes(q) || w.type.toLowerCase().includes(q)
      )
    );
  }, [search, widgetsByCategory]);

  const filterWidgets = (widgets: typeof widgetsByCategory[WidgetCategory]) => {
    if (!search.trim()) return widgets;
    const q = search.toLowerCase();
    return widgets.filter(w =>
      w.meta.displayName.toLowerCase().includes(q) || w.type.toLowerCase().includes(q)
    );
  };

  const handleAddWidget = (type: WidgetType, family: WidgetFamily) => {
    // If requested family doesn't fit, try smaller supported families
    if (currentPage && !hasSpaceForWidget(FAMILY_GRID_SIZE[family], currentPage)) {
      const meta = WIDGET_TYPE_META[type];
      const sizeOrder: WidgetFamily[] = ['small', 'medium', 'large', 'wide', 'extraLarge'];
      const requestedIdx = sizeOrder.indexOf(family);
      for (let i = requestedIdx - 1; i >= 0; i--) {
        const smaller = sizeOrder[i];
        if (meta.supportedFamilies.includes(smaller) && hasSpaceForWidget(FAMILY_GRID_SIZE[smaller], currentPage)) {
          addWidget(type, smaller);
          return;
        }
      }
    }
    addWidget(type, family);
  };

  if (showCameraBrowser) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button
            onClick={() => setShowCameraBrowser(false)}
            className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X size={12} className="text-white/50" />
          </button>
          <span className="text-[11px] font-semibold text-white/70">KC Scout Cameras</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <CameraBrowser onClose={() => setShowCameraBrowser(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search widgets..."
            className="w-full pl-7 pr-7 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/15 focus:bg-white/[0.06] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable widget gallery */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4 space-y-4 scrollbar-thin">

        {/* Security cameras section */}
        {!search && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Shield size={10} className="text-emerald-400/60" />
              <span className="text-[9px] font-bold text-white/25 uppercase tracking-[1.5px]">Security</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {GRAND_CAMERAS.map(cam => (
                <button
                  key={cam.label}
                  onClick={() => addWidget('camera', 'medium', {
                    type: 'camera',
                    config: { url: cam.url, label: cam.label, isMuted: true },
                  })}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all group"
                >
                  <Camera size={11} className="text-emerald-400/50 shrink-0" />
                  <span className="text-[11px] text-white/50 group-hover:text-white/80 transition-colors flex-1 text-left truncate">
                    {cam.label}
                  </span>
                  <PlusCircle size={12} className="text-white/0 group-hover:text-white/60 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KC Scout button */}
        {!search && (
          <button
            onClick={() => setShowCameraBrowser(true)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-orange-500/[0.06] border border-orange-500/10 hover:bg-orange-500/[0.12] hover:border-orange-500/20 transition-all group"
          >
            <MapPin size={12} className="text-orange-400/70 shrink-0" />
            <span className="text-[11px] font-medium text-orange-300/70 group-hover:text-orange-200 transition-colors flex-1 text-left">
              KC Scout Traffic Cameras
            </span>
            <span className="text-[9px] text-orange-400/30">341</span>
          </button>
        )}

        {/* Widget categories with inline widgets */}
        {filteredCategories.map(category => {
          const widgets = filterWidgets(widgetsByCategory[category]);
          if (widgets.length === 0) return null;

          return (
            <div key={category}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[9px] font-bold text-white/25 uppercase tracking-[1.5px]">{category}</span>
                <span className="text-[9px] text-white/10">{widgets.length}</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {widgets.map(({ type, meta }) => {
                  const Icon = ICON_MAP[meta.icon] || Cpu;
                  const canFit = currentPage ? meta.supportedFamilies.some(f => hasSpaceForWidget(FAMILY_GRID_SIZE[f], currentPage)) : false;

                  return (
                    <div
                      key={type}
                      className={`rounded-xl border transition-all ${
                        canFit
                          ? 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.08]'
                          : 'bg-white/[0.01] border-white/[0.03] opacity-50'
                      }`}
                    >
                      {/* Widget header + quick add */}
                      <div className="flex items-center gap-2.5 p-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}15)`,
                            border: `1px solid ${meta.color}20`,
                            color: meta.color,
                          }}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-white/85 leading-tight">{meta.displayName}</div>
                        </div>
                        <button
                          onClick={() => handleAddWidget(type, meta.defaultFamily)}
                          disabled={!canFit}
                          className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.12] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                          title={canFit ? `Add ${meta.displayName}` : 'No space on grid'}
                        >
                          <PlusCircle size={13} className="text-[#6b8aab]" />
                        </button>
                      </div>

                      {/* Size options - compact row */}
                      {meta.supportedFamilies.length > 1 && (
                        <div className="flex items-center gap-1 px-2.5 pb-2">
                          {meta.supportedFamilies.map(family => {
                            const gs = FAMILY_GRID_SIZE[family];
                            const fits = currentPage ? hasSpaceForWidget(gs, currentPage) : false;
                            return (
                              <button
                                key={family}
                                onClick={() => handleAddWidget(type, family)}
                                disabled={!fits}
                                className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
                                  family === meta.defaultFamily
                                    ? 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/70'
                                    : 'text-white/25 hover:bg-white/[0.04] hover:text-white/40'
                                } disabled:opacity-20 disabled:cursor-not-allowed`}
                                title={`${FAMILY_DISPLAY_NAME[family]} (${gs.columns}x${gs.rows})`}
                              >
                                {FAMILY_DISPLAY_NAME[family]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
