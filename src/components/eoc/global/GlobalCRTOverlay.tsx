'use client';

import React from 'react';

interface Props {
  enabled: boolean;
}

export function GlobalCRTOverlay({ enabled }: Props) {
  if (!enabled) return null;

  return (
    <>
      {/* Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* CRT vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Subtle green/cyan glow */}
      <div
        className="fixed inset-0 pointer-events-none z-[99]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,255,200,0.02) 0%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Flicker animation */}
      <div
        className="fixed inset-0 pointer-events-none z-[100] animate-crt-flicker"
        style={{
          background: 'transparent',
        }}
      />

      <style jsx global>{`
        @keyframes crt-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.98; }
          92% { opacity: 1; }
          93% { opacity: 0.95; }
          94% { opacity: 1; }
        }
        .animate-crt-flicker {
          animation: crt-flicker 4s infinite;
        }
      `}</style>
    </>
  );
}
