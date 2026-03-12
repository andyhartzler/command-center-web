import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'H',
    short_name: 'H',
    description: 'Observe.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1c1c1e',
    theme_color: '#e8e8ee',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
