'use client';
import { useState, useEffect, useRef } from 'react';
import { type MoonPhaseConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: MoonPhaseConfig;
  style: WidgetStyle;
}

/** Compute moon phase value 0-1 (0=new, 0.5=full, 1=new) */
function getMoonPhase(): { phase: number; name: string; illumination: number; age: number } {
  const now = new Date();
  const jd = Math.floor(now.getTime() / 86400000) + 2440587.5;
  let moonAge = (jd - 2451550.1) % 29.530588853;
  if (moonAge < 0) moonAge += 29.530588853;
  const phase = moonAge / 29.530588853;
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

  return { phase, name, illumination, age: moonAge };
}

/**
 * Draw phase shadow over a real moon photograph.
 * Loads /moon-texture.jpg, draws it, then overlays the shadow terminator.
 */
function drawMoon(canvas: HTMLCanvasElement, phase: number, moonImg: HTMLImageElement) {
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

  // Draw the real moon photograph, scaled up slightly to eliminate black border
  // The photo has a black background around the moon disc - overfill to crop it out
  const scale = 1.22;
  const offset = (size * (scale - 1)) / 2;
  ctx.drawImage(moonImg, -offset, -offset, size * scale, size * scale);

  // Phase shadow using pixel manipulation for smooth terminator
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const sweep = Math.cos(phase * 2 * Math.PI);
  const isNewMoon = phase < 0.01 || phase > 0.99;

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
      } else if (phase < 0.5) {
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

export function MoonPhaseWidget({ config }: Props) {
  const [moonData, setMoonData] = useState(() => getMoonPhase());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(200);
  const moonImgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Load moon texture once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      moonImgRef.current = img;
      setImgLoaded(true);
    };
    img.src = '/moon-texture.jpg';
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMoonData(getMoonPhase());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rect = container.getBoundingClientRect();
      const maxSize = Math.min(rect.width - 16, rect.height - 50);
      setCanvasSize(Math.max(80, Math.floor(maxSize)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw moon when phase, size, or image changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const moonImg = moonImgRef.current;
    if (!canvas || !moonImg || !imgLoaded) return;

    const dpr = window.devicePixelRatio || 1;
    const drawSize = canvasSize * dpr;
    canvas.width = drawSize;
    canvas.height = drawSize;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    drawMoon(canvas, moonData.phase, moonImg);
  }, [moonData.phase, canvasSize, imgLoaded]);

  const { name, illumination } = moonData;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-2 gap-1 bg-[#1a1a1c]">
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <canvas
          ref={canvasRef}
          className="rounded-full"
          style={{ filter: 'drop-shadow(0 0 12px rgba(200, 205, 215, 0.08))' }}
        />
      </div>
      <div className="text-center shrink-0 pb-1">
        <div className="text-[11px] font-semibold text-white/80 leading-tight">{name}</div>
        <div className="text-[9px] text-white/35">{Math.round(illumination * 100)}% illuminated</div>
      </div>
    </div>
  );
}
