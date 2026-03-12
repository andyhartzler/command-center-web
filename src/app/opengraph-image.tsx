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
          background: 'linear-gradient(135deg, #0c1220 0%, #111827 100%)',
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
          <rect x="116" y="100" width="58" height="312" rx="29" fill="#e8e8ee" />
          <rect x="338" y="100" width="58" height="312" rx="29" fill="#a0a0b0" />
          <rect
            x="148"
            y="228"
            width="216"
            height="50"
            rx="25"
            fill="#c0c0cc"
            transform="rotate(-6 256 253)"
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
