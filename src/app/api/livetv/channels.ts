// Shared Live TV channel catalog + proxy host allowlist.
// Imported by both the LiveTVWidget (client) and the /api/livetv proxy route
// so the proxy allowlist is always derived from the same catalog.

export interface Channel {
  name: string;
  url: string;
  category: string;
  // Dynamic URL resolution. kmbc/kshb/wdaf scrape a single station page;
  // cnn/msnow health-check a POOL of mirrors and return whichever is live.
  resolver?: 'kmbc' | 'kshb' | 'wdaf' | 'cnn' | 'msnow';
}

// Failover pools for channels whose only free feeds are unstable grey-market
// relays (CNN and MSNBC pulled their free direct streams in 2026). The
// resolver health-checks every URL here in parallel and hands the widget the
// first one that is genuinely live (manifest + advancing/fresh segments), so
// a mirror dying just fails over to the next. Add a better source (including a
// paid one) by dropping its URL at the TOP of the relevant list — no other
// code changes needed. These hosts are also allowlisted for the proxy below.
export const CHANNEL_POOLS: Record<'cnn' | 'msnow', string[]> = {
  // CNN (US). All are HTTP IP relays; the proxy fetches them server-side and
  // re-serves over HTTPS, so the wall never loads mixed content directly.
  cnn: [
    'http://88.212.15.19/live/test_cnn_pirma_news/playlist.m3u8',
  ],
  // MS NOW (formerly MSNBC, rebranded 2026). 40.160.24.53 carries a clean,
  // consistently-live feed; the pirma relay is a secondary.
  msnow: [
    'http://40.160.24.53/MSNBC/index.m3u8',
    'http://88.212.15.19/live/test_msnbc_pirma_news/playlist.m3u8',
  ],
};

