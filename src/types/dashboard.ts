import { DashboardWidget } from './widget';

export type BackgroundTheme = 'deepSpace' | 'midnight' | 'aurora' | 'ember' | 'ocean' | 'slate';

export const BACKGROUND_THEMES: Record<BackgroundTheme, { displayName: string; className: string }> = {
  deepSpace: { displayName: 'Deep Space', className: 'bg-theme-deep-space' },
  midnight: { displayName: 'Midnight', className: 'bg-theme-midnight' },
  aurora: { displayName: 'Aurora', className: 'bg-theme-aurora' },
  ember: { displayName: 'Ember', className: 'bg-theme-ember' },
  ocean: { displayName: 'Ocean', className: 'bg-theme-ocean' },
  slate: { displayName: 'Slate', className: 'bg-theme-slate' },
};

export type AppMode = 'dashboard' | 'eoc';
export type EOCScope = 'kc' | 'usa' | 'global';

export interface DashboardPage {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  backgroundTheme: BackgroundTheme;
  autoRotateSeconds: number | null;
  gridColumns?: number;
  gridRows?: number;
}

export const GRID_COLUMNS = 24;
export const GRID_ROWS = 16;
