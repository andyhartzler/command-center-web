'use client';

import React, { useState, useEffect } from 'react';

// Module-level cache: topic -> thumbnail URL (persists across renders/mounts)
const _cache = new Map<string, { url: string | null; done: boolean }>();

interface GlobalWikiImageProps {
  topic: string;
  size?: number;
  className?: string;
}

export default function GlobalWikiImage({ topic, size = 300, className = '' }: GlobalWikiImageProps) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!topic) return;
    const cached = _cache.get(topic);
    if (cached?.done) return;
    if (cached) return; // in-flight

    _cache.set(topic, { url: null, done: false });

    fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
    )
      .then(r => r.json())
      .then(data => {
        const thumbSrc = data.thumbnail?.source || null;
        _cache.set(topic, { url: thumbSrc, done: true });
        forceUpdate(n => n + 1);
      })
      .catch(() => {
        _cache.set(topic, { url: null, done: true });
        forceUpdate(n => n + 1);
      });
  }, [topic]);

  const cached = _cache.get(topic);
  const imgUrl = cached?.url;
  const loading = cached && !cached.done;

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={`rounded bg-white/5 animate-pulse ${className}`}
        style={{ width: size, height: size * 0.6 }}
      />
    );
  }

  // No image found
  if (!imgUrl) return null;

  return (
    <img
      src={imgUrl}
      alt={topic.replace(/_/g, ' ')}
      className={`rounded border border-white/10 object-cover ${className}`}
      style={{ maxWidth: size }}
    />
  );
}
