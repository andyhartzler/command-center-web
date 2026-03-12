'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { Tv, Volume2, VolumeX, Search, X, Radio } from 'lucide-react';
import type { LiveTVConfig, WidgetStyle } from '@/types/widget';

interface Channel {
  name: string;
  url: string;
  category: string;
}

const KC_CHANNELS: Channel[] = [
  { name: 'KSHB 41 (NBC)', url: 'https://content.uplynk.com/channel/50d0fa1b042945a3a4f550f9b8412c83.m3u8', category: 'KC Local' },
  { name: 'KCTV5 (CBS)', url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00312-graytelevisioni-kctv5news-vizious/playlist.m3u8', category: 'KC Local' },
  { name: 'KCPT PBS', url: 'https://pbs.lls.cdn.pbs.org/est/index.m3u8', category: 'KC Local' },
];

interface LiveTVWidgetProps {
  config: LiveTVConfig;
  style: WidgetStyle;
}

export function LiveTVWidget({ config }: LiveTVWidgetProps) {
  const [isMuted, setIsMuted] = useState(config.isMuted);
  const [showGuide, setShowGuide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Select initial channel
  useEffect(() => {
    if (config.selectedChannelURL) {
      const found = KC_CHANNELS.find(c => c.url === config.selectedChannelURL);
      setCurrentChannel(found || { name: config.selectedChannelName || 'Custom', url: config.selectedChannelURL, category: 'Custom' });
    } else if (KC_CHANNELS.length > 0) {
      setCurrentChannel(KC_CHANNELS[0]);
    }
  }, [config.selectedChannelURL, config.selectedChannelName]);

  // Attach HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentChannel) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hls.loadSource(currentChannel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = isMuted;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => hls.startLoad(), 3000);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = currentChannel.url;
      video.muted = isMuted;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update mute state on video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return KC_CHANNELS;
    const q = searchQuery.toLowerCase();
    return KC_CHANNELS.filter(
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
  };

  if (!currentChannel) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Tv size={24} className="text-white/30" />
        <span className="text-xs text-white/30">No channel selected</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseEnter={() => setShowGuide(true)}
      onMouseLeave={() => { setShowGuide(false); setSearchQuery(''); }}
    >
      {/* Video player */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted={isMuted}
        autoPlay
      />

      {/* Bottom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-xs font-medium text-white/90 truncate">
            {currentChannel.name}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(prev => !prev); }}
          className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          {isMuted ? (
            <VolumeX size={13} className="text-white/70" />
          ) : (
            <Volume2 size={13} className="text-white/70" />
          )}
        </button>
      </div>

      {/* Channel guide overlay - right side panel */}
      {showGuide && (
        <div
          className="absolute top-0 right-0 bottom-0 w-56 bg-zinc-950/95 backdrop-blur-md border-l border-white/10 flex flex-col overflow-hidden"
          onMouseEnter={() => setShowGuide(true)}
        >
          {/* Guide header */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-white/80">Channel Guide</span>
            <button
              onClick={() => { setShowGuide(false); setSearchQuery(''); }}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X size={12} className="text-white/50" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
              <Search size={11} className="text-white/30 shrink-0" />
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white/80 placeholder-white/25 outline-none w-full"
              />
            </div>
          </div>

          {/* Channel list */}
          <div className="flex-1 overflow-y-auto">
            {Object.entries(channelsByCategory).map(([category, channels]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                  {category}
                </div>
                {channels.map(channel => {
                  const isActive = currentChannel.url === channel.url;
                  return (
                    <button
                      key={channel.url}
                      onClick={() => selectChannel(channel)}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-white/5 transition-colors ${
                        isActive ? 'bg-white/10' : ''
                      }`}
                    >
                      <Radio
                        size={10}
                        className={isActive ? 'text-red-400' : 'text-white/20'}
                      />
                      <span className={`text-xs truncate ${isActive ? 'text-white font-medium' : 'text-white/60'}`}>
                        {channel.name}
                      </span>
                      {isActive && (
                        <span className="ml-auto relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {filteredChannels.length === 0 && (
              <div className="px-3 py-4 text-center">
                <span className="text-xs text-white/25">No channels match</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
