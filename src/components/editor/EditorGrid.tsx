'use client';
import { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import { FAMILY_GRID_SIZE, WIDGET_TYPE_META } from '@/types/widget';
import { GRID_COLUMNS, GRID_ROWS, BACKGROUND_THEMES } from '@/types/dashboard';
import { WidgetFactory } from '../widgets/WidgetFactory';

interface EditorGridProps {
  selectedWidgetId: string | null;
  onSelectWidget: (id: string | null) => void;
}

export function EditorGrid({ selectedWidgetId, onSelectWidget }: EditorGridProps) {
  const { pages, currentPageIndex, deleteWidget, moveWidget } = useAppState();
  const currentPage = pages[currentPageIndex];
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragWidgetId, setDragWidgetId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ col: number; row: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const handleCellClick = useCallback(() => {
    onSelectWidget(null);
  }, [onSelectWidget]);

  const handleWidgetClick = useCallback(
    (e: React.MouseEvent, widgetId: string) => {
      e.stopPropagation();
      if (!isDragging.current) {
        onSelectWidget(widgetId);
      }
    },
    [onSelectWidget]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, widgetId: string) => {
      e.stopPropagation();
      deleteWidget(widgetId);
      if (selectedWidgetId === widgetId) {
        onSelectWidget(null);
      }
    },
    [deleteWidget, selectedWidgetId, onSelectWidget]
  );

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent, widgetId: string) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragWidgetId(widgetId);
    isDragging.current = false;
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragWidgetId || !dragStartPos.current || !gridRef.current) return;

    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    if (dx < 5 && dy < 5) return;

    isDragging.current = true;
    const gridRect = gridRef.current.getBoundingClientRect();
    const cellW = gridRect.width / GRID_COLUMNS;
    const cellH = gridRect.height / GRID_ROWS;

    // 0-indexed position from mouse coordinates
    const col = Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor((e.clientX - gridRect.left) / cellW)));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((e.clientY - gridRect.top) / cellH)));

    const widget = currentPage?.widgets.find(w => w.id === dragWidgetId);
    if (!widget) return;
    const size = widget.size ?? FAMILY_GRID_SIZE[widget.family];

    const clampedCol = Math.max(0, Math.min(GRID_COLUMNS - size.columns, col));
    const clampedRow = Math.max(0, Math.min(GRID_ROWS - size.rows, row));

    setDragTarget({ col: clampedCol, row: clampedRow });
  }, [dragWidgetId, currentPage]);

  const handleDragEnd = useCallback(() => {
    if (dragWidgetId && dragTarget && isDragging.current) {
      moveWidget(dragWidgetId, { column: dragTarget.col, row: dragTarget.row });
    }
    setDragWidgetId(null);
    setDragTarget(null);
    dragStartPos.current = null;
    // Reset isDragging after a tick so click handler can read it
    setTimeout(() => { isDragging.current = false; }, 0);
  }, [dragWidgetId, dragTarget, moveWidget]);

  if (!currentPage) return null;

  // Build empty cell positions
  const occupiedCells = new Set<string>();
  for (const widget of currentPage.widgets) {
    const size = widget.size ?? FAMILY_GRID_SIZE[widget.family];
    for (let r = widget.position.row; r < widget.position.row + size.rows; r++) {
      for (let c = widget.position.column; c < widget.position.column + size.columns; c++) {
        occupiedCells.add(`${c},${r}`);
      }
    }
  }

  // Positions are 0-indexed; CSS grid lines are 1-indexed (add 1 for placement)
  const emptyCells: { col: number; row: number }[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLUMNS; c++) {
      if (!occupiedCells.has(`${c},${r}`)) {
        emptyCells.push({ col: c, row: r });
      }
    }
  }

  const theme = BACKGROUND_THEMES[currentPage.backgroundTheme];

  return (
    <div
      className={`w-full h-full p-2 ${theme.className}`}
      onClick={handleCellClick}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      <div
        ref={gridRef}
        className="w-full h-full relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: '6px',
        }}
      >
        {/* Empty cells - subtle grid squares */}
        {emptyCells.map(({ col, row }) => (
          <div
            key={`empty-${col}-${row}`}
            style={{
              gridColumn: `${col + 1} / span 1`,
              gridRow: `${row + 1} / span 1`,
            }}
            className="rounded-md bg-white/[0.015] border border-white/[0.03]"
          />
        ))}

        {/* Drag highlight */}
        {dragTarget && dragWidgetId && (() => {
          const widget = currentPage.widgets.find(w => w.id === dragWidgetId);
          if (!widget) return null;
          const size = FAMILY_GRID_SIZE[widget.family];
          return (
            <div
              style={{
                gridColumn: `${dragTarget.col + 1} / span ${size.columns}`,
                gridRow: `${dragTarget.row + 1} / span ${size.rows}`,
              }}
              className="rounded-xl bg-blue-500/10 border-2 border-blue-500/40 pointer-events-none z-10 transition-all duration-100"
            />
          );
        })()}

        {/* Placed widgets with live previews */}
        {currentPage.widgets.map(widget => {
          const size = widget.size ?? FAMILY_GRID_SIZE[widget.family];
          const isSelected = widget.id === selectedWidgetId;
          const isBeingDragged = widget.id === dragWidgetId && isDragging.current;
          const meta = WIDGET_TYPE_META[widget.widgetConfig.type];

          return (
            <div
              key={widget.id}
              onMouseDown={e => handleDragStart(e, widget.id)}
              onClick={e => handleWidgetClick(e, widget.id)}
              className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-150 group ${
                isSelected
                  ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent'
                  : 'hover:ring-1 hover:ring-white/20'
              } ${isBeingDragged ? 'opacity-40' : 'opacity-100'}`}
              style={{
                gridColumn: `${widget.position.column + 1} / span ${size.columns}`,
                gridRow: `${widget.position.row + 1} / span ${size.rows}`,
                zIndex: isSelected ? 5 : 1,
              }}
            >
              {/* Live widget preview */}
              <div className="w-full h-full pointer-events-none">
                <WidgetFactory widget={widget} />
              </div>

              {/* Delete button (top-right, visible on hover) */}
              <button
                onClick={e => handleDelete(e, widget.id)}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto hover:bg-red-500 z-10"
              >
                <X size={10} className="text-white" />
              </button>

              {/* Widget type label (top-left, visible on hover) */}
              <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm"
                  style={{
                    backgroundColor: meta.color + '40',
                    color: '#fff',
                  }}
                >
                  {meta.displayName}
                </span>
              </div>

              {/* Selection border overlay */}
              {isSelected && (
                <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/50 pointer-events-none z-[6]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
