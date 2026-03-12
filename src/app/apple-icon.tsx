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
          background: '#0c1220',
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
      </div>
    ),
    { ...size }
  );
}
