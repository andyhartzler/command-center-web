'use client';
import { useRef, useEffect, useState } from 'react';
import { type DashboardPage } from '@/types/dashboard';
import { WidgetContainer } from './WidgetContainer';
import { WidgetFactory } from '../widgets/WidgetFactory';
import { computeCellRect } from '@/lib/grid';

interface WidgetGridProps {
  page: DashboardPage;
}

export function WidgetGrid({ page }: WidgetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Row-major order for entrance stagger
  const ordered = [...page.widgets].sort(
    (a, b) => a.position.row - b.position.row || a.position.column - b.position.column,
  );
  const orderIndex = new Map(ordered.map((w, i) => [w.id, i]));

  return (
    <div ref={containerRef} className="widget-grid burnin-orbit">
      {dims &&
        page.widgets.map((widget) => {
          const rect = computeCellRect(page, widget, { width: dims.w - 32, height: dims.h - 32 });
          return (
            <div
              key={`${page.id}-${widget.id}`}
              className="stagger-enter"
              style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                animationDelay: `${Math.min(orderIndex.get(widget.id) ?? 0, 20) * 40}ms`,
              }}
            >
              <WidgetContainer widget={widget} style={{ width: '100%', height: '100%' }}>
                <WidgetFactory widget={widget} />
              </WidgetContainer>
            </div>
          );
        })}
    </div>
  );
}
