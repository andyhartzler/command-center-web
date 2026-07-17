'use client';
import { X } from 'lucide-react';
import { useAppState } from '@/context/AppState';
import { BACKGROUND_THEMES, type BackgroundTheme } from '@/types/dashboard';

const ROTATE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Off', value: null },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '120s', value: 120 },
  { label: '300s', value: 300 },
];

interface PageSettingsSheetProps {
  pageIndex: number;
  onClose: () => void;
}

export function PageSettingsSheet({ pageIndex, onClose }: PageSettingsSheetProps) {
  const { pages, updatePageSettings } = useAppState();
  const page = pages[pageIndex];

  if (!page) {
    return (
      <div className="p-4">
        <p className="text-xs text-white/30">Page not found</p>
      </div>
    );
  }

  const activeRotate = page.autoRotateSeconds ?? null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <h2 className="text-xs font-bold text-white/30 uppercase tracking-[var(--tracking-caps)]">Page Settings</h2>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-4 py-4 space-y-5">
          {/* Page identity */}
          <div>
            <div className="text-sm font-semibold text-white/90">{page.name}</div>
            <div className="text-xs text-white/30">
              <span className="font-mono">{page.widgets.length}</span> widgets
            </div>
          </div>

          {/* Background theme picker */}
          <div>
            <div className="text-xs font-bold text-white/25 uppercase tracking-[var(--tracking-caps)] mb-2">
              Themes
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(BACKGROUND_THEMES) as [BackgroundTheme, { displayName: string; className: string }][]).map(
                ([key, theme]) => {
                  const isActive = page.backgroundTheme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => updatePageSettings(pageIndex, { backgroundTheme: key })}
                      className={`rounded-lg overflow-hidden border text-left transition-colors ${
                        isActive
                          ? 'border-accent-500/60'
                          : 'border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <div className={`h-16 w-full ${theme.className}`} />
                      <div
                        className={`px-2 py-1.5 text-xs font-medium ${
                          isActive
                            ? 'bg-accent-500/10 text-accent-300'
                            : 'bg-white/[0.02] text-white/50'
                        }`}
                      >
                        {theme.displayName}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Auto-rotate stepper */}
          <div>
            <div className="text-xs font-bold text-white/25 uppercase tracking-[var(--tracking-caps)] mb-2">
              Auto-Rotate
            </div>
            <div className="grid grid-cols-3 gap-1">
              {ROTATE_OPTIONS.map(opt => {
                const isActive = activeRotate === opt.value;
                return (
                  <button
                    key={opt.label}
                    onClick={() => updatePageSettings(pageIndex, { autoRotateSeconds: opt.value })}
                    className={`px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      opt.value !== null ? 'font-mono' : 'font-medium'
                    } ${
                      isActive
                        ? 'bg-accent-500/15 border border-accent-500/30 text-accent-500'
                        : 'bg-white/[0.02] border border-white/[0.04] text-white/40 hover:bg-white/5 hover:text-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/25 mt-2 leading-relaxed">
              Advances to the next page automatically in display mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
