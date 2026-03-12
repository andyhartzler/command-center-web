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

/** Seeded pseudo-random for deterministic texture */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Draw a realistic moon with procedural texture and pixel-accurate phase shadow.
 */
function drawMoon(canvas: HTMLCanvasElement, phase: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const rand = seededRandom(42);

  ctx.clearRect(0, 0, size, size);

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Base moon disc - warm grey with subtle radial gradient for limb darkening
  const baseGrad = ctx.createRadialGradient(cx * 0.9, cy * 0.85, r * 0.05, cx, cy, r);
  baseGrad.addColorStop(0, '#d8d0c0');
  baseGrad.addColorStop(0.4, '#ccc4b4');
  baseGrad.addColorStop(0.7, '#b8b0a0');
  baseGrad.addColorStop(0.9, '#9a9488');
  baseGrad.addColorStop(1, '#706a60');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Highland texture - many tiny overlapping spots for granular surface
  for (let i = 0; i < 300; i++) {
    const hx = rand() * size;
    const hy = rand() * size;
    const hr = rand() * r * 0.04 + r * 0.005;
    const brightness = rand() * 0.08;
    const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    grad.addColorStop(0, `rgba(200, 195, 180, ${brightness})`);
    grad.addColorStop(1, 'rgba(200, 195, 180, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Maria (dark lunar seas) - positioned to roughly match the real Moon
  const maria = [
    { x: 0.35, y: 0.28, rx: 0.20, ry: 0.14, a: -0.15, o: 0.30 },  // Mare Imbrium
    { x: 0.28, y: 0.42, rx: 0.14, ry: 0.20, a: -0.1, o: 0.25 },   // Oceanus Procellarum
    { x: 0.50, y: 0.40, rx: 0.10, ry: 0.12, a: 0.1, o: 0.25 },    // Mare Serenitatis
    { x: 0.55, y: 0.52, rx: 0.14, ry: 0.10, a: -0.1, o: 0.28 },   // Mare Tranquillitatis
    { x: 0.40, y: 0.58, rx: 0.10, ry: 0.08, a: 0.05, o: 0.22 },   // Mare Nubium
    { x: 0.63, y: 0.32, rx: 0.06, ry: 0.08, a: 0.2, o: 0.22 },    // Mare Crisium
    { x: 0.50, y: 0.62, rx: 0.08, ry: 0.06, a: 0.15, o: 0.18 },   // Mare Fecunditatis
    { x: 0.42, y: 0.35, rx: 0.05, ry: 0.04, a: 0, o: 0.15 },      // Mare Vaporum
    { x: 0.48, y: 0.28, rx: 0.04, ry: 0.06, a: -0.1, o: 0.18 },   // Lacus Mortis area
    { x: 0.38, y: 0.50, rx: 0.06, ry: 0.05, a: 0.1, o: 0.16 },    // Mare Humorum
    { x: 0.55, y: 0.45, rx: 0.05, ry: 0.03, a: -0.05, o: 0.14 },  // Mare Nectaris
    { x: 0.30, y: 0.55, rx: 0.04, ry: 0.06, a: 0, o: 0.12 },      // Grimaldi area
  ];

  for (const m of maria) {
    ctx.save();
    ctx.translate(m.x * size, m.y * size);
    ctx.rotate(m.a);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, m.rx * size);
    grad.addColorStop(0, `rgba(65, 62, 55, ${m.o})`);
    grad.addColorStop(0.5, `rgba(75, 72, 65, ${m.o * 0.6})`);
    grad.addColorStop(0.8, `rgba(85, 80, 72, ${m.o * 0.3})`);
    grad.addColorStop(1, 'rgba(90, 85, 75, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx * size, m.ry * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Craters - many sizes for realism
  const craters: { x: number; y: number; r: number; depth: number }[] = [
    // Large named craters
    { x: 0.62, y: 0.76, r: 0.045, depth: 0.35 },  // Tycho
    { x: 0.30, y: 0.22, r: 0.040, depth: 0.30 },   // Copernicus
    { x: 0.44, y: 0.18, r: 0.030, depth: 0.25 },   // Aristarchus area
    { x: 0.70, y: 0.38, r: 0.025, depth: 0.22 },   // Langrenus
    { x: 0.25, y: 0.62, r: 0.035, depth: 0.28 },   // Kepler
    { x: 0.55, y: 0.82, r: 0.025, depth: 0.20 },   // Clavius area
    { x: 0.35, y: 0.76, r: 0.028, depth: 0.22 },
    { x: 0.68, y: 0.22, r: 0.018, depth: 0.18 },
    { x: 0.20, y: 0.38, r: 0.022, depth: 0.20 },
    { x: 0.75, y: 0.55, r: 0.020, depth: 0.18 },
    { x: 0.50, y: 0.28, r: 0.015, depth: 0.16 },
    { x: 0.40, y: 0.86, r: 0.022, depth: 0.20 },
    { x: 0.58, y: 0.14, r: 0.014, depth: 0.14 },
    { x: 0.28, y: 0.32, r: 0.014, depth: 0.14 },
    { x: 0.68, y: 0.64, r: 0.016, depth: 0.16 },
    { x: 0.22, y: 0.50, r: 0.012, depth: 0.12 },
    { x: 0.78, y: 0.45, r: 0.010, depth: 0.10 },
    { x: 0.45, y: 0.70, r: 0.013, depth: 0.12 },
  ];

  // Generate additional small craters procedurally
  for (let i = 0; i < 60; i++) {
    craters.push({
      x: rand() * 0.8 + 0.1,
      y: rand() * 0.8 + 0.1,
      r: rand() * 0.012 + 0.003,
      depth: rand() * 0.12 + 0.05,
    });
  }

  for (const c of craters) {
    const cr = c.r * size;
    const ccx = c.x * size;
    const ccy = c.y * size;

    // Check if inside moon disc
    const dx = ccx - cx;
    const dy = ccy - cy;
    if (dx * dx + dy * dy > r * r * 0.92) continue;

    // Crater interior shadow
    const craterGrad = ctx.createRadialGradient(
      ccx - cr * 0.25, ccy - cr * 0.25, 0,
      ccx, ccy, cr
    );
    craterGrad.addColorStop(0, `rgba(50, 48, 42, ${c.depth})`);
    craterGrad.addColorStop(0.5, `rgba(70, 65, 58, ${c.depth * 0.5})`);
    craterGrad.addColorStop(0.85, `rgba(90, 85, 78, ${c.depth * 0.2})`);
    craterGrad.addColorStop(1, 'rgba(100, 95, 85, 0)');
    ctx.fillStyle = craterGrad;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fill();

    // Rim highlight (top-left lit)
    ctx.strokeStyle = `rgba(210, 205, 192, ${c.depth * 0.4})`;
    ctx.lineWidth = Math.max(0.5, cr * 0.12);
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr * 0.85, -Math.PI * 0.85, Math.PI * 0.15);
    ctx.stroke();
  }

  // Tycho ray system - bright streaks radiating from Tycho crater
  ctx.globalAlpha = 0.06;
  const tychoX = 0.62 * size;
  const tychoY = 0.76 * size;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    const rayLen = r * (0.3 + rand() * 0.4);
    const endX = tychoX + Math.cos(angle) * rayLen;
    const endY = tychoY + Math.sin(angle) * rayLen;
    ctx.strokeStyle = '#d8d0c0';
    ctx.lineWidth = r * 0.01;
    ctx.beginPath();
    ctx.moveTo(tychoX, tychoY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Pixel-based noise texture + phase shadow in a single pass
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const sweep = Math.cos(phase * 2 * Math.PI);
  const isNewMoon = phase < 0.01 || phase > 0.99;

  for (let py = 0; py < size; py++) {
    const dy = py - cy;
    const dy2 = dy * dy;

    // Precompute terminator x for this row
    const chordHalf2 = r * r - dy2;
    const chordHalf = chordHalf2 > 0 ? Math.sqrt(chordHalf2) : 0;
    const terminatorX = cx + sweep * chordHalf;

    for (let px = 0; px < size; px++) {
      const dx = px - cx;
      const dist2 = dx * dx + dy2;
      if (dist2 > r * r) continue;

      const i = (py * size + px) * 4;

      // Subtle noise for surface texture
      const noiseVal = ((px * 13 + py * 7 + px * py) % 17) / 17;
      const noise = (noiseVal - 0.5) * 10;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));

      // Phase shadow
      let inShadow = false;
      if (isNewMoon) {
        inShadow = true;
      } else if (phase < 0.5) {
        // Waxing: shadow on left, lit on right
        inShadow = px < terminatorX;
      } else {
        // Waning: shadow on right, lit on left
        inShadow = px > terminatorX;
      }

      if (inShadow) {
        // Soft edge along terminator
        const distToTerminator = Math.abs(px - terminatorX);
        const edgeWidth = r * 0.025;
        const edgeFade = Math.min(1, distToTerminator / edgeWidth);
        const shadowStrength = 0.94 * edgeFade;

        data[i] = Math.round(data[i] * (1 - shadowStrength));
        data[i + 1] = Math.round(data[i + 1] * (1 - shadowStrength));
        data[i + 2] = Math.round(data[i + 2] * (1 - shadowStrength * 0.90));
      }

      // Limb darkening - darken edges of the disc
      const distFromCenter = Math.sqrt(dist2) / r;
      if (distFromCenter > 0.75) {
        const limbFactor = (distFromCenter - 0.75) / 0.25;
        const darken = limbFactor * limbFactor * 0.3;
        data[i] = Math.round(data[i] * (1 - darken));
        data[i + 1] = Math.round(data[i + 1] * (1 - darken));
        data[i + 2] = Math.round(data[i + 2] * (1 - darken));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Subtle atmospheric glow around the lit edge
  if (!isNewMoon) {
    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.06);
    glowGrad.addColorStop(0, 'rgba(200, 210, 225, 0)');
    glowGrad.addColorStop(0.4, 'rgba(200, 210, 225, 0.04)');
    glowGrad.addColorStop(1, 'rgba(200, 210, 225, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.06, 0, Math.PI * 2);
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
      // drawMoon uses canvas.width for pixel operations, so we need to
      // work in the scaled coordinate space
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
          style={{ filter: 'drop-shadow(0 0 8px rgba(180, 190, 210, 0.06))' }}
        />
      </div>
      <div className="text-center shrink-0 pb-1">
        <div className="text-[11px] font-semibold text-white/80 leading-tight">{name}</div>
        <div className="text-[9px] text-white/35">{Math.round(illumination * 100)}% illuminated</div>
      </div>
    </div>
  );
}
