'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Globe, Satellite, Radio, Radar, Anchor, Camera, Flame, Activity } from 'lucide-react';

const STORAGE_KEY = 'shadowbroker_onboarding_complete';

const FREE_SOURCES = [
  { name: 'adsb.lol', desc: 'Military & civil aviation', icon: Radar, color: 'text-cyan-400' },
  { name: 'USGS', desc: 'Global seismic data', icon: Activity, color: 'text-red-400' },
  { name: 'NASA FIRMS', desc: 'Fire hotspot detection', icon: Flame, color: 'text-orange-400' },
  { name: 'CelesTrak', desc: '800+ satellite orbits', icon: Satellite, color: 'text-purple-400' },
  { name: 'GDELT', desc: 'Global conflict events', icon: Globe, color: 'text-red-300' },
  { name: 'NOAA SWPC', desc: 'Space weather scales', icon: Globe, color: 'text-yellow-400' },
  { name: 'Broadcastify', desc: 'Radio scanner feeds', icon: Radio, color: 'text-rose-400' },
  { name: 'KiwiSDR', desc: 'SDR receiver network', icon: Radio, color: 'text-amber-400' },
  { name: 'CCTV Networks', desc: 'TfL, NYC, Singapore', icon: Camera, color: 'text-green-400' },
  { name: 'Carrier OSINT', desc: 'US Navy strike groups', icon: Anchor, color: 'text-blue-400' },
];

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
}

export function GlobalOnboardingModal({ onClose, onOpenSettings }: Props) {
  const [step, setStep] = useState(0);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  const handleOpenSettings = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
    onOpenSettings();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000]" onClick={handleDismiss} />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none">
        <div
          className="w-[520px] max-h-[80vh] bg-[#0a0e1a]/98 border border-cyan-900/50 rounded-xl shadow-[0_0_80px_rgba(0,200,255,0.08)] pointer-events-auto flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Shield size={20} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-[0.2em] text-white/90 font-mono">MISSION BRIEFING</h2>
                  <span className="text-[9px] text-white/30 font-mono tracking-widest">FIRST-TIME SETUP</span>
                </div>
              </div>
              <button onClick={handleDismiss} className="text-white/30 hover:text-red-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 px-5 pt-3">
            {['Welcome', 'Data Sources', 'Controls'].map((label, i) => (
              <button
                key={label}
                onClick={() => setStep(i)}
                className={`flex-1 py-1.5 text-[9px] font-mono tracking-widest rounded border transition-all ${
                  step === i
                    ? 'border-cyan-500/50 text-cyan-400 bg-cyan-950/20'
                    : 'border-white/10 text-white/25 hover:text-white/40'
                }`}
              >
                {label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto styled-scrollbar p-5">
            {step === 0 && (
              <div className="space-y-4">
                <div className="text-center py-3">
                  <div className="text-lg font-bold tracking-[0.3em] text-white/90 font-mono mb-2">
                    S H A D O W <span className="text-cyan-400">B R O K E R</span>
                  </div>
                  <p className="text-[11px] text-white/50 font-mono leading-relaxed max-w-md mx-auto">
                    Real-time OSINT dashboard aggregating 15+ live intelligence sources.
                    Flights, ships, satellites, earthquakes, conflicts, and more — all on one map.
                  </p>
                </div>

                <div className="bg-green-950/20 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Globe size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-green-400 font-mono font-bold mb-1">All Sources Work Immediately</p>
                      <p className="text-[10px] text-white/50 font-mono leading-relaxed">
                        Military aircraft, satellites, earthquakes, fires, global conflicts, weather, radio scanners, CCTV, news, and market data all work out of the box — no API keys needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-[10px] text-white/40 font-mono mb-2">
                  These data sources are completely free and activate automatically:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FREE_SOURCES.map(src => {
                    const Icon = src.icon;
                    return (
                      <div key={src.name} className="rounded-lg border border-white/10 p-3 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={12} className={src.color} />
                          <span className="text-[10px] font-mono text-white/70 font-medium">{src.name}</span>
                        </div>
                        <p className="text-[9px] text-white/30 font-mono">{src.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-[10px] text-white/40 font-mono mb-3">Keyboard shortcuts for rapid navigation:</p>
                <div className="space-y-1.5">
                  {[
                    { key: 'M', desc: 'Toggle military flights' },
                    { key: 'C', desc: 'Toggle commercial flights' },
                    { key: 'P', desc: 'Toggle private jets' },
                    { key: 'T', desc: 'Toggle tracked / POTUS fleet' },
                    { key: 'S', desc: 'Toggle satellites' },
                    { key: 'E', desc: 'Toggle earthquakes' },
                    { key: 'F', desc: 'Toggle fires' },
                    { key: 'N', desc: 'Toggle night overlay' },
                    { key: 'K', desc: 'Cycle map styles' },
                    { key: 'R', desc: 'Toggle CRT effect' },
                    { key: 'D', desc: 'Toggle measure mode' },
                    { key: 'ESC', desc: 'Close panels / cancel' },
                  ].map(({ key, desc }) => (
                    <div key={key} className="flex items-center gap-3">
                      <kbd className="text-[10px] font-mono bg-white/10 text-cyan-400 px-2 py-0.5 rounded border border-white/10 min-w-[32px] text-center">
                        {key}
                      </kbd>
                      <span className="text-[10px] text-white/50 font-mono">{desc}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-[9px] text-white/25 font-mono">
                  Right-click anywhere on the map for region intelligence dossier.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className={`px-4 py-2 rounded border text-[10px] font-mono tracking-widest transition-all ${
                step === 0
                  ? 'border-white/5 text-white/15 cursor-not-allowed'
                  : 'border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              PREV
            </button>

            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${step === i ? 'bg-cyan-400' : 'bg-white/10'}`} />
              ))}
            </div>

            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 text-[10px] font-mono tracking-widest transition-all"
              >
                NEXT
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="px-4 py-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 text-[10px] font-mono tracking-widest transition-all"
              >
                LAUNCH
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShowOnboarding(true);
  }, []);

  return { showOnboarding, setShowOnboarding };
}
