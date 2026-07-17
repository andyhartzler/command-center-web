'use client';
import { useState, useEffect, useRef } from 'react';
import { Moon } from 'lucide-react';
import { type MoonPhaseConfig, type WidgetStyle } from '@/types/widget';
import { WidgetShell } from './WidgetShell';
import { tokens } from '@/lib/tokens';

interface Props {
  config: MoonPhaseConfig;
  style: WidgetStyle;
}

const SYNODIC_MONTH = 29.530588853;

/** Compute moon phase value 0-1 (0=new, 0.5=full, 1=new) */
function getMoonPhase(): {
  phase: number;
  name: string;
  illumination: number;
  age: number;
  daysToFull: number;
} {
  const now = new Date();
  const jd = Math.floor(now.getTime() / 86400000) + 2440587.5;
  let moonAge = (jd - 2451550.1) % SYNODIC_MONTH;
  if (moonAge < 0) moonAge += SYNODIC_MONTH;
  const phase = moonAge / SYNODIC_MONTH;
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;

  let name: string;
  if (phase < 0.0625) name = 'New Moon';
  else if (phase < 0.1875) name = 'Waxing Crescent';
  else if (phase < 0.3125) name = 'First Quarter';
  else if (phase < 0.4375) name = 'Waxing Gibbous';
  else if (phase < 0.5625) name = 'Full Moon';
  else if (phase < 0.6875) name = 'Waning Gibbous';
  else if (phase < 0.8125) name = 'Last Quarter';
  else if (phase < 0.9375) name = 'Waning Crescent';
  else name = 'New Moon';

  const fullAge = SYNODIC_MONTH / 2;
  const daysToFull = (fullAge - moonAge + SYNODIC_MONTH) % SYNODIC_MONTH;

  return { phase, name, illumination, age: moonAge, daysToFull };
}

/**
 * Draw phase shadow over the moon disc. Uses the real photograph when it
 * loaded; falls back to a procedural shaded disc if the image errored.
 */
function drawMoon(canvas: HTMLCanvasElement, phase: number, moonImg: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (moonImg) {
    // Draw the real moon photograph, scaled up slightly to eliminate black border
    // The photo has a black background around the moon disc - overfill to crop it out
    const scale = 1.22;
    const offset = (size * (scale - 1)) / 2;
    ctx.drawImage(moonImg, -offset, -offset, size * scale, size * scale);
  } else {
    // Procedural fallback: soft grey disc with limb darkening
    const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
    grad.addColorStop(0, tokens.text1);
    grad.addColorStop(0.7, tokens.text2);
    grad.addColorStop(1, tokens.surface3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Phase shadow using pixel manipulation for smooth terminator
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const isNewMoon = phase < 0.01 || phase > 0.99;
  const isWaning = phase >= 0.5;
  // For waxing: terminator sweeps from right edge (new) to left edge (full)
  // For waning: terminator sweeps from right edge (full) to left edge (new)
  const sweep = isWaning
    ? Math.cos((phase - 0.5) * 2 * Math.PI)
    : Math.cos(phase * 2 * Math.PI);

  for (let py = 0; py < size; py++) {
    const dy = py - cy;
    const chordHalf2 = r * r - dy * dy;
    if (chordHalf2 <= 0) continue;
    const chordHalf = Math.sqrt(chordHalf2);
    const terminatorX = cx + sweep * chordHalf;

    for (let px = 0; px < size; px++) {
      const dx = px - cx;
      if (dx * dx + dy * dy > r * r) continue;

      const i = (py * size + px) * 4;

      let inShadow = false;
      if (isNewMoon) {
        inShadow = true;
      } else if (!isWaning) {
        // Waxing: shadow on the left (right side lit)
        inShadow = px < terminatorX;
      } else {
        // Waning: shadow on the right (left side lit)
        inShadow = px > terminatorX;
      }

      if (inShadow) {
        const distToTerminator = Math.abs(px - terminatorX);
        const edgeWidth = r * 0.06;
        const edgeFade = Math.min(1, distToTerminator / edgeWidth);
        const shadowStrength = 0.95 * edgeFade;

        // Darken to near-black in shadow
        data[i] = Math.round(data[i] * (1 - shadowStrength));
        data[i + 1] = Math.round(data[i + 1] * (1 - shadowStrength));
        data[i + 2] = Math.round(data[i + 2] * (1 - shadowStrength));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  ctx.restore();
}

export function MoonPhaseWidget({ style }: Props) {
  const [moonData, setMoonData] = useState(() => getMoonPhase());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(200);
  const moonImgRef = useRef<HTMLImageElement | null>(null);
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  // Load moon texture once; fall back to the procedural disc on error
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      moonImgRef.current = img;
      setImgState('loaded');
    };
    img.onerror = () => {
      moonImgRef.current = null;
      setImgState('failed');
    };
    img.src = '/moon-texture.jpg';
  }, []);

  // The terminator moves ~0.5px per hour at this size; hourly is plenty
  useEffect(() => {
    const interval = setInterval(() => {
      setMoonData(getMoonPhase());
    }, 3600_000);
    return () => clearInterval(interval);
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rect = container.getBoundingClientRect();
      const maxSize = Math.min(rect.width - 16, rect.height - 58);
      setCanvasSize(Math.max(80, Math.floor(maxSize)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw moon when phase, size, or image state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || imgState === 'loading') return;

    const dpr = window.devicePixelRatio || 1;
    const drawSize = canvasSize * dpr;
    canvas.width = drawSize;
    canvas.height = drawSize;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    drawMoon(canvas, moonData.phase, moonImgRef.current);
  }, [moonData.phase, canvasSize, imgState]);

  const { name, illumination, daysToFull } = moonData;
  const daysOut = Math.round(daysToFull);
  const fullMoonLine =
    name === 'Full Moon' || daysOut === 0
      ? 'Full moon tonight'
      : `Full moon in ${daysOut} ${daysOut === 1 ? 'day' : 'days'}`;

  return (
    <WidgetShell icon={<Moon size={18} strokeWidth={1.75} />} title="Moon" style={style}>
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-center px-3.5 pb-3 gap-1.5"
      >
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          <canvas
            ref={canvasRef}
            className="rounded-full"
            style={{ filter: `drop-shadow(0 0 12px ${tokens.borderCard})` }}
          />
        </div>
        <div className="text-center shrink-0">
          <div className="text-[13px] font-medium leading-tight" style={{ color: 'var(--color-text-1)' }}>
            {name}
          </div>
          <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            <span className="font-mono">{Math.round(illumination * 100)}%</span> illuminated
          </div>
          <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            {fullMoonLine}
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
