import { ImageResponse } from 'next/og';

export const alt = 'Hartzler Command Center';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="112" y="96" width="64" height="320" rx="32" fill="#22d3ee" />
          <rect x="336" y="96" width="64" height="320" rx="32" fill="#6366f1" />
          <rect
            x="144"
            y="224"
            width="224"
            height="56"
            rx="28"
            fill="#4f8ef7"
            transform="rotate(-6 256 252)"
          />
        </svg>
        <div
          style={{
            marginTop: 32,
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          OBSERVE
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 18,
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          EVERYTHING IS CONNECTED
        </div>
      </div>
    ),
    { ...size }
  );
}
