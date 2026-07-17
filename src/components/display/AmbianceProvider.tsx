'use client';
import { useEffect } from 'react';
import { useAppState } from '@/context/AppState';
import { calculateSun } from '@/lib/sun';

// Scene ambiance for the 24/7 wall: night dim via a composited overlay,
// a 2px burn-in orbit, and a 4:30 AM watchdog reload in display mode.
// Dawn/dusk come from the repo's real solar math in lib/sun.ts.

const KC_LAT = 39.0997;
const KC_LON = -94.5786;

function computeDim(date: Date): number {
  const { dayProgress } = calculateSun(KC_LAT, KC_LON);
  const h = date.getHours() + date.getMinutes() / 60;
  // dayProgress is clamped 0..1 between sunrise and sunset
  if (dayProgress > 0.02 && dayProgress < 0.98) return 0; // day
  // deep night: well past sunset or well before sunrise
  if (h >= 22 || h < 5) return 0.28;
  return 0.14; // dawn/dusk shoulder
}

const ORBIT: Array<[number, number]> = [[0, 0], [2, 0], [2, 2], [0, 2]];

export function AmbianceProvider() {
  const { isDisplayMode } = useAppState();

  // Night dim + accent desaturation
  useEffect(() => {
    const apply = () => {
      const dim = computeDim(new Date());
      document.documentElement.style.setProperty('--scene-dim', String(dim));
      document.documentElement.style.setProperty('--scene-saturation', dim > 0.2 ? '0.8' : '1');
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, []);

  // Burn-in orbit: step every 6 minutes, tweened over 60s in CSS
  useEffect(() => {
    if (!isDisplayMode) return;
    let step = 0;
    const el = () => document.querySelector<HTMLElement>('.burnin-orbit');
    const move = () => {
      step = (step + 1) % ORBIT.length;
      const [x, y] = ORBIT[step];
      const grid = el();
      if (grid) grid.style.transform = `translate(${x}px, ${y}px)`;
    };
    const t = setInterval(move, 6 * 60_000);
    return () => {
      clearInterval(t);
      const grid = el();
      if (grid) grid.style.transform = '';
    };
  }, [isDisplayMode]);

  // Watchdog: 4:30 AM reload in display mode clears any slow leak
  useEffect(() => {
    if (!isDisplayMode) return;
    const t = setInterval(() => {
      const d = new Date();
      if (d.getHours() === 4 && d.getMinutes() === 30) location.reload();
    }, 60_000);
    return () => clearInterval(t);
  }, [isDisplayMode]);

  // display-mode class drives --tv-scale
  useEffect(() => {
    document.documentElement.classList.toggle('display-mode', isDisplayMode);
    return () => document.documentElement.classList.remove('display-mode');
  }, [isDisplayMode]);

  return <div className="night-overlay" aria-hidden />;
}

// Keep the latitude constant exported so a future real solar calc (lib/sun.ts)
// can replace the lookup without touching call sites.
export { KC_LAT };
