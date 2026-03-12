'use client';
import { useRef, useEffect, useState } from 'react';
import { type DashboardPage } from '@/types/dashboard';
import { WidgetContainer } from './WidgetContainer';
import { WidgetFactory } from '../widgets/WidgetFactory';

interface WidgetGridProps {
  page: DashboardPage;
}

const SPACING = 8; // matches Swift spacing = 8

/**
 * Faithfully replicates Swift WidgetGridView.
 *
 * Swift computes:
 *   totalHSpacing = spacing * (gridColumns + 1)
 *   totalVSpacing = spacing * (gridRows + 1)
 *   cellWidth  = (containerWidth  - totalHSpacing) / gridColumns
 *   cellHeight = (containerHeight - totalVSpacing) / gridRows
 *
 * Each widget is placed via:
 *   width  = cols * cellWidth  + (cols - 1) * spacing
 *   height = rows * cellHeight + (rows - 1) * spacing
 *   x = spacing + position.column * (cellWidth  + spacing)
 *   y = spacing + position.row    * (cellHeight + spacing)
 *
 * NOTE: Swift positions are 0-indexed. Our demo data also uses 0-indexed positions.
 */
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

  const gridCols = page.gridColumns ?? 12;
  const gridRows = page.gridRows ?? 8;

  let cellW = 0;
  let cellH = 0;

  if (dims) {
    const totalHSpacing = SPACING * (gridCols + 1);
    const totalVSpacing = SPACING * (gridRows + 1);
    cellW = Math.max(1, (dims.w - totalHSpacing) / gridCols);
    cellH = Math.max(1, (dims.h - totalVSpacing) / gridRows);
  }

  return (
    <div ref={containerRef} className="widget-grid">
      {dims &&
        page.widgets.map((widget) => {
          const wCols = widget.size?.columns ?? 3;
          const wRows = widget.size?.rows ?? 2;
          const col = widget.position.column;
          const row = widget.position.row;

          const width = wCols * cellW + (wCols - 1) * SPACING;
          const height = wRows * cellH + (wRows - 1) * SPACING;
          const x = SPACING + col * (cellW + SPACING);
          const y = SPACING + row * (cellH + SPACING);

          return (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width,
                height,
              }}
            >
              <WidgetFactory widget={widget} />
            </WidgetContainer>
          );
        })}
    </div>
  );
}
