'use client';
import { useMemo } from 'react';
import {
  Clock, CloudSun, Sun, Calendar, ListChecks, Newspaper, Globe,
  Video, Camera, Tv, Trophy, TrendingUp, Bitcoin, BarChart3, Activity,
  Plane, AlertTriangle, PlaneLanding, Flame, Heart, Home, Cpu,
  Trash2, X, Plus, Minus,
} from 'lucide-react';
import { useAppState } from '@/context/AppState';
import {
  WIDGET_TYPE_META,
  FAMILY_DISPLAY_NAME,
  FAMILY_GRID_SIZE,
  type WidgetFamily,
  type DashboardWidget,
} from '@/types/widget';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  clock: Clock, 'cloud-sun': CloudSun, sun: Sun, calendar: Calendar,
  'list-checks': ListChecks, newspaper: Newspaper, globe: Globe,
  video: Video, camera: Camera, tv: Tv, trophy: Trophy,
  'trending-up': TrendingUp, bitcoin: Bitcoin, 'bar-chart-3': BarChart3,
  activity: Activity, plane: Plane, 'alert-triangle': AlertTriangle,
  'plane-landing': PlaneLanding, flame: Flame, heart: Heart,
  home: Home, cpu: Cpu,
};

interface WidgetConfigPanelProps {
  widgetId: string;
  onClose: () => void;
}

