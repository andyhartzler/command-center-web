import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          borderRadius: 36,
        }}
      >
        <svg
          width="140"
          height="140"
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
      </div>
    ),
    { ...size }
  );
}
