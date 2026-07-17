// Shared grid math consumed by both EditorGrid and WidgetGrid so the
// editor is exactly WYSIWYG with the display.

import { type DashboardPage } from '@/types/dashboard';
import { type DashboardWidget } from '@/types/widget';
import { FAMILY_GRID_SIZE } from '@/types/widget';

export const GRID_SPACING = 4;
export const GRID_PADDING = 16;

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function widgetSize(widget: DashboardWidget): { columns: number; rows: number } {
  return widget.size ?? FAMILY_GRID_SIZE[widget.family];
}

/**
 * Compute a widget's pixel rect inside a container. The container size is the
 * inner area (already excluding GRID_PADDING); both editor and display must
 * apply the same padding outside this function.
 */
export function computeCellRect(
  page: DashboardPage,
  widget: DashboardWidget,
  container: { width: number; height: number },
): CellRect {
  const gridCols = page.gridColumns ?? 24;
  const gridRows = page.gridRows ?? 16;

  const totalHSpacing = GRID_SPACING * (gridCols + 1);
  const totalVSpacing = GRID_SPACING * (gridRows + 1);
  const cellW = Math.max(1, (container.width - totalHSpacing) / gridCols);
  const cellH = Math.max(1, (container.height - totalVSpacing) / gridRows);

  const { columns, rows } = widgetSize(widget);
  const { column, row } = widget.position;

  return {
    x: GRID_SPACING + column * (cellW + GRID_SPACING),
    y: GRID_SPACING + row * (cellH + GRID_SPACING),
    width: columns * cellW + (columns - 1) * GRID_SPACING,
    height: rows * cellH + (rows - 1) * GRID_SPACING,
  };
}