// All channels - KC Local + National + Free-TV IPTV
// Sources: direct CDN, jmp2.uk (Samsung TV Plus proxy), YouTube HLS proxy
export const ALL_CHANNELS: Channel[] = [
  // KC Local
  // KCTV5 (CBS) removed 2026-07-16: the amagi playlist 302s to
  // amg00312-graytelevisioni-kctv5news-vizious-ad-ui.amagi.tv, which no
  // longer resolves in DNS (verified dead stream).
  { name: 'KSHB 41 (NBC)', url: '', category: 'KC Local', resolver: 'kshb' },
  { name: 'KMBC 9 (ABC)', url: '', category: 'KC Local', resolver: 'kmbc' },
  { name: 'WDAF FOX 4', url: '', category: 'KC Local', resolver: 'wdaf' },
  { name: 'KCPT PBS', url: 'https://pbs.lls.cdn.pbs.org/est/index.m3u8', category: 'KC Local' },

  // US News - every URL re-verified 2026-08-10 (master -> variant -> segment)
  // CNN's free cnngo slate feed died 2026-07-20 (zombie manifest). It now
  // resolves through a health-checked failover pool (CHANNEL_POOLS.cnn)
  // instead of one hardcoded URL, so a dead mirror fails over automatically.
  { name: 'CNN', url: '', category: 'US News', resolver: 'cnn' },
  // MS NOW (formerly MSNBC). Same pooled-failover approach. The old entry
  // here was mislabeled "MSNBC" but actually pointed at Fox News Radio's
  // simulcast; that is now correctly named below, and this is the real thing.
  { name: 'MS NOW', url: '', category: 'US News', resolver: 'msnow' },
  { name: 'Fox News', url: 'https://jmp2.uk/plu-63d025db4e83e700086eaa96.m3u8', category: 'US News' },
  { name: 'Fox News Radio', url: 'https://radiovid.foxnews.com/hls/live/661547/RADIOVID/index.m3u8', category: 'US News' },
  // Replaced 2026-08-10: old abcnewshudson1/master_4000 path went dead;
  // this is ABC's DMD distribution endpoint (segment-verified).
  { name: 'ABC News Live', url: 'https://abc-news-dmd-streams-1.akamaized.net/out/v1/701126012d044971b3fa89406a440133/index.m3u8', category: 'US News' },
  // Replaced 2026-08-10: cbsnews.akamaized cbsnlineup_8 segments 404; this is
  // the official CBS News 24/7 FAST channel via Pluto.
  { name: 'CBS News', url: 'https://jmp2.uk/plu-6350fdd266e9ea0007bedec5.m3u8', category: 'US News' },
  { name: 'NBC News NOW', url: 'https://xumo-drct-nbcnn-ir8ze.fast.nbcuni.com/live/master.m3u8', category: 'US News' },
  { name: 'Bloomberg', url: 'https://bloomberg.com/media-manifest/streams/us.m3u8', category: 'US News' },
  { name: 'Fox Weather', url: 'https://247wlive.foxweather.com/stream/index.m3u8', category: 'US News' },
  { name: 'Scripps News', url: 'https://content.uplynk.com/channel/4bb4901b934c4e029fd4c1abfc766c37.m3u8', category: 'US News' },
  { name: 'Newsmax', url: 'https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8', category: 'US News' },
  // Replaced 2026-08-10: livenewsplay.com host dead; CNBC International FAST
  // feed (Samsung UK, amagi).
  { name: 'CNBC', url: 'https://amg01079-nbcuuk-amg01079c2-samsung-gb-1258.playouts.now.amagi.tv/playlist.m3u8', category: 'US News' },
  { name: 'Court TV', url: 'https://jmp2.uk/plu-64dab1f835425100080e1e7b.m3u8', category: 'US News' },
  // Replaced 2026-08-10: the ythls.armelin.one YouTube-HLS proxy service died
  // entirely (took out 6 channels); Reuters FAST feed via Rakuten (amagi).
  { name: 'Reuters', url: 'https://amg00453-reuters-amg00453c1-rakuten-uk-2110.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-rakutenuk/playlist.m3u8', category: 'US News' },
  { name: 'USA Today', url: 'https://live.enhdtv.com:8081/8192/index.m3u8', category: 'US News' },
  { name: 'AccuWeather', url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00684-accuweather-accuweather-plex/playlist.m3u8', category: 'US News' },

  // World News - every URL re-verified 2026-08-10; the six ythls.armelin.one
  // entries were replaced when that proxy service died.
  { name: 'BBC News', url: 'https://pb-iiczlgfysam0q.akamaized.net/v1/amcnetworks_bbcnews_1/samsungheadend_us/latest/main/hls/playlist.m3u8', category: 'World News' },
  { name: 'Sky News UK', url: 'https://jmp2.uk/plu-55b285cd2665de274553d66f.m3u8', category: 'World News' },
  { name: 'Al Jazeera', url: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8', category: 'World News' },
  { name: 'France 24', url: 'https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8', category: 'World News' },
  { name: 'DW News', url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8', category: 'World News' },
  { name: 'Euronews', url: 'https://jmp2.uk/plu-61de96114757070008d33cae.m3u8', category: 'World News' },
  // CGTN removed 2026-08-10: news.cgtn.com feed dead and the Rakuten FAST
  // mirror's variant playlists 404; no working English feed found.
  { name: 'India Today', url: 'https://indiatodaylive.akamaized.net/hls/live/2014320/indiatoday/indiatodaylive/playlist.m3u8', category: 'World News' },
  { name: 'CBC News', url: 'https://d2ny9lo79ujali.cloudfront.net/CBC_News_International.m3u8', category: 'World News' },
  { name: 'RT', url: 'https://rt-glb.rttv.com/live/rtnews/playlist.m3u8', category: 'World News' },
  { name: 'GB News', url: 'https://amg01076-lightningintern-gbnewsau-samsungau-et7fz.amagi.tv/playlist/amg01076-lightningintern-gbnewsau-samsungau/playlist.m3u8', category: 'World News' },

  // Sports - confirmed working free streams only
  { name: 'NFL Channel', url: 'https://jmp2.uk/plu-5a4d3a00ad95e4718ae8d8db.m3u8', category: 'Sports' },
  // Replaced 2026-08-10: old Pluto id dead; beIN's own amagi endpoint.
  { name: 'beIN SPORTS XTRA', url: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8', category: 'Sports' },

  // Public / Government
  // "PBS" duplicate removed 2026-07-16: it pointed at the exact same
  // pbs.lls.cdn.pbs.org URL as KCPT PBS in KC Local.
  { name: 'NASA TV', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', category: 'Public' },
  // Replaced 2026-08-10: KUVN feed segments 404; KMEX (same Univision
  // network feed) verified working.
  { name: 'Univision', url: 'https://streaming-live-fcdn.api.prd.univisionnow.com/kmex/kmex.isml/hls/kmex.m3u8', category: 'Public' },
  { name: 'Telemundo', url: 'https://cdn.igocast.com/wkrp_channel1_hls/wkrp_channel1_master.m3u8', category: 'Public' },
];

// Channels that no longer have any working free stream. A tile whose
// persisted selection matches one of these gets migrated to the mapped
// replacement instead of resurrecting a dead URL as a "Custom" channel.
// CNN is NOT here — it lives on via the failover pool (CHANNEL_POOLS.cnn).
export const RETIRED_CHANNELS: Record<string, string> = {
  'CGTN': 'DW News',
  'KCTV5 (CBS)': 'CBS News',
  // Old tiles tuned to "MSNBC" migrate to its rebrand + pooled feed.
  'MSNBC': 'MS NOW',
};

// URLs from these domains have proper CORS headers and can be played directly
export const CORS_SAFE_DOMAINS = [
  'akamaized.net', 'akamaihd.net',
  'cbsnews.akamaized.net',
  'uplynk.com',
  'warnermediacdn.com',
];

/** Registrable base domain of a hostname (last two labels). */
function baseDomain(host: string): string {
  const parts = host.split('.');
  return parts.length <= 2 ? host : parts.slice(-2).join('.');
}

// Segment / key / resolver CDNs that never appear in the catalog URLs
// themselves but carry its media: manifest redirects, resolver output, and
// proxy targets all land on these domains.
const COMPANION_SUFFIXES = [
  'googlevideo.com', // ythls.armelin.one manifests reference YouTube media
  'uplynk.com',      // KMBC / KSHB resolver output
  'lura.live',       // WDAF resolver API
  'anvato.net',      // WDAF segment CDN
  'akamaized.net',
  'akamaihd.net',
  'cloudfront.net',      // amagi / scripps manifest redirect targets
  'fastly.net',
  'samsungcloud.tv',     // jmp2.uk redirects into Samsung TV Plus CDN
  'samsungtvplus.com',
];

// Exact hosts allowlisted for the proxy that never appear as a catalog URL:
// the CNN/MS NOW failover pools are bare-IP relays, and baseDomain() cannot
// derive a usable suffix from an IP, so they are allowlisted verbatim.
const POOL_HOSTS: ReadonlySet<string> = new Set(
  Object.values(CHANNEL_POOLS)
    .flat()
    .map(u => {
      try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
    })
    .filter(Boolean)
);

/**
 * Proxy host allowlist derived from the channel catalog: the registrable
 * domain of every catalog URL plus the companion CDN suffixes above.
 */
export const ALLOWED_PROXY_SUFFIXES: ReadonlySet<string> = new Set([
  ...ALL_CHANNELS
    .filter(c => c.url)
    .map(c => baseDomain(new URL(c.url).hostname.toLowerCase())),
  ...COMPANION_SUFFIXES,
]);

/** True when `host` matches an allowlisted suffix (exact or subdomain). */
export function isAllowedProxyHost(host: string): boolean {
  const h = host.toLowerCase();
  if (POOL_HOSTS.has(h)) return true;
  for (const suffix of ALLOWED_PROXY_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return true;
  }
  return false;
}
