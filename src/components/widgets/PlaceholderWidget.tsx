'use client';
import { Box } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface PlaceholderWidgetProps {
  name: string;
  icon: string;
  color: string;
}

function getIcon(name: string) {
  const pascalName = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icons = LucideIcons as any;
  return icons[pascalName] || Box;
}

export function PlaceholderWidget({ name, icon, color }: PlaceholderWidgetProps) {
  const IconComponent = getIcon(icon);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      <IconComponent size={28} color={color} />
      <span className="text-xs font-medium text-white/40">{name}</span>
      <span className="text-[10px] text-white/20">Not available on web</span>
    </div>
  );
}
