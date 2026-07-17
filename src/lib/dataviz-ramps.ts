// Data-viz ramps: single source of truth for every scale that appears in
// both a plot and a legend. Legends must be generated from these constants
// so legend/plot mismatches are structurally impossible.

import { tokens } from './tokens';

export interface RampStop {
  /** Inclusive lower bound of this band */
  min: number;
  label: string;
  color: string;
}

/** EPA AQI bands (US standard breakpoints) */
export const AQI_RAMP: RampStop[] = [
  { min: 0, label: 'Good', color: tokens.ok },
  { min: 51, label: 'Moderate', color: tokens.warn },
  { min: 101, label: 'Unhealthy for Sensitive Groups', color: '#e08a4d' },
  { min: 151, label: 'Unhealthy', color: tokens.critical },
  { min: 201, label: 'Very Unhealthy', color: '#a4508b' },
  { min: 301, label: 'Hazardous', color: '#7a1f3d' },
];

/** Aircraft altitude bands in feet */
export const ALTITUDE_RAMP: RampStop[] = [
  { min: 0, label: 'Below 10,000 ft', color: tokens.info },
  { min: 10000, label: '10,000 to 20,000 ft', color: tokens.ok },
  { min: 20000, label: '20,000 to 30,000 ft', color: tokens.warn },
  { min: 30000, label: 'Above 30,000 ft', color: tokens.accent300 },
];

/** Earthquake magnitude bands */
export const QUAKE_RAMP: RampStop[] = [
  { min: 0, label: 'Under M3', color: tokens.text3 },
  { min: 3, label: 'M3 to M4.5', color: tokens.info },
  { min: 4.5, label: 'M4.5 to M6', color: tokens.warn },
  { min: 6, label: 'M6+', color: tokens.critical },
];

/** FAA delay severity in minutes */
export const DELAY_RAMP: RampStop[] = [
  { min: 0, label: 'Under 30 min', color: tokens.warn },
  { min: 30, label: '30 to 60 min', color: '#e08a4d' },
  { min: 60, label: 'Over an hour', color: tokens.critical },
];

/** UV index segments */
export const UV_RAMP: RampStop[] = [
  { min: 0, label: 'Low', color: tokens.ok },
  { min: 3, label: 'Moderate', color: tokens.warn },
  { min: 6, label: 'High', color: '#e08a4d' },
  { min: 8, label: 'Very High', color: tokens.critical },
  { min: 11, label: 'Extreme', color: '#a4508b' },
];

/** Resolve a value to its band in a ramp */
export function rampColor(ramp: RampStop[], value: number): string {
  let stop = ramp[0];
  for (const s of ramp) {
    if (value >= s.min) stop = s;
  }
  return stop.color;
}

export function rampLabel(ramp: RampStop[], value: number): string {
  let stop = ramp[0];
  for (const s of ramp) {
    if (value >= s.min) stop = s;
  }
  return stop.label;
}
