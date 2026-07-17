// Shared Live TV channel catalog + proxy host allowlist.
// Imported by both the LiveTVWidget (client) and the /api/livetv proxy route
// so the proxy allowlist is always derived from the same catalog.

export interface Channel {
  name: string;
  url: string;
  category: string;
  resolver?: 'kmbc' | 'kshb' | 'wdaf'; // dynamic URL resolution
}

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

  // US News - all confirmed working direct streams
  { name: 'CNN', url: 'https://turnerlive.warnermediacdn.com/hls/live/586495/cnngo/cnn_slate/VIDEO_2_1964000.m3u8', category: 'US News' },
  { name: 'Fox News', url: 'https://jmp2.uk/plu-63d025db4e83e700086eaa96.m3u8', category: 'US News' },
  // Flagged: this entry was previously labeled "MSNBC" but the URL is Fox
  // News Radio's video simulcast (radiovid.foxnews.com). No free MSNBC
  // stream exists, so it is labeled for what it actually is.
  { name: 'Fox News Radio', url: 'https://radiovid.foxnews.com/hls/live/661547/RADIOVID/index.m3u8', category: 'US News' },
  { name: 'ABC News Live', url: 'https://abcnews-streams.akamaized.net/hls/live/2023560/abcnewshudson1/master_4000.m3u8', category: 'US News' },
  { name: 'CBS News', url: 'https://cbsnews.akamaized.net/hls/live/2020607/cbsnlineup_8/master.m3u8', category: 'US News' },
  { name: 'NBC News NOW', url: 'https://xumo-drct-nbcnn-ir8ze.fast.nbcuni.com/live/master.m3u8', category: 'US News' },
  { name: 'Bloomberg', url: 'https://bloomberg.com/media-manifest/streams/us.m3u8', category: 'US News' },
  { name: 'Fox Weather', url: 'https://247wlive.foxweather.com/stream/index.m3u8', category: 'US News' },
  { name: 'Scripps News', url: 'https://content.uplynk.com/channel/4bb4901b934c4e029fd4c1abfc766c37.m3u8', category: 'US News' },
  { name: 'Newsmax', url: 'https://nmxlive.akamaized.net/hls/live/529965/Live_1/index.m3u8', category: 'US News' },
  { name: 'CNBC', url: 'https://stream.livenewsplay.com:9443/hls/cnbc/cnbcsd.m3u8', category: 'US News' },
  { name: 'Court TV', url: 'https://jmp2.uk/plu-64dab1f835425100080e1e7b.m3u8', category: 'US News' },
  { name: 'Reuters', url: 'https://ythls.armelin.one/channel/UChqUTb7kYRX8-EiaN3XFrSQ.m3u8', category: 'US News' },
  { name: 'USA Today', url: 'https://live.enhdtv.com:8081/8192/index.m3u8', category: 'US News' },
  { name: 'AccuWeather', url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00684-accuweather-accuweather-plex/playlist.m3u8', category: 'US News' },

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

  // Sports - confirmed working free streams only
  { name: 'NFL Channel', url: 'https://jmp2.uk/plu-5a4d3a00ad95e4718ae8d8db.m3u8', category: 'Sports' },
  { name: 'beIN SPORTS XTRA', url: 'https://jmp2.uk/plu-5d8d180092e97a5e107638d3.m3u8', category: 'Sports' },

  // Public / Government
  // "PBS" duplicate removed 2026-07-16: it pointed at the exact same
  // pbs.lls.cdn.pbs.org URL as KCPT PBS in KC Local.
  { name: 'NASA TV', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', category: 'Public' },
  { name: 'Univision', url: 'https://streaming-live-fcdn.api.prd.univisionnow.com/kuvn/kuvn.isml/hls/kuvn.m3u8', category: 'Public' },
  { name: 'Telemundo', url: 'https://cdn.igocast.com/wkrp_channel1_hls/wkrp_channel1_master.m3u8', category: 'Public' },
];

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
  for (const suffix of ALLOWED_PROXY_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return true;
  }
  return false;
}
