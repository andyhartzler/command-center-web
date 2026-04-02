'use client';
import { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { type ICloudAlbumConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: ICloudAlbumConfig;
  style: WidgetStyle;
}

export function ICloudAlbumWidget({ config, style }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchUrls = useCallback(async () => {
    try {
      // Extract token from albumUrl (e.g. https://www.icloud.com/sharedalbum/#TOKEN)
      let token = config.albumUrl;
      if (token.includes('#')) {
        token = token.split('#')[1];
      }

      if (!token) return;

      const res = await fetch('/api/icloud-album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      if (!res.ok) throw new Error('Failed to fetch album');
      const data = await res.json();
      
      if (data.urls && data.urls.length > 0) {
        setUrls(data.urls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [config.albumUrl]);

  useEffect(() => {
    fetchUrls();
    // Refresh URLs every 1 hour as they might expire
    const interval = setInterval(fetchUrls, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUrls]);

  useEffect(() => {
    if (urls.length <= 1) return;
    const intervalSeconds = config.cycleIntervalSeconds || 30;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % urls.length);
    }, intervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [urls.length, config.cycleIntervalSeconds]);

  if (error || urls.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-black/20">
        <ImageIcon size={24} className="text-white/20 mb-2" />
        <span className="text-xs text-white/40 text-center">
          {error || 'No photos found or invalid album URL'}
        </span>
      </div>
    );
  }

  const currentUrl = urls[currentIndex];

  // Using a simple crossfade effect by maintaining the image tag
  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <img
        src={currentUrl}
        alt="iCloud Shared Album"
        className={`w-full h-full object-cover transition-opacity duration-1000 ${
          config.transitionEffect === 'fade' || config.transitionEffect === 'crossfade' 
            ? 'opacity-100' : 'opacity-100'
        }`}
      />
      <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white/60">
        {currentIndex + 1} / {urls.length}
      </div>
    </div>
  );
}
