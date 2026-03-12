'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Satellite,
  WifiOff,
  Server,
  Plane,
  Shield,
  Sparkles,
  Ruler,
  Image,
  Bug,
} from 'lucide-react';

const CURRENT_VERSION = '2.1';
const STORAGE_KEY = `shadowbroker_changelog_v${CURRENT_VERSION}`;

const NEW_FEATURES = [
  {
    icon: <Satellite size={14} className="text-blue-400" />,
    title: 'NASA GIBS Satellite Imagery',
    desc: 'Real-time and historical satellite imagery layers from NASA Global Imagery Browse Services.',
  },
  {
    icon: <WifiOff size={14} className="text-red-400" />,
    title: 'Internet Outage Detection',
    desc: 'Live monitoring of global internet outages with affected region mapping.',
  },
  {
    icon: <Server size={14} className="text-green-400" />,
    title: 'Data Center Mapping',
    desc: 'Major data center locations worldwide with provider details.',
  },
  {
    icon: <Plane size={14} className="text-cyan-400" />,
    title: 'Enhanced Aircraft Database',
    desc: '500+ tracked aircraft with expanded military and civil registries.',
  },
  {
    icon: <Shield size={14} className="text-purple-400" />,
    title: 'Tactical Mode',
    desc: 'Minimal UI mode for focused operational monitoring.',
  },
  {
    icon: <Sparkles size={14} className="text-yellow-400" />,
    title: 'Bloom & Sharpen Effects',
    desc: 'Post-processing visual filters for enhanced map readability.',
  },
  {
    icon: <Ruler size={14} className="text-orange-400" />,
    title: 'Scale Bar',
    desc: 'Dynamic distance scale with metric and imperial unit support.',
  },
  {
    icon: <Image size={14} className="text-pink-400" />,
    title: 'Wikipedia Image Integration',
    desc: 'Automatic thumbnail fetching for selected entities from Wikipedia.',
  },
];

const BUG_FIXES = [
  'Fixed memory leak in WebSocket reconnection handler',
  'Resolved layer z-index conflicts when toggling multiple overlays',
  'Corrected satellite position interpolation near the antimeridian',
  'Improved news feed deduplication accuracy',
  'Fixed tooltip positioning at map edges',
];

export function useChangelog() {
  const [showChangelog, setShowChangelog] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShowChangelog(true);
  }, []);
  return { showChangelog, setShowChangelog };
}

interface GlobalChangelogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalChangelog({ isOpen, onClose }: GlobalChangelogProps) {
  const [dontShow, setDontShow] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000]"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none">
        <div
          className="w-[560px] max-h-[85vh] bg-[#0a0e1a]/95 border border-cyan-900/30 rounded-xl shadow-[0_0_80px_rgba(0,200,255,0.08)] pointer-events-auto flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-400 tracking-widest">
                    v{CURRENT_VERSION}
                  </div>
                  <h2 className="text-sm font-bold tracking-widest text-white/90 font-mono">
                    WHAT&apos;S NEW IN v{CURRENT_VERSION}
                  </h2>
                </div>
                <p className="text-[9px] text-white/25 font-mono tracking-widest mt-1">
                  COMMAND CENTER PLATFORM UPDATE
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg border border-white/10 hover:border-red-500/50 flex items-center justify-center text-white/40 hover:text-red-400 transition-all hover:bg-red-950/20"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* New Features */}
            <div>
              <div className="text-[9px] font-mono tracking-[0.2em] text-cyan-400 font-bold mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                NEW CAPABILITIES
              </div>
              <div className="space-y-2">
                {NEW_FEATURES.map(f => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-black/60 hover:border-cyan-900/30 transition-colors"
                  >
                    <div className="mt-0.5 flex-shrink-0">{f.icon}</div>
                    <div>
                      <div className="text-[10px] font-mono text-white/90 font-bold">
                        {f.title}
                      </div>
                      <div className="text-[9px] font-mono text-white/40 leading-relaxed mt-0.5">
                        {f.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bug Fixes */}
            <div>
              <div className="text-[9px] font-mono tracking-[0.2em] text-green-400 font-bold mb-3 flex items-center gap-2">
                <Bug size={10} className="text-green-400" />
                FIXES &amp; IMPROVEMENTS
              </div>
              <div className="space-y-1.5">
                {BUG_FIXES.map((fix, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="text-green-500 text-[10px] mt-0.5 flex-shrink-0">
                      +
                    </span>
                    <span className="text-[9px] font-mono text-white/40 leading-relaxed">
                      {fix}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={e => setDontShow(e.target.checked)}
                className="w-3 h-3 rounded border border-white/10 bg-black/60 accent-cyan-500"
              />
              <span className="text-[9px] font-mono text-white/40 tracking-widest">
                DON&apos;T SHOW AGAIN
              </span>
            </label>
            <button
              onClick={handleClose}
              className="px-8 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 text-[10px] font-mono tracking-[0.2em] transition-all"
            >
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
