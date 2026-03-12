'use client';
import { type CSSProperties } from 'react';
import { type DashboardWidget, WIDGET_TYPE_META } from '@/types/widget';

interface WidgetContainerProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  style?: CSSProperties;
}

const MAP_TYPES = new Set(['earthquakes', 'airTraffic', 'conflict', 'wildfires']);
const VIDEO_TYPES = new Set(['webcams', 'camera', 'liveTV']);

export function WidgetContainer({ widget, children, style }: WidgetContainerProps) {
  const widgetType = widget.widgetConfig.type;
  const isMap = MAP_TYPES.has(widgetType);
  const isVideo = VIDEO_TYPES.has(widgetType);
  const meta = WIDGET_TYPE_META[widgetType];
  const accentColor = meta?.color ?? '#3b82f6';

  // Convert hex color to rgba for glow
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const radius = isMap ? 16 : 24;
  const glowAlpha = isMap ? 0.04 : 0.08;
  const darkAlpha = isMap ? 0.6 : 0.4;

  const containerStyle: CSSProperties = {
    ...style,
    opacity: widget.style.opacity,
    borderRadius: radius,
    // Per-widget glow color
    ['--widget-glow' as string]: hexToRgba(accentColor, glowAlpha),
    boxShadow: [
      `0 ${isMap ? 4 : 8}px ${isMap ? 12 : 20}px -4px ${hexToRgba(accentColor, glowAlpha)}`,
      `0 ${isMap ? 2 : 6}px ${isMap ? 8 : 16}px -2px rgba(0, 0, 0, ${darkAlpha})`,
    ].join(', '),
  };

  return (
    <div
      className={isMap || isVideo ? 'widget-glass-map' : 'widget-glass'}
      style={containerStyle}
    >
      {children}
    </div>
  );
}
