'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

const MAX_ANIMATED_PER_UPDATE = 3;

/**
 * FLIP insert/reorder for feed lists. Children MUST be keyed by stable ids.
 * New items slide in from -8px with fade; moved items FLIP to their new
 * position. At most 3 items animate per update.
 */
export function AnimatedList({ children, className = '' }: AnimatedListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const positions = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const next = new Map<string, DOMRect>();
    let animated = 0;
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const key = child.dataset.key;
      if (!key) continue;
      const rect = child.getBoundingClientRect();
      next.set(key, rect);

      const prev = positions.current.get(key);
      if (animated >= MAX_ANIMATED_PER_UPDATE) continue;

      if (!prev) {
        if (positions.current.size > 0) {
          child.classList.remove('list-enter');
          void child.offsetWidth;
          child.classList.add('list-enter');
          animated++;
        }
      } else {
        const dy = prev.top - rect.top;
        if (Math.abs(dy) > 1) {
          child.animate(
            [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
            { duration: 350, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          );
          animated++;
        }
      }
    }
    positions.current = next;
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
