'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { Tv, Volume2, VolumeX, Search, X, Radio, ChevronDown } from 'lucide-react';
import type { LiveTVConfig, WidgetStyle } from '@/types/widget';

interface Channel {
  name: string;
  url: string;
  category: string;
  resolver?: 'kmbc' | 'kshb' | 'wdaf' | 'pluto'; // dynamic URL resolution
  plutoId?: string; // Pluto TV channel ID
}

// All channels - KC Local + National + Free-TV IPTV
const ALL_CHANNELS: Channel[] = [
  // KC Local
  { name: 'KSHB 41 (NBC)', url: '', category: 'KC Local', resolver: 'kshb' },
  { name: 'KMBC 9 (ABC)', url: '', category: 'KC Local', resolver: 'kmbc' },
  { name: 'KCTV5 (CBS)', url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00312-graytelevisioni-kctv5news-vizious/playlist.m3u8', category: 'KC Local' },
  { name: 'WDAF FOX 4', url: '', category: 'KC Local', resolver: 'wdaf' },
  { name: 'KCPT PBS', url: 'https://pbs.lls.cdn.pbs.org/est/index.m3u8', category: 'KC Local' },

  // US News
  { name: 'CNN', url: '', category: 'US News', resolver: 'pluto', plutoId: '623aaa3cfe498e0007d33dab' },
  { name: 'Fox News', url: '', category: 'US News', resolver: 'pluto', plutoId: '63d025db4e83e700086eaa96' },
  { name: 'MSNBC', url: '', category: 'US News', resolver: 'pluto', plutoId: '623aaab9f2bd280007ecc1cb' },
  { name: 'ABC News Live', url: 'https://aegis-cloudfront-1.tubi.video/d6cbb0de-68e4-4f3b-82f9-bf5d526e0bde/index.m3u8', category: 'US News' },
  { name: 'CBS News', url: 'https://cbsnews.akamaized.net/hls/live/2020607/cbsnlineup_8/master.m3u8', category: 'US News' },
  { name: 'NBC News NOW', url: 'https://xumo-drct-nbcnn-ir8ze.fast.nbcuni.com/live/master.m3u8', category: 'US News' },
  { name: 'Bloomberg', url: 'https://bloomberg.com/media-manifest/streams/us.m3u8', category: 'US News' },
  { name: 'Fox Weather', url: 'https://247wlive.foxweather.com/stream/index.m3u8', category: 'US News' },
  { name: 'Scripps News', url: 'https://content.uplynk.com/channel/4bb4901b934c4e029fd4c1abfc766c37.m3u8', category: 'US News' },
  { name: 'Newsmax', url: 'https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8', category: 'US News' },
  { name: 'CNBC', url: '', category: 'US News', resolver: 'pluto', plutoId: '62bd0e3a05f7720007f90fe5' },
  { name: 'USA Today', url: '', category: 'US News', resolver: 'pluto', plutoId: '5eb1ea5ce6523b00073ade2e' },
  { name: 'Reuters', url: '', category: 'US News', resolver: 'pluto', plutoId: '5c73a81e14ee6a00099d44d2' },

  // World News
  { name: 'BBC News', url: 'https://pb-iiczlgfysam0q.akamaized.net/v1/amcnetworks_bbcnews_1/samsungheadend_us/latest/main/hls/playlist.m3u8', category: 'World News' },
  { name: 'Sky News UK', url: 'https://ythls.armelin.one/channel/UCoMdktPbSTixAyNGwb-UYkQ.m3u8', category: 'World News' },
  { name: 'Al Jazeera', url: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8', category: 'World News' },
  { name: 'France 24', url: 'https://ythls.armelin.one/channel/UCQfwfsi5VrQ8yKZ-UWmAEFg.m3u8', category: 'World News' },
  { name: 'DW News', url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8', category: 'World News' },
  { name: 'Euronews', url: 'https://ythls.armelin.one/channel/UCW2QcKZiU8aUGg4yxCIditg.m3u8', category: 'World News' },
  { name: 'CGTN', url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8', category: 'World News' },
  { name: 'India Today', url: 'https://indiatodaylive.akamaized.net/hls/live/2014320/indiatoday/indiatodaylive/playlist.m3u8', category: 'World News' },
  { name: 'CBC News', url: 'https://ythls.armelin.one/channel/UCuFFtHWoLl5fauMMD5Ww2jA.m3u8', category: 'World News' },
  { name: 'RT', url: 'https://rt-glb.rttv.com/live/rtnews/playlist.m3u8', category: 'World News' },
  { name: 'GB News', url: 'https://ythls.armelin.one/channel/UC0vn8ISa4LKMunLbzaXLnOQ.m3u8', category: 'World News' },

  // Sports
  { name: 'ESPN (CBS Sports HQ)', url: '', category: 'Sports', resolver: 'pluto', plutoId: '5db99dd42c724f00099da498' },
  { name: 'Fox Sports', url: '', category: 'Sports', resolver: 'pluto', plutoId: '5fd69f5b2e21d80007ad2f82' },
  { name: 'NFL Channel', url: '', category: 'Sports', resolver: 'pluto', plutoId: '5a4d3a00ad95e4718ae8d8db' },
  { name: 'beIN SPORTS XTRA', url: '', category: 'Sports', resolver: 'pluto', plutoId: '5d8d180092e97a5e107638d3' },
  { name: 'PGA Tour', url: '', category: 'Sports', resolver: 'pluto', plutoId: '5fd1dcafdb95b600071e3b4f' },

  // Public / Government
  { name: 'NASA TV', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', category: 'Public' },
  { name: 'PBS', url: 'https://pbs.lls.cdn.pbs.org/est/index.m3u8', category: 'Public' },
  { name: 'Univision', url: 'https://streaming-live-fcdn.api.prd.univisionnow.com/kuvn/kuvn.isml/hls/kuvn.m3u8', category: 'Public' },
  { name: 'Telemundo', url: 'https://cdn.igocast.com/wkrp_channel1_hls/wkrp_channel1_master.m3u8', category: 'Public' },

  // Entertainment (Pluto TV)
  { name: 'BBC Food', url: '', category: 'Entertainment', resolver: 'pluto', plutoId: '5fb5844bf5514d0007945bda' },
  { name: 'BBC Home', url: '', category: 'Entertainment', resolver: 'pluto', plutoId: '5fb5836fe745b600070fc743' },
];

function buildPlutoUrl(channelId: string): string {
  const sid = crypto.randomUUID().replace(/-/g, '');
  return `https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/stitch/hls/channel/${channelId}/master.m3u8?deviceType=web&deviceId=${sid}&deviceMake=Chrome&deviceModel=Chrome&deviceVersion=120&appVersion=7.0.0&sid=${sid}&deviceDNT=0`;
}

// URLs from these domains have proper CORS headers and can be played directly
const CORS_SAFE_DOMAINS = [
  'akamaized.net', 'akamaihd.net',
  'cbsnews.akamaized.net',
  'uplynk.com',
  'warnermediacdn.com',
];

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
  const [isMuted, setIsMuted] = useState(config.isMuted);
  const [showGuide, setShowGuide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve dynamic channel URLs on mount
  useEffect(() => {
    async function resolveChannels() {
      for (const ch of ALL_CHANNELS) {
        if (ch.resolver === 'pluto' && ch.plutoId) {
          setResolvedUrls(prev => ({ ...prev, [`pluto-${ch.plutoId}`]: buildPlutoUrl(ch.plutoId!) }));
        } else if (ch.resolver && !ch.url) {
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
    if (channel.resolver === 'pluto' && channel.plutoId) {
      url = resolvedUrls[`pluto-${channel.plutoId}`] || buildPlutoUrl(channel.plutoId);
    } else if (channel.resolver) {
      url = resolvedUrls[channel.resolver] || '';
    } else {
      url = channel.url;
    }
    return url ? proxyUrl(url) : '';
  }, [resolvedUrls]);

  // Select initial channel
  useEffect(() => {
    if (config.selectedChannelURL) {
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

  // Attach HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentChannel) return;

    const url = getChannelUrl(currentChannel);
    if (!url) return;

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
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = isMuted;
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
            if (currentChannel.resolver && currentChannel.resolver !== 'pluto') {
              setResolving(currentChannel.resolver);
              fetch(`/api/livetv?channel=${currentChannel.resolver}`)
                .then(r => r.json())
                .then(d => {
                  if (d.url) {
                    setResolvedUrls(prev => ({ ...prev, [currentChannel.resolver!]: d.url }));
                  }
                  setResolving(null);
                })
                .catch(() => setResolving(null));
            } else if (currentChannel.resolver === 'pluto' && currentChannel.plutoId) {
              // Refresh Pluto URL
              const newUrl = buildPlutoUrl(currentChannel.plutoId);
              setResolvedUrls(prev => ({ ...prev, [`pluto-${currentChannel.plutoId}`]: newUrl }));
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
      video.src = url;
      video.muted = isMuted;
      video.play().catch(() => {});
    }

    return () => {
      video.textTracks.removeEventListener('addtrack', disableCaptions);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentChannel, getChannelUrl, resolvedUrls]); // eslint-disable-line react-hooks/exhaustive-deps

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
  };

  if (!currentChannel) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
        <Tv size={24} className="text-white/30" />
        <span className="text-xs text-white/30">No channel selected</span>
      </div>
    );
  }

  const currentUrl = getChannelUrl(currentChannel);
  const isResolving = currentChannel.resolver && currentChannel.resolver !== 'pluto' && !currentUrl;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
    >
      {/* Video player */}
      {isResolving ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
          <span className="text-xs text-white/30">Loading {currentChannel.name}...</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted={isMuted}
          autoPlay
        />
      )}

      {/* Channel selector dropdown at top */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          <span className="text-xs font-medium text-white/90 truncate">
            {currentChannel.name}
          </span>
          <ChevronDown size={12} className={`text-white/50 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Bottom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 min-w-0">
          {resolving && (
            <span className="text-[9px] text-yellow-400/60">reconnecting...</span>
          )}
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

      {/* Channel guide overlay */}
      {showGuide && (
        <div
          className="absolute inset-0 bg-[#1c1c1e]/95 backdrop-blur-xl flex flex-col overflow-hidden z-20"
          onClick={e => e.stopPropagation()}
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
                <div className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider sticky top-0 bg-[#1c1c1e]/95 backdrop-blur-sm">
                  {category}
                </div>
                {channels.map(channel => {
                  const isActive = currentChannel.name === channel.name;
                  const channelUrl = getChannelUrl(channel);
                  const isUnavailable = channel.resolver && channel.resolver !== 'pluto' && !channelUrl;
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
                        className={isActive ? 'text-red-400' : 'text-white/20'}
                      />
                      <span className={`text-xs truncate flex-1 ${isActive ? 'text-white font-medium' : 'text-white/60'}`}>
                        {channel.name}
                      </span>
                      {isActive && (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                        </span>
                      )}
                      {isUnavailable && (
                        <span className="text-[8px] text-white/30">loading...</span>
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
