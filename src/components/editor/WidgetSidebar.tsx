'use client';
import { useState, useMemo } from 'react';
import {
  Clock, CloudSun, Sun, Calendar, ListChecks, Newspaper, Globe,
  Video, Camera, Tv, Trophy, TrendingUp, Bitcoin, BarChart3, Activity,
  Plane, AlertTriangle, PlaneLanding, Flame, Heart, Home, Cpu,
  PlusCircle, ChevronRight,
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

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  clock: Clock,
  'cloud-sun': CloudSun,
  sun: Sun,
  calendar: Calendar,
  'list-checks': ListChecks,
  newspaper: Newspaper,
  globe: Globe,
  video: Video,
  camera: Camera,
  tv: Tv,
  trophy: Trophy,
  'trending-up': TrendingUp,
  bitcoin: Bitcoin,
  'bar-chart-3': BarChart3,
  activity: Activity,
  plane: Plane,
  'alert-triangle': AlertTriangle,
  'plane-landing': PlaneLanding,
  flame: Flame,
  heart: Heart,
  home: Home,
  cpu: Cpu,
};

const CATEGORY_ICONS: Record<WidgetCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  'Time & Location': Clock,
  'Productivity': Calendar,
  'Media': Tv,
  'Finance': TrendingUp,
  'World Monitor': Globe,
  'System': Cpu,
};

const ALL_CATEGORIES: WidgetCategory[] = [
  'Time & Location',
  'Productivity',
  'Media',
  'Finance',
  'World Monitor',
  'System',
];

interface QuickAdd {
  label: string;
  type: WidgetType;
  family: WidgetFamily;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

const QUICK_ADDS: QuickAdd[] = [
  { label: 'KC News', type: 'news', family: 'large', icon: Newspaper, color: '#a855f7' },
  { label: 'World News', type: 'worldNews', family: 'large', icon: Globe, color: '#14b8a6' },
  { label: 'Traffic Cams', type: 'webcams', family: 'medium', icon: Video, color: '#6b7280' },
];

export function WidgetSidebar() {
  const { addWidget } = useAppState();
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | null>('Time & Location');

  // Group widget types by category
  const widgetsByCategory = useMemo(() => {
    const groups: Record<WidgetCategory, { type: WidgetType; meta: (typeof WIDGET_TYPE_META)[WidgetType] }[]> = {
      'Time & Location': [],
      'Productivity': [],
      'Media': [],
      'Finance': [],
      'World Monitor': [],
      'System': [],
    };
    for (const [type, meta] of Object.entries(WIDGET_TYPE_META)) {
      groups[meta.category].push({ type: type as WidgetType, meta });
    }
    return groups;
  }, []);

  const handleAddWidget = (type: WidgetType, family: WidgetFamily) => {
    addWidget(type, family);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[2px]">WIDGETS</h2>
      </div>

      {/* Quick-add buttons */}
      <div className="px-2 pb-2">
        {QUICK_ADDS.map(qa => {
          const Icon = qa.icon;
          return (
            <button
              key={qa.label}
              onClick={() => handleAddWidget(qa.type, qa.family)}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-left hover:bg-white/5 transition-colors group"
            >
              <span className="shrink-0" style={{ color: qa.color }}><Icon size={13} /></span>
              <span className="text-[13px] font-medium text-white/70 group-hover:text-white/90 transition-colors flex-1">
                {qa.label}
              </span>
              <PlusCircle size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          );
        })}
      </div>

      <div className="mx-4 border-t border-white/[0.06]" />

      {/* Categories list */}
      <div className="px-2 py-2">
        {ALL_CATEGORIES.map(category => {
          const CatIcon = CATEGORY_ICONS[category];
          const isSelected = selectedCategory === category;
          const typeCount = widgetsByCategory[category].length;
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(isSelected ? null : category)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-left transition-colors ${
                isSelected
                  ? 'bg-blue-600/10 text-white/90'
                  : 'hover:bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              <CatIcon size={13} className="shrink-0" />
              <span className="text-[13px] flex-1">{category}</span>
              <span className="text-[11px] text-white/20">{typeCount}</span>
              <ChevronRight
                size={11}
                className={`text-white/20 transition-transform ${isSelected ? 'rotate-90' : ''}`}
              />
            </button>
          );
        })}
      </div>

      <div className="mx-4 border-t border-white/[0.06]" />

      {/* Widget gallery for selected category */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {selectedCategory && (
          <div className="flex flex-col gap-3">
            {widgetsByCategory[selectedCategory].map(({ type, meta }) => {
              const Icon = ICON_MAP[meta.icon] || Cpu;
              return (
                <div
                  key={type}
                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3"
                >
                  {/* Widget type header */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${meta.color}, ${meta.color}88)`,
                      }}
                    >
                      <Icon size={16} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-white/90">{meta.displayName}</div>
                      <div className="text-[10px] text-white/30">{meta.category}</div>
                    </div>
                  </div>

                  {/* Size variant buttons */}
                  <div className="flex flex-wrap gap-2">
                    {meta.supportedFamilies.map(family => {
                      const gridSize = FAMILY_GRID_SIZE[family];
                      return (
                        <button
                          key={family}
                          onClick={() => handleAddWidget(type, family)}
                          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/40 hover:bg-white/[0.08] hover:text-white/70 hover:border-white/10 transition-all"
                        >
                          {/* Mini grid preview */}
                          <div className="flex flex-col gap-px mb-0.5">
                            {Array.from({ length: Math.min(gridSize.rows, 3) }).map((_, r) => (
                              <div key={r} className="flex gap-px">
                                {Array.from({ length: Math.min(gridSize.columns, 4) }).map((_, c) => (
                                  <div
                                    key={c}
                                    className="w-1.5 h-1.5 rounded-[1px]"
                                    style={{ backgroundColor: meta.color + '40' }}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                          <span className="text-[10px] font-medium">
                            {FAMILY_DISPLAY_NAME[family]}
                          </span>
                          <span className="text-[8px] font-mono opacity-50">
                            {gridSize.columns}x{gridSize.rows}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!selectedCategory && (
          <div className="flex items-center justify-center h-32">
            <p className="text-[11px] text-white/20 text-center">
              Select a category to browse widgets
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
