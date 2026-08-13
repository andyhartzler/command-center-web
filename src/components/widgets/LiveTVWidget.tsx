'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { Volume2, VolumeX, Search, X, Radio, ChevronDown } from 'lucide-react';
import { ALL_CHANNELS, CORS_SAFE_DOMAINS, RETIRED_CHANNELS, type Channel } from '@/app/api/livetv/channels';
import { useHlsSlot } from '@/lib/hlsBudget';
import { useStreamGuard } from '@/lib/streamGuard';
import { useAppState } from '@/context/AppState';
import type { LiveTVConfig, WidgetStyle } from '@/types/widget';

function proxyUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (CORS_SAFE_DOMAINS.some(d => host.endsWith(d))) return url;
  } catch { /* invalid URL, proxy it */ }
  return `/api/livetv?proxy=${encodeURIComponent(url)}`;
}

interface LiveTVWidgetProps {
  config: LiveTVConfig;
  style: WidgetStyle;
}

export function LiveTVWidget({ config }: LiveTVWidgetProps) {
  const { pages, updateWidget } = useAppState();
  const [isMuted, setIsMuted] = useState(config.isMuted);
  const [showGuide, setShowGuide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  // Bumping forces a full destroy/recreate of the HLS player on the same URL
  // (the stream guard's hard-recovery path).
  const [attachNonce, setAttachNonce] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<Channel | null>(null);
  channelRef.current = currentChannel;

  const slotGranted = useHlsSlot(true);

  // Persist channel + mute back through the app-state config path so a
  // reboot restores them. The widget locates itself by config reference.
  const persistConfig = useCallback((patch: Partial<LiveTVConfig>) => {
    for (const page of pages) {
      for (const w of page.widgets) {
        if (w.widgetConfig.type === 'liveTV' && w.widgetConfig.config === config) {
          updateWidget(w.id, {
            widgetConfig: { type: 'liveTV', config: { ...w.widgetConfig.config, ...patch } },
          });
          return;
        }
      }
    }
  }, [pages, updateWidget, config]);

  // Resolve dynamic channel URLs on mount (KC local stations only)
  useEffect(() => {
    async function resolveChannels() {
      for (const ch of ALL_CHANNELS) {
        if (ch.resolver && !ch.url) {
          try {
            const res = await fetch(`/api/livetv?channel=${ch.resolver}`);
            if (res.ok) {
              const data = await res.json();
              if (data.url) {
                setResolvedUrls(prev => ({ ...prev, [ch.resolver!]: data.url }));
              }
            }
          } catch (err) {
            console.error(`[LiveTV] Failed to resolve ${ch.resolver}:`, err);
          }
        }
      }
    }
    resolveChannels();

    // Re-resolve every 30 minutes
    const interval = setInterval(resolveChannels, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Get the effective URL for a channel (proxied if needed for CORS)
  const getChannelUrl = useCallback((channel: Channel): string => {
    let url = '';
    if (channel.resolver) {
      url = resolvedUrls[channel.resolver] || '';
    } else {
      url = channel.url;
    }
    return url ? proxyUrl(url) : '';
  }, [resolvedUrls]);

  // Select initial channel from persisted config. A persisted selection whose
  // channel was retired (dead free stream, e.g. CNN) migrates to its mapped
  // replacement instead of resurrecting the dead URL as a Custom channel.
  useEffect(() => {
    const retiredTo = config.selectedChannelName && RETIRED_CHANNELS[config.selectedChannelName];
    if (retiredTo) {
      const replacement = ALL_CHANNELS.find(c => c.name === retiredTo);
      setCurrentChannel(replacement || ALL_CHANNELS[0]);
    } else if (config.selectedChannelURL) {
      const found = ALL_CHANNELS.find(c => c.url === config.selectedChannelURL || c.name === config.selectedChannelName);
      setCurrentChannel(found || { name: config.selectedChannelName || 'Custom', url: config.selectedChannelURL, category: 'Custom' });
    } else if (config.selectedChannelName) {
      const found = ALL_CHANNELS.find(c => c.name === config.selectedChannelName);
      if (found) setCurrentChannel(found);
      else setCurrentChannel(ALL_CHANNELS[0]);
    } else {
      setCurrentChannel(ALL_CHANNELS[0]);
    }
  }, [config.selectedChannelURL, config.selectedChannelName]);

  const currentUrl = currentChannel ? getChannelUrl(currentChannel) : '';

  // Attach HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentUrl || !slotGranted) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Aggressively disable captions on the video element
    const disableCaptions = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
    };

    // Listen for any new text tracks being added (catches native WebVTT/CEA-608/708)
    video.textTracks.addEventListener('addtrack', disableCaptions);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        enableCEA708Captions: false,
        renderTextTracksNatively: false,
      });
      hls.loadSource(currentUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        if (hls.subtitleTrack !== -1) hls.subtitleTrack = -1;
        disableCaptions();
      });
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        hls.subtitleTrack = -1;
        disableCaptions();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Fast path: retry in place. The stream guard escalates to a
            // full recreate (with backoff) if frames still don't advance.
            const channel = channelRef.current;
            if (channel?.resolver) {
              // Stale resolved URL: re-resolve and let the effect re-attach
              fetch(`/api/livetv?channel=${channel.resolver}`)
                .then(r => r.json())
                .then(d => {
                  if (d.url) {
                    setResolvedUrls(prev => ({ ...prev, [channel.resolver!]: d.url }));
                  }
                })
                .catch(() => {});
            } else {
              setTimeout(() => hls.startLoad(), 3000);
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = currentUrl;
      video.play().catch(() => {});
    }

    return () => {
      video.textTracks.removeEventListener('addtrack', disableCaptions);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentUrl, slotGranted, attachNonce]);

  // Liveness authority: recovers frozen/zombie streams (stale manifests keep
  // returning 200 while segments 404, which never surfaces as a fatal error)
  // and drives the OFFLINE state from actual frame advancement.
  const hardRecover = useCallback(() => {
    const channel = channelRef.current;
    if (channel?.resolver) {
      // Refresh the resolved URL first so the recreate attaches fresh tokens;
      // bump the nonce either way so a same-URL result still recreates.
      fetch(`/api/livetv?channel=${channel.resolver}`)
        .then(r => r.json())
        .then(d => {
          if (d.url) {
            setResolvedUrls(prev => ({ ...prev, [channel.resolver!]: d.url }));
          }
        })
        .catch(() => {})
        .finally(() => setAttachNonce(n => n + 1));
    } else {
      setAttachNonce(n => n + 1);
    }
  }, []);

  const guardStatus = useStreamGuard({
    active: !!currentUrl && slotGranted,
    sourceKey: currentUrl,
    videoRef,
    softRecover: () => hlsRef.current?.startLoad(),
    hardRecover,
  });

  // Update mute state
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return ALL_CHANNELS;
    const q = searchQuery.toLowerCase();
    return ALL_CHANNELS.filter(
      c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group channels by category
  const channelsByCategory = useMemo(() => {
    const groups: Record<string, Channel[]> = {};
    for (const ch of filteredChannels) {
      if (!groups[ch.category]) groups[ch.category] = [];
      groups[ch.category].push(ch);
    }
    return groups;
  }, [filteredChannels]);

  const selectChannel = (channel: Channel) => {
    setCurrentChannel(channel);
    setShowGuide(false);
    setSearchQuery('');
    persistConfig({ selectedChannelName: channel.name, selectedChannelURL: channel.url });
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      persistConfig({ isMuted: next });
      return next;
    });
  };

  if (!currentChannel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <span className="type-label">No channel selected</span>
      </div>
    );
  }

  const paused = !slotGranted;
  const isResolving = !!currentChannel.resolver && !currentUrl;
  // Connecting/reconnecting overlays stay removed; OFFLINE comes only from
  // the stream guard after sustained frame-advance failure, and the stale
  // last frame is dimmed so it cannot masquerade as live.
  const showOffline = !paused && !isResolving && guardStatus === 'down';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{
          opacity: showOffline ? 0.25 : 1,
          filter: showOffline ? 'grayscale(1)' : 'none',
          transition: 'opacity 400ms var(--ease-out), filter 400ms var(--ease-out)',
        }}
        playsInline
        muted={isMuted}
        autoPlay
      />

      {/* Only a genuinely dead channel shows a chip; no connecting spam */}
      {showOffline && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="glass-chip px-3 py-1.5 font-mono text-[12px] uppercase"
            style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-critical)' }}
          >
            Offline
          </span>
        </div>
      )}

      {/* Bottom-left channel chip: hover-only so the wall is clean video at
          rest, but the channel guide stays reachable on hover. */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="glass-chip flex items-center gap-2 px-2.5 py-1.5 hover:brightness-125 transition-[filter]"
        >
          {guardStatus === 'live' && !paused && (
            <span className="live-dot live-dot--live shrink-0" aria-hidden />
          )}
          <span
            className="font-mono text-[12px] uppercase truncate max-w-[180px]"
            style={{ letterSpacing: 'var(--tracking-caps)', color: 'var(--color-text-2)' }}
          >
            {currentChannel.name}
          </span>
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${showGuide ? 'rotate-180' : ''}`}
            style={{ color: 'var(--color-text-3)' }}
          />
        </button>
      </div>

      {/* Bottom-right: mute toggle on hover */}
      <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="glass-chip w-8 h-8 flex items-center justify-center hover:brightness-125 transition-[filter]"
        >
          {isMuted ? (
            <VolumeX size={13} style={{ color: 'var(--color-text-2)' }} />
          ) : (
            <Volume2 size={13} style={{ color: 'var(--color-text-2)' }} />
          )}
        </button>
      </div>

      {/* Channel guide overlay */}
      {showGuide && (
        <div
          className="absolute inset-0 backdrop-blur-xl flex flex-col overflow-hidden z-20"
          style={{ background: 'var(--glass-bg)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Guide header */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="type-label">Channels</span>
            <button
              onClick={() => { setShowGuide(false); setSearchQuery(''); }}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X size={12} style={{ color: 'var(--color-text-3)' }} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
              <Search size={12} className="shrink-0" style={{ color: 'var(--color-text-3)' }} />
              <input
                type="text"
                placeholder="Search channels"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-[12px] placeholder-white/25 outline-none w-full"
                style={{ color: 'var(--color-text-2)' }}
              />
            </div>
          </div>

          {/* Channel list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {Object.entries(channelsByCategory).map(([category, channels]) => (
              <div key={category}>
                <div
                  className="px-3 py-1.5 type-label sticky top-0 backdrop-blur-sm"
                  style={{ background: 'var(--glass-bg)' }}
                >
                  {category}
                </div>
                {channels.map(channel => {
                  const isActive = currentChannel.name === channel.name;
                  const channelUrl = getChannelUrl(channel);
                  const isUnavailable = channel.resolver && !channelUrl;
                  return (
                    <button
                      key={channel.name}
                      onClick={() => !isUnavailable && selectChannel(channel)}
                      className={`w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-white/5 transition-colors ${
                        isActive ? 'bg-white/10' : ''
                      } ${isUnavailable ? 'opacity-40' : ''}`}
                      disabled={!!isUnavailable}
                    >
                      <Radio
                        size={10}
                        style={{ color: isActive ? 'var(--color-live)' : 'var(--color-text-3)' }}
                      />
                      <span
                        className={`text-[12px] truncate flex-1 ${isActive ? 'font-medium' : ''}`}
                        style={{ color: isActive ? 'var(--color-text-1)' : 'var(--color-text-2)' }}
                      >
                        {channel.name}
                      </span>
                      {isActive && guardStatus === 'live' && (
                        <span className="live-dot live-dot--live shrink-0" aria-hidden />
                      )}
                      {isUnavailable && (
                        <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                          resolving
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {filteredChannels.length === 0 && (
              <div className="px-3 py-4 text-center">
                <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                  No channels match
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
