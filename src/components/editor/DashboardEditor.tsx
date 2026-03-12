'use client';
import { useState, useRef, useEffect } from 'react';
import { Monitor, ShieldAlert, Plus, Play, ChevronDown } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import { WidgetSidebar } from './WidgetSidebar';
import { EditorGrid } from './EditorGrid';
import { WidgetConfigPanel } from './WidgetConfigPanel';

export function DashboardEditor() {
  const {
    pages,
    currentPageIndex,
    setCurrentPageIndex,
    setDisplayMode,
    addPage,
    deletePage,
    renamePage,
    appMode,
    setAppMode,
    eocScope,
    setEocScope,
  } = useAppState();

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [contextMenuPage, setContextMenuPage] = useState<{ index: number; x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [eocMenuOpen, setEocMenuOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const eocMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const currentPage = pages[currentPageIndex];

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuPage(null);
        setIsRenaming(false);
      }
      if (eocMenuRef.current && !eocMenuRef.current.contains(e.target as Node)) {
        setEocMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus rename input when renaming
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handlePageContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenuPage({ index, x: e.clientX, y: e.clientY });
    setIsRenaming(false);
  };

  const handleRenameStart = () => {
    if (contextMenuPage === null) return;
    setRenameValue(pages[contextMenuPage.index].name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    if (contextMenuPage === null) return;
    if (renameValue.trim()) {
      renamePage(contextMenuPage.index, renameValue.trim());
    }
    setContextMenuPage(null);
    setIsRenaming(false);
  };

  const handleDeletePage = () => {
    if (contextMenuPage === null) return;
    deletePage(contextMenuPage.index);
    setContextMenuPage(null);
  };

  const scopeDisplayName = (scope: string) => {
    switch (scope) {
      case 'kc': return 'Kansas City';
      case 'usa': return 'United States';
      case 'global': return 'Global';
      default: return scope;
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0f172a] overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 h-11 border-b border-white/[0.08] flex items-center px-4 gap-3 bg-[#0f172a]/90 backdrop-blur-xl">
        {/* Left: mode toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-white/[0.04] rounded-lg">
          <button
            onClick={() => setAppMode('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              appMode === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Monitor size={11} />
            Dashboard
          </button>

          {appMode === 'eoc' ? (
            <div className="relative" ref={eocMenuRef}>
              <button
                onClick={() => setEocMenuOpen(!eocMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-600 text-white transition-colors"
              >
                <ShieldAlert size={11} />
                EOC
                <span className="text-[9px] font-bold font-mono opacity-70">
                  {eocScope.toUpperCase()}
                </span>
                <ChevronDown size={8} className="opacity-50" />
              </button>
              {eocMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#1a2438] border border-white/[0.08] rounded-xl shadow-xl z-50 py-1 backdrop-blur-xl">
                  {(['kc', 'usa', 'global'] as const).map(scope => (
                    <button
                      key={scope}
                      onClick={() => { setEocScope(scope); setEocMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 flex items-center justify-between"
                    >
                      {scopeDisplayName(scope)}
                      {eocScope === scope && <span className="text-blue-400 text-[10px]">&#10003;</span>}
                    </button>
                  ))}
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={() => { setAppMode('dashboard'); setEocMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 flex items-center gap-1.5"
                  >
                    <Monitor size={10} /> Switch to Dashboard
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAppMode('eoc')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-white/40 hover:text-white/60 transition-colors"
            >
              <ShieldAlert size={11} />
              EOC
            </button>
          )}
        </div>

        {/* Divider */}
        {appMode === 'dashboard' && (
          <>
            <div className="w-px h-5 bg-white/10" />

            {/* Page tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {pages.map((page, i) => {
                const isSelected = i === currentPageIndex;
                return (
                  <button
                    key={page.id}
                    onClick={() => {
                      setCurrentPageIndex(i);
                      setSelectedWidgetId(null);
                    }}
                    onContextMenu={(e) => handlePageContextMenu(e, i)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-blue-600/10 text-white/90'
                        : 'text-white/35 hover:text-white/55 hover:bg-white/5'
                    }`}
                  >
                    {page.name}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-px rounded-full ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/[0.08] text-white/40'
                      }`}
                    >
                      {page.widgets.length}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={addPage}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Right: display button — prominent */}
        <button
          onClick={() => setDisplayMode(true)}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25"
        >
          <Play size={12} fill="currentColor" />
          Display
        </button>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Widget sidebar */}
        <div className="shrink-0 w-[280px] border-r border-white/[0.08] overflow-y-auto bg-[#131c2e]/80">
          <WidgetSidebar />
        </div>

        {/* Center: Editor grid */}
        <div className="flex-1 overflow-hidden min-w-0">
          {currentPage ? (
            <EditorGrid
              selectedWidgetId={selectedWidgetId}
              onSelectWidget={setSelectedWidgetId}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Monitor size={32} className="mx-auto mb-3 text-white/10" />
                <p className="text-sm text-white/30">No Pages</p>
                <p className="text-xs text-white/15 mt-1">Add a page to start building your dashboard</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Config panel (only when widget selected) */}
        {selectedWidgetId && (
          <div className="shrink-0 w-[280px] border-l border-white/[0.08] overflow-y-auto bg-[#131c2e]/80">
            <WidgetConfigPanel
              widgetId={selectedWidgetId}
              onClose={() => setSelectedWidgetId(null)}
            />
          </div>
        )}
      </div>

      {/* Context menu for page tabs */}
      {contextMenuPage && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] bg-[#1a2438] border border-white/[0.1] rounded-xl shadow-2xl py-1 min-w-[160px] backdrop-blur-xl"
          style={{ left: contextMenuPage.x, top: contextMenuPage.y }}
        >
          {isRenaming ? (
            <div className="px-2 py-1">
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') { setContextMenuPage(null); setIsRenaming(false); }
                }}
                onBlur={handleRenameSubmit}
                className="w-full bg-[#1a2438] border border-white/[0.1] rounded px-2 py-1 text-xs text-white/90 outline-none focus:border-blue-500/50"
              />
            </div>
          ) : (
            <>
              <button
                onClick={handleRenameStart}
                className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
              >
                Rename...
              </button>
              <div className="border-t border-white/5 my-1" />
              <button
                onClick={handleDeletePage}
                disabled={pages.length <= 1}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Delete Page
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
