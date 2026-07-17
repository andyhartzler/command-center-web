// TypeScript mirror of the globals.css @theme tokens, for canvas / SVG /
// MapKit / MapLibre consumers that cannot read CSS custom properties.
// Keep in sync with src/app/globals.css.

export const tokens = {
  bg0: '#131316',
  bg1: '#1a1a1e',
  well: '#141416',
  surface2: '#2a2a30',
  surface3: '#34343b',

  text1: '#f0f0ee',
  text2: 'rgba(235,235,235,0.64)',
  text3: 'rgba(235,235,235,0.42)',

  accent300: '#a9c1d9',
  accent400: '#8aa7c3',
  accent500: '#6b8aab',
  accent600: '#54708e',
  accentGlow: 'rgba(107,138,171,0.30)',

  ok: '#5fce8f',
  warn: '#e6b455',
  critical: '#e0564d',
  info: '#5cb8c9',
  live: '#ff5f57',

  borderCard: 'rgba(255,255,255,0.06)',
  borderWell: 'rgba(255,255,255,0.03)',
  glassBg: 'rgba(19,19,22,0.72)',
} as const;

export type TokenName = keyof typeof tokens;
