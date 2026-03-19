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

type DragMode = 'move' | 'resize';

export function EditorGrid({ selectedWidgetId, onSelectWidget }: EditorGridProps) {
  const { pages, currentPageIndex, deleteWidget, moveWidget, updateWidget } = useAppState();
  const currentPage = pages[currentPageIndex];
  const gridRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragWidgetId, setDragWidgetId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('move');
  const [dragTarget, setDragTarget] = useState<{ col: number; row: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ cols: number; rows: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const pointerTypeRef = useRef<string>('mouse');

  const handleCellClick = useCallback(() => {
    onSelectWidget(null);
  }, [onSelectWidget]);

  const handleWidgetClick = useCallback(
    (e: React.PointerEvent, widgetId: string) => {
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

  // Move drag start
  const handleDragStart = useCallback((e: React.PointerEvent, widgetId: string) => {
    pointerTypeRef.current = e.pointerType;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragWidgetId(widgetId);
    setDragMode('move');
    isDragging.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  // Resize drag start
  const handleResizeStart = useCallback((e: React.PointerEvent, widgetId: string) => {
    e.stopPropagation();
    e.preventDefault();
    pointerTypeRef.current = e.pointerType;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragWidgetId(widgetId);
    setDragMode('resize');
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragWidgetId || !dragStartPos.current || !gridRef.current) return;

    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    const threshold = pointerTypeRef.current === 'touch' ? 15 : 5;
    if (dx < threshold && dy < threshold && dragMode === 'move') return;

    isDragging.current = true;
    const gridRect = gridRef.current.getBoundingClientRect();
    const cellW = gridRect.width / GRID_COLUMNS;
    const cellH = gridRect.height / GRID_ROWS;

    const col = Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor((e.clientX - gridRect.left) / cellW)));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((e.clientY - gridRect.top) / cellH)));

    const widget = currentPage?.widgets.find(w => w.id === dragWidgetId);
    if (!widget) return;
    const currentSize = widget.size ?? FAMILY_GRID_SIZE[widget.family];

    if (dragMode === 'move') {
      const clampedCol = Math.max(0, Math.min(GRID_COLUMNS - currentSize.columns, col));
      const clampedRow = Math.max(0, Math.min(GRID_ROWS - currentSize.rows, row));
      setDragTarget({ col: clampedCol, row: clampedRow });
    } else {
      // Resize mode: compute new size based on pointer position relative to widget origin
      const newCols = Math.max(2, Math.min(GRID_COLUMNS - widget.position.column, col - widget.position.column + 1));
      const newRows = Math.max(2, Math.min(GRID_ROWS - widget.position.row, row - widget.position.row + 1));
      setResizePreview({ cols: newCols, rows: newRows });
    }
  }, [dragWidgetId, dragMode, currentPage]);

  const handleDragEnd = useCallback(() => {
    if (dragWidgetId && isDragging.current) {
      if (dragMode === 'move' && dragTarget) {
        moveWidget(dragWidgetId, { column: dragTarget.col, row: dragTarget.row });
      } else if (dragMode === 'resize' && resizePreview) {
        updateWidget(dragWidgetId, {
          size: { columns: resizePreview.cols, rows: resizePreview.rows },
        });
      }
    }
    setDragWidgetId(null);
    setDragTarget(null);
    setResizePreview(null);
    dragStartPos.current = null;
    setTimeout(() => { isDragging.current = false; }, 0);
  }, [dragWidgetId, dragMode, dragTarget, resizePreview, moveWidget, updateWidget]);

  if (!currentPage) return null;

  const theme = BACKGROUND_THEMES[currentPage.backgroundTheme];

  return (
    <div
      className={`w-full h-full p-2 ${theme.className}`}
      onClick={handleCellClick}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerLeave={handleDragEnd}
      onPointerCancel={handleDragEnd}
      style={{ touchAction: 'none' }}
    >
      <div
        ref={gridRef}
        className="w-full h-full relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: '3px',
        }}
      >
        {/* Subtle grid dots at intersections instead of painting every cell */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: `${100 / GRID_COLUMNS}% ${100 / GRID_ROWS}%`,
          }}
        />

        {/* Drag/move highlight */}
        {dragTarget && dragWidgetId && dragMode === 'move' && (() => {
          const widget = currentPage.widgets.find(w => w.id === dragWidgetId);
          if (!widget) return null;
          const size = widget.size ?? FAMILY_GRID_SIZE[widget.family];
          return (
            <div
              style={{
                gridColumn: `${dragTarget.col + 1} / span ${size.columns}`,
                gridRow: `${dragTarget.row + 1} / span ${size.rows}`,
              }}
              className="rounded-xl bg-[#6b8aab]/10 border-2 border-[#6b8aab]/40 pointer-events-none z-10 transition-all duration-100"
            />
          );
        })()}

        {/* Resize preview */}
        {resizePreview && dragWidgetId && dragMode === 'resize' && (() => {
          const widget = currentPage.widgets.find(w => w.id === dragWidgetId);
          if (!widget) return null;
          return (
            <div
              style={{
                gridColumn: `${widget.position.column + 1} / span ${resizePreview.cols}`,
                gridRow: `${widget.position.row + 1} / span ${resizePreview.rows}`,
              }}
              className="rounded-xl bg-green-500/10 border-2 border-green-500/40 pointer-events-none z-10 transition-all duration-75"
            >
              <div className="absolute bottom-1 right-1 text-[9px] font-mono text-green-400/70 bg-black/50 px-1 rounded">
                {resizePreview.cols}x{resizePreview.rows}
              </div>
            </div>
          );
        })()}

        {/* Placed widgets with live previews */}
        {currentPage.widgets.map(widget => {
          const size = widget.size ?? FAMILY_GRID_SIZE[widget.family];
          const isSelected = widget.id === selectedWidgetId;
          const isBeingDragged = widget.id === dragWidgetId && isDragging.current && dragMode === 'move';
          const isBeingResized = widget.id === dragWidgetId && isDragging.current && dragMode === 'resize';
          const meta = WIDGET_TYPE_META[widget.widgetConfig.type];

          const displayCols = isBeingResized && resizePreview ? resizePreview.cols : size.columns;
          const displayRows = isBeingResized && resizePreview ? resizePreview.rows : size.rows;

          return (
            <div
              key={widget.id}
              onPointerDown={e => handleDragStart(e, widget.id)}
              onClick={e => handleWidgetClick(e as unknown as React.PointerEvent, widget.id)}
              className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-150 group ${
                isSelected
                  ? 'ring-2 ring-[#6b8aab] ring-offset-1 ring-offset-transparent'
                  : 'hover:ring-1 hover:ring-white/20'
              } ${isBeingDragged ? 'opacity-40' : 'opacity-100'}`}
              style={{
                gridColumn: `${widget.position.column + 1} / span ${displayCols}`,
                gridRow: `${widget.position.row + 1} / span ${displayRows}`,
                zIndex: isSelected ? 5 : 1,
                touchAction: 'none',
              }}
            >
              {/* Live widget preview */}
              <div className="w-full h-full pointer-events-none">
                <WidgetFactory widget={widget} />
              </div>

              {/* Delete button - visible on hover OR when selected */}
              <button
                onClick={e => handleDelete(e, widget.id)}
                className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center transition-opacity pointer-events-auto hover:bg-red-500 z-10 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <X size={10} className="text-white" />
              </button>

              {/* Widget type label - visible on hover OR when selected */}
              <div className={`absolute top-1.5 left-1.5 transition-opacity pointer-events-none z-10 ${
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
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

              {/* Resize handle (bottom-right corner) - visible on hover OR when selected */}
              <div
                onPointerDown={e => handleResizeStart(e, widget.id)}
                className={`absolute bottom-0 right-0 w-5 h-5 cursor-se-resize transition-opacity pointer-events-auto z-10 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <svg
                  width="12" height="12"
                  viewBox="0 0 12 12"
                  className="absolute bottom-1 right-1 text-white/30"
                >
                  <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* Selection border overlay */}
              {isSelected && (
                <div className="absolute inset-0 rounded-2xl border-2 border-[#6b8aab]/50 pointer-events-none z-[6]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
