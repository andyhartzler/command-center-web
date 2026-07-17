'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface DataPulseProps {
  /** any stable hash of the payload; a change triggers one pulse */
  signature: string | number | null;
  children: ReactNode;
  className?: string;
}

/**
 * One-shot 500ms brightness sweep when the payload signature changes,
 * so the eye learns "this tile just refreshed".
 */
export function DataPulse({ signature, children, className = '' }: DataPulseProps) {
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(signature);

  useEffect(() => {
    if (signature === null || prev.current === signature) return;
    // Skip the very first data arrival; pulse only on refreshes
    const isFirst = prev.current === null;
    prev.current = signature;
    if (isFirst) return;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 520);
    return () => clearTimeout(t);
  }, [signature]);

  return (
    <div className={`${pulsing ? 'data-pulse' : ''} ${className}`}>
      {children}
    </div>
  );
}
