'use client';
import { type CSSProperties } from 'react';
import { type DashboardWidget } from '@/types/widget';

interface WidgetContainerProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  style?: CSSProperties;
}

const MAP_TYPES = new Set(['earthquakes', 'airTraffic', 'conflict', 'wildfires', 'findMyFriends']);
const VIDEO_TYPES = new Set(['webcams', 'camera', 'liveTV']);

export function WidgetContainer({ widget, children, style }: WidgetContainerProps) {
  const widgetType = widget.widgetConfig.type;
  const isMap = MAP_TYPES.has(widgetType);
  const isVideo = VIDEO_TYPES.has(widgetType);

  const radius = isMap || isVideo ? 20 : 24;

  const containerStyle: CSSProperties = {
    ...style,
    opacity: widget.style.opacity,
    borderRadius: radius,
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
