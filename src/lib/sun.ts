export interface SunData {
  sunrise: string;
  sunset: string;
  dayProgress: number;
  moonPhase: string;
  moonPhaseEmoji: string;
  moonIllumination: number;
}

export function calculateSun(lat: number, lon: number): SunData {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Solar calculations
  const decl = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10)) * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const ha = Math.acos(-Math.tan(latRad) * Math.tan(decl));
  const noon = 12.0 - lon / 15.0 + 6; // UTC offset approx -6 for CT

  const sunriseHour = noon - ha * 12.0 / Math.PI;
  const sunsetHour = noon + ha * 12.0 / Math.PI;

  const formatHour = (h: number): string => {
    const hour = Math.floor(h) % 24;
    const min = Math.floor((h - Math.floor(h)) * 60);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const progress = Math.max(0, Math.min(1, (currentHour - sunriseHour) / (sunsetHour - sunriseHour)));

  // Moon phase
  const jd = Math.floor(now.getTime() / 86400000) + 2440587.5;
  let moonAge = (jd - 2451550.1) % 29.530588853;
  if (moonAge < 0) moonAge += 29.530588853;
  const moonPhaseVal = moonAge / 29.530588853;
  const [phaseName, phaseEmoji] = moonPhaseName(moonPhaseVal);

  return {
    sunrise: formatHour(sunriseHour),
    sunset: formatHour(sunsetHour),
    dayProgress: progress,
    moonPhase: phaseName,
    moonPhaseEmoji: phaseEmoji,
    moonIllumination: Math.abs(Math.cos(moonPhaseVal * 2 * Math.PI)),
  };
}

function moonPhaseName(phase: number): [string, string] {
  if (phase < 0.0625) return ['New', '\u{1F311}'];
  if (phase < 0.1875) return ['Waxing Cr', '\u{1F312}'];
  if (phase < 0.3125) return ['First Qtr', '\u{1F313}'];
  if (phase < 0.4375) return ['Waxing Gb', '\u{1F314}'];
  if (phase < 0.5625) return ['Full', '\u{1F315}'];
  if (phase < 0.6875) return ['Waning Gb', '\u{1F316}'];
  if (phase < 0.8125) return ['Last Qtr', '\u{1F317}'];
  if (phase < 0.9375) return ['Waning Cr', '\u{1F318}'];
  return ['New', '\u{1F311}'];
}
