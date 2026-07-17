'use client';
import { Box } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// Fallback card for unknown widget types found in saved state (e.g. a layout
// saved by a newer build). Renders quietly; never fabricates content.

interface PlaceholderWidgetProps {
  name: string;
  icon: string;
  color?: string;
}

function getIcon(name: string) {
  const pascalName = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icons = LucideIcons as any;
  return icons[pascalName] || Box;
}

export function PlaceholderWidget({ name, icon }: PlaceholderWidgetProps) {
  const IconComponent = getIcon(icon);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
      <IconComponent size={24} style={{ color: 'var(--color-text-3)' }} aria-hidden />
      <span className="type-label">{name}</span>
    </div>
  );
}