export function WidgetConfigPanel({ widgetId, onClose }: WidgetConfigPanelProps) {
  const { pages, currentPageIndex, updateWidget, deleteWidget, resizeWidget } = useAppState();
  const currentPage = pages[currentPageIndex];

  const widget = useMemo(
    () => currentPage?.widgets.find(w => w.id === widgetId),
    [currentPage, widgetId]
  );

  if (!widget) {
    return (
      <div className="p-4">
        <p className="text-xs text-white/30">Widget not found</p>
      </div>
    );
  }

  const meta = WIDGET_TYPE_META[widget.widgetConfig.type];
  const Icon = ICON_MAP[meta.icon] || Cpu;

  const handleFamilyChange = (family: WidgetFamily) => {
    if (family === widget.family) return;
    resizeWidget(widget.id, family);
  };

  const handleDelete = () => {
    deleteWidget(widget.id);
    onClose();
  };

  const updateConfig = (newConfig: Record<string, unknown>) => {
    const wc = widget.widgetConfig;
    updateWidget(widget.id, {
      widgetConfig: {
        ...wc,
        config: { ...(wc.config as Record<string, unknown>), ...newConfig },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[2px]">INSPECTOR</h2>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-5">
          {/* Widget type info */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}88)` }}
            >
              <Icon size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90">{meta.displayName}</div>
              <div className="text-[10px] text-white/30">
                {FAMILY_DISPLAY_NAME[widget.family]} &middot; {FAMILY_GRID_SIZE[widget.family].columns}x{FAMILY_GRID_SIZE[widget.family].rows}
              </div>
            </div>
          </div>

          {/* Size selector */}
          <ConfigSection title="Size Preset">
            <div className="space-y-1">
              {meta.supportedFamilies.map(family => {
                const isActive = widget.family === family;
                const gridSize = FAMILY_GRID_SIZE[family];
                return (
                  <button
                    key={family}
                    onClick={() => handleFamilyChange(family)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-xs ${
                      isActive
                        ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400'
                        : 'bg-white/[0.02] border border-white/[0.04] text-white/40 hover:bg-white/5 hover:text-white/60'
                    }`}
                  >
                    <span className="font-medium">{FAMILY_DISPLAY_NAME[family]}</span>
                    <span className="text-[10px] font-mono opacity-60">{gridSize.columns}x{gridSize.rows}</span>
                  </button>
                );
              })}
            </div>
          </ConfigSection>

          {/* Widget-specific config */}
          <WidgetSpecificConfig widget={widget} updateConfig={updateConfig} />

          {/* Position */}
          <ConfigSection title="Position">
            <div className="grid grid-cols-2 gap-2">
              <ConfigField label="Column" value={widget.position.column} />
              <ConfigField label="Row" value={widget.position.row} />
            </div>
          </ConfigSection>

          {/* Appearance */}
          <ConfigSection title="Appearance">
            <div className="space-y-2">
              {/* Opacity */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/40">Opacity</span>
                  <span className="text-[10px] font-mono text-white/50">
                    {Math.round(widget.style.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={widget.style.opacity}
                  onChange={e =>
                    updateWidget(widget.id, {
                      style: { ...widget.style, opacity: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500"
                />
              </div>

              {/* Show Title toggle */}
              <ToggleRow
                label="Show Title"
                value={widget.style.showTitle}
                onChange={v => updateWidget(widget.id, { style: { ...widget.style, showTitle: v } })}
              />
            </div>
          </ConfigSection>

          {/* Widget ID */}
          <div>
            <div className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1">
              Widget ID
            </div>
            <div className="text-[9px] font-mono text-white/15 truncate">
              {widget.id}
            </div>
          </div>
        </div>
      </div>

      {/* Delete button at bottom */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium"
        >
          <Trash2 size={13} />
          Remove Widget
        </button>
      </div>
    </div>
  );
}

// --- Reusable config UI components ---

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function ConfigField({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
      <div className="text-[9px] text-white/25 mb-0.5">{label}</div>
      <div className="text-sm font-mono text-white/70">{value}</div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 flex items-center justify-between">
      <span className="text-[11px] text-white/40">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-8 h-[18px] rounded-full transition-colors relative ${
          value ? 'bg-blue-600' : 'bg-white/10'
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[2px] transition-transform ${
            value ? 'left-[14px]' : 'left-[2px]'
          }`}
        />
      </button>
    </div>
  );
}

function ConfigTextField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/40 shrink-0 w-20">{label}</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-zinc-800 border border-white/[0.06] rounded px-2 py-1 text-xs text-white/80 outline-none focus:border-blue-500/40 placeholder:text-white/15"
      />
    </div>
  );
}

function ConfigNumberField({ label, value, onChange, min, max, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/40 shrink-0 flex-1">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min ?? 0, value - (step ?? 1)))}
          className="w-5 h-5 rounded flex items-center justify-center bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
        >
          <Minus size={10} />
        </button>
        <span className="text-xs font-mono text-white/70 w-8 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max ?? 999, value + (step ?? 1)))}
          className="w-5 h-5 rounded flex items-center justify-center bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
        >
          <Plus size={10} />
        </button>
      </div>
    </div>
  );
}

function EditableList({ label, items, onChange, placeholder }: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-bold text-white/20 uppercase tracking-wider">{label}</div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            value={item}
            onChange={e => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="flex-1 bg-zinc-800 border border-white/[0.06] rounded px-2 py-1 text-xs text-white/70 outline-none focus:border-blue-500/40 placeholder:text-white/15"
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="w-5 h-5 rounded-full flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
          >
            <Minus size={10} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ''])}
        className="flex items-center gap-1 text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors"
      >
        <Plus size={10} /> Add
      </button>
    </div>
  );
}

// --- Widget-specific config sections ---

function WidgetSpecificConfig({ widget, updateConfig }: {
  widget: DashboardWidget;
  updateConfig: (config: Record<string, unknown>) => void;
}) {
  const { widgetConfig } = widget;
  const cfg = widgetConfig.config as Record<string, unknown>;

  switch (widgetConfig.type) {
    case 'clock':
      return (
        <ConfigSection title="Clock Settings">
          <div className="space-y-2">
            <ConfigTextField
              label="Label"
              value={(cfg.label as string) || ''}
              onChange={v => updateConfig({ label: v })}
            />
            <ConfigTextField
              label="Timezone"
              value={(cfg.timezone as string) || ''}
              onChange={v => updateConfig({ timezone: v })}
              placeholder="America/Chicago"
            />
            <ToggleRow
              label="24-Hour Format"
              value={(cfg.is24Hour as boolean) || false}
              onChange={v => updateConfig({ is24Hour: v })}
            />
          </div>
        </ConfigSection>
      );

    case 'weather':
      return (
        <ConfigSection title="Weather Settings">
          <div className="space-y-2">
            <ConfigTextField
              label="Location"
              value={(cfg.locationName as string) || ''}
              onChange={v => updateConfig({ locationName: v })}
            />
            <ConfigNumberField
              label="Latitude"
              value={(cfg.latitude as number) || 39.0997}
              onChange={v => updateConfig({ latitude: v })}
              min={-90} max={90} step={0.01}
            />
            <ConfigNumberField
              label="Longitude"
              value={(cfg.longitude as number) || -94.5786}
              onChange={v => updateConfig({ longitude: v })}
              min={-180} max={180} step={0.01}
            />
          </div>
        </ConfigSection>
      );

    case 'news':
      return (
        <ConfigSection title="News Settings">
          <ConfigNumberField
            label="Max Items"
            value={(cfg.maxItems as number) || 15}
            onChange={v => updateConfig({ maxItems: v })}
            min={5} max={50}
          />
        </ConfigSection>
      );

    case 'worldNews':
      return (
        <ConfigSection title="World News Settings">
          <ConfigNumberField
            label="Max Items"
            value={(cfg.maxItems as number) || 15}
            onChange={v => updateConfig({ maxItems: v })}
            min={5} max={100}
          />
        </ConfigSection>
      );

    case 'stocks':
      return (
        <ConfigSection title="Markets Settings">
          <EditableList
            label="Tickers"
            items={(cfg.symbols as string[]) || []}
            onChange={items => updateConfig({ symbols: items })}
            placeholder="e.g. AAPL"
          />
        </ConfigSection>
      );

    case 'crypto':
      return (
        <ConfigSection title="Crypto Settings">
          <EditableList
            label="Coins (CoinGecko IDs)"
            items={(cfg.coins as string[]) || []}
            onChange={items => updateConfig({ coins: items })}
            placeholder="e.g. bitcoin"
          />
        </ConfigSection>
      );

    case 'sports':
      return (
        <ConfigSection title="Sports Settings">
          <div className="space-y-3">
            <EditableList
              label="Leagues"
              items={(cfg.leagues as string[]) || []}
              onChange={items => updateConfig({ leagues: items })}
              placeholder="e.g. NFL"
            />
            <EditableList
              label="Favorite Teams"
              items={(cfg.favoriteTeams as string[]) || []}
              onChange={items => updateConfig({ favoriteTeams: items })}
              placeholder="e.g. Chiefs"
            />
          </div>
        </ConfigSection>
      );

    case 'sun':
      return (
        <ConfigSection title="Sun & Moon Settings">
          <div className="space-y-2">
            <ConfigNumberField
              label="Latitude"
              value={(cfg.latitude as number) || 39.0997}
              onChange={v => updateConfig({ latitude: v })}
              min={-90} max={90} step={0.01}
            />
            <ConfigNumberField
              label="Longitude"
              value={(cfg.longitude as number) || -94.5786}
              onChange={v => updateConfig({ longitude: v })}
              min={-180} max={180} step={0.01}
            />
          </div>
        </ConfigSection>
      );

    case 'earthquakes':
      return (
        <ConfigSection title="Earthquake Settings">
          <div className="space-y-2">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/40">Min Magnitude</span>
                <span className="text-[10px] font-mono text-white/50">
                  {((cfg.minMagnitude as number) || 2.5).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="7"
                step="0.5"
                value={(cfg.minMagnitude as number) || 2.5}
                onChange={e => updateConfig({ minMagnitude: parseFloat(e.target.value) })}
                className="w-full h-1 rounded-full appearance-none bg-white/10 accent-red-500"
              />
            </div>
          </div>
        </ConfigSection>
      );

    case 'airTraffic':
      return (
        <ConfigSection title="Air Traffic Settings">
          <div className="space-y-2">
            <ConfigNumberField
              label="Latitude"
              value={(cfg.centerLat as number) || 39.0997}
              onChange={v => updateConfig({ centerLat: v })}
              min={-90} max={90} step={0.01}
            />
            <ConfigNumberField
              label="Longitude"
              value={(cfg.centerLon as number) || -94.5786}
              onChange={v => updateConfig({ centerLon: v })}
              min={-180} max={180} step={0.01}
            />
            <ConfigNumberField
              label="Radius (NM)"
              value={(cfg.radiusNm as number) || 50}
              onChange={v => updateConfig({ radiusNm: v })}
              min={10} max={200}
            />
          </div>
        </ConfigSection>
      );

    case 'predictionMarkets':
      return (
        <ConfigSection title="Prediction Markets Settings">
          <ConfigNumberField
            label="Max Events"
            value={(cfg.maxEvents as number) || 8}
            onChange={v => updateConfig({ maxEvents: v })}
            min={5} max={50}
          />
        </ConfigSection>
      );

    case 'faaDelays':
      return (
        <ConfigSection title="FAA Delays Settings">
          <EditableList
            label="Airports"
            items={(cfg.watchedAirports as string[]) || []}
            onChange={items => updateConfig({ watchedAirports: items })}
            placeholder="e.g. MCI"
          />
        </ConfigSection>
      );

    case 'conflict':
      return (
        <ConfigSection title="Conflict Monitor Settings">
          <ConfigNumberField
            label="Max Events"
            value={(cfg.maxEvents as number) || 50}
            onChange={v => updateConfig({ maxEvents: v })}
            min={10} max={200}
          />
        </ConfigSection>
      );

    case 'wildfires':
      return (
        <ConfigSection title="Wildfire Settings">
          <ToggleRow
            label="National View"
            value={(cfg.region as string) === 'us'}
            onChange={v => updateConfig({ region: v ? 'us' : 'world' })}
          />
        </ConfigSection>
      );

    case 'webcams':
      return (
        <ConfigSection title="Traffic Cam Settings">
          <div className="space-y-2">
            <ToggleRow
              label="Load All 341 Cameras"
              value={(cfg.loadAllCameras as boolean) || false}
              onChange={v => updateConfig({ loadAllCameras: v })}
            />
            {!(cfg.loadAllCameras as boolean) && (
              <>
                <EditableList
                  label="Camera IDs"
                  items={(cfg.cameraIds as string[]) || []}
                  onChange={items => updateConfig({ cameraIds: items })}
                  placeholder="e.g. M070WBIPC-11"
                />
                <EditableList
                  label="Camera Names"
                  items={(cfg.cameraNames as string[]) || []}
                  onChange={items => updateConfig({ cameraNames: items })}
                  placeholder="e.g. I-70 @ 18th"
                />
              </>
            )}
            {(cfg.loadAllCameras as boolean) && (
              <EditableList
                label="Corridor Filter"
                items={(cfg.corridorFilter as string[]) || []}
                onChange={items => updateConfig({ corridorFilter: items })}
                placeholder="e.g. M070"
              />
            )}
            <ConfigNumberField
              label="Rotate Interval (sec)"
              value={(cfg.rotateIntervalSeconds as number) || 15}
              onChange={v => updateConfig({ rotateIntervalSeconds: v })}
              min={5} max={300}
            />
          </div>
        </ConfigSection>
      );

    case 'camera':
      return (
        <ConfigSection title="Camera Settings">
          <div className="space-y-2">
            <ConfigTextField
              label="Label"
              value={(cfg.label as string) || ''}
              onChange={v => updateConfig({ label: v })}
            />
            <ConfigTextField
              label="Stream URL"
              value={(cfg.url as string) || ''}
              onChange={v => updateConfig({ url: v })}
              placeholder="http://..."
            />
            <ToggleRow
              label="Muted"
              value={(cfg.isMuted as boolean) ?? true}
              onChange={v => updateConfig({ isMuted: v })}
            />
          </div>
        </ConfigSection>
      );

    case 'liveTV':
      return (
        <ConfigSection title="Live TV Settings">
          <div className="space-y-2">
            <ConfigTextField
              label="Channel"
              value={(cfg.selectedChannelName as string) || ''}
              onChange={v => updateConfig({ selectedChannelName: v })}
            />
            <ConfigTextField
              label="Stream URL"
              value={(cfg.selectedChannelURL as string) || ''}
              onChange={v => updateConfig({ selectedChannelURL: v })}
              placeholder="http://..."
            />
            <ToggleRow
              label="Muted"
              value={(cfg.isMuted as boolean) ?? true}
              onChange={v => updateConfig({ isMuted: v })}
            />
            <ToggleRow
              label="Show IPTV Channels"
              value={(cfg.showIPTV as boolean) || false}
              onChange={v => updateConfig({ showIPTV: v })}
            />
          </div>
        </ConfigSection>
      );

    case 'calendar':
    case 'reminders':
    case 'health':
    case 'homeKit':
    case 'systemStatus':
      return (
        <ConfigSection title="Settings">
          <p className="text-[11px] text-white/25 italic">No additional settings for this widget type.</p>
        </ConfigSection>
      );

    default:
      return null;
  }
}
