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
 * Draw a clean, macOS-style moon.
 * Uses smooth gradients and soft maria - NO noise, minimal craters.
 */
function drawMoon(canvas: HTMLCanvasElement, phase: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  ctx.clearRect(0, 0, size, size);

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Base moon disc - clean silver with soft limb darkening
  const baseGrad = ctx.createRadialGradient(cx * 0.92, cy * 0.88, r * 0.05, cx, cy, r);
  baseGrad.addColorStop(0, '#e8e4de');
  baseGrad.addColorStop(0.3, '#ddd8d0');
  baseGrad.addColorStop(0.6, '#ccc7be');
  baseGrad.addColorStop(0.85, '#b0aba2');
  baseGrad.addColorStop(1, '#8a8580');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Maria (dark lunar seas) - soft, blurred ellipses
  const maria = [
    { x: 0.35, y: 0.28, rx: 0.18, ry: 0.12, o: 0.18 },  // Mare Imbrium
    { x: 0.28, y: 0.44, rx: 0.12, ry: 0.18, o: 0.15 },  // Oceanus Procellarum
    { x: 0.50, y: 0.38, rx: 0.09, ry: 0.11, o: 0.16 },  // Mare Serenitatis
    { x: 0.55, y: 0.50, rx: 0.12, ry: 0.09, o: 0.17 },  // Mare Tranquillitatis
    { x: 0.40, y: 0.56, rx: 0.09, ry: 0.07, o: 0.13 },  // Mare Nubium
    { x: 0.63, y: 0.32, rx: 0.05, ry: 0.07, o: 0.14 },  // Mare Crisium
    { x: 0.50, y: 0.60, rx: 0.07, ry: 0.05, o: 0.11 },  // Mare Fecunditatis
    { x: 0.38, y: 0.48, rx: 0.05, ry: 0.04, o: 0.10 },  // Mare Humorum
  ];

  for (const m of maria) {
    const grad = ctx.createRadialGradient(
      m.x * size, m.y * size, 0,
      m.x * size, m.y * size, Math.max(m.rx, m.ry) * size
    );
    grad.addColorStop(0, `rgba(100, 96, 88, ${m.o})`);
    grad.addColorStop(0.6, `rgba(110, 105, 96, ${m.o * 0.5})`);
    grad.addColorStop(1, 'rgba(120, 115, 105, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(m.x * size, m.y * size, m.rx * size, m.ry * size, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few key craters - just subtle bright rims, no heavy shadows
  const craters = [
    { x: 0.62, y: 0.76, r: 0.030 },  // Tycho
    { x: 0.30, y: 0.22, r: 0.025 },  // Copernicus
    { x: 0.25, y: 0.62, r: 0.022 },  // Kepler
    { x: 0.70, y: 0.38, r: 0.018 },  // Langrenus
  ];

  for (const c of craters) {
    const cr = c.r * size;
    const ccx = c.x * size;
    const ccy = c.y * size;
    const dx = ccx - cx;
    const dy = ccy - cy;
    if (dx * dx + dy * dy > r * r * 0.9) continue;

    // Subtle crater shadow
    const cGrad = ctx.createRadialGradient(ccx, ccy, cr * 0.2, ccx, ccy, cr);
    cGrad.addColorStop(0, 'rgba(80, 76, 68, 0.12)');
    cGrad.addColorStop(0.7, 'rgba(90, 86, 78, 0.06)');
    cGrad.addColorStop(1, 'rgba(100, 96, 88, 0)');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fill();

    // Bright rim
    ctx.strokeStyle = 'rgba(220, 216, 208, 0.12)';
    ctx.lineWidth = Math.max(0.5, cr * 0.1);
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr * 0.8, -Math.PI * 0.8, Math.PI * 0.2);
    ctx.stroke();
  }

  // Tycho rays - very subtle
  ctx.globalAlpha = 0.03;
  const tychoX = 0.62 * size;
  const tychoY = 0.76 * size;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
    const rayLen = r * (0.25 + Math.sin(angle * 3) * 0.15);
    ctx.strokeStyle = '#ddd8d0';
    ctx.lineWidth = r * 0.006;
    ctx.beginPath();
    ctx.moveTo(tychoX, tychoY);
    ctx.lineTo(tychoX + Math.cos(angle) * rayLen, tychoY + Math.sin(angle) * rayLen);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Phase shadow using imageData for smooth pixel-level terminator
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
      const dx2 = (px - cx) * (px - cx);
      if (dx2 + dy * dy > r * r) continue;

      const i = (py * size + px) * 4;

      // Phase shadow
      let inShadow = false;
      if (isNewMoon) {
        inShadow = true;
      } else if (phase < 0.5) {
        inShadow = px < terminatorX;
      } else {
        inShadow = px > terminatorX;
      }

      if (inShadow) {
        const distToTerminator = Math.abs(px - terminatorX);
        const edgeWidth = r * 0.04; // Wider for softer edge
        const edgeFade = Math.min(1, distToTerminator / edgeWidth);
        const shadowStrength = 0.92 * edgeFade;

        data[i] = Math.round(data[i] * (1 - shadowStrength));
        data[i + 1] = Math.round(data[i + 1] * (1 - shadowStrength));
        data[i + 2] = Math.round(data[i + 2] * (1 - shadowStrength * 0.88));
      }

      // Limb darkening
      const distFromCenter = Math.sqrt(dx2 + dy * dy) / r;
      if (distFromCenter > 0.8) {
        const limbFactor = (distFromCenter - 0.8) / 0.2;
        const darken = limbFactor * limbFactor * 0.25;
        data[i] = Math.round(data[i] * (1 - darken));
        data[i + 1] = Math.round(data[i + 1] * (1 - darken));
        data[i + 2] = Math.round(data[i + 2] * (1 - darken));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Soft glow on lit edge
  if (!isNewMoon) {
    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.04);
    glowGrad.addColorStop(0, 'rgba(210, 215, 225, 0)');
    glowGrad.addColorStop(0.5, 'rgba(210, 215, 225, 0.03)');
    glowGrad.addColorStop(1, 'rgba(210, 215, 225, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function MoonPhaseWidget({ config }: Props) {
  const [moonData, setMoonData] = useState(() => getMoonPhase());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(200);

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

  // Draw moon when phase or size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawMoon(canvas, moonData.phase);
    }
  }, [moonData.phase, canvasSize]);

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
