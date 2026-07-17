'use client';
import { type ReactNode } from 'react';

interface StaggerMountProps {
  /** row-major order index in the grid */
  index: number;
  children: ReactNode;
  className?: string;
}

/**
 * Widget entrance: opacity 0 to 1, translateY 10px to 0, scale 0.985 to 1
 * over 450ms with a 40ms stagger by grid order.
 */
export function StaggerMount({ index, children, className = '' }: StaggerMountProps) {
  return (
    <div
      className={`stagger-enter ${className}`}
      style={{ animationDelay: `${Math.min(index, 20) * 40}ms`, width: '100%', height: '100%' }}
    >
      {children}
    </div>
  );
}
