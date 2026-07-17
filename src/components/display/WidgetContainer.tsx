'use client';
import { type CSSProperties } from 'react';
import { type DashboardWidget, WIDGET_TYPE_META } from '@/types/widget';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { useActiveMoment } from './MomentLayer';

interface WidgetContainerProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  style?: CSSProperties;
}

export function WidgetContainer({ widget, children, style }: WidgetContainerProps) {
  const meta = WIDGET_TYPE_META[widget.widgetConfig.type];
  const isAmbient = meta?.tier === 'ambient';
  const { activeWidgetId } = useActiveMoment();
  const hasMoment = activeWidgetId === widget.id;

  const radius = widget.style.cornerRadius && widget.style.cornerRadius !== 24
    ? widget.style.cornerRadius
    : undefined; // undefined = material default (--radius-card)

  const containerStyle: CSSProperties = {
    ...style,
    opacity: widget.style.opacity,
    borderRadius: radius,
    border: widget.style.showBorder === false ? 'none' : undefined,
    containerType: 'size',
    transform: hasMoment ? 'scale(1.015)' : undefined,
    transition: 'transform 500ms var(--ease-spring)',
  };

  return (
    <div
      className={isAmbient ? 'material-well' : 'material-card'}
      style={containerStyle}
    >
      <WidgetErrorBoundary widgetId={widget.id}>
        {children}
      </WidgetErrorBoundary>
      {hasMoment && <div className="moment-glow" aria-hidden />}
    </div>
  );
}
