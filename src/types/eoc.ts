export interface EOCIncident {
  id: string;
  source: string;
  category: string;
  severity: string;
  title: string;
  description?: string;
  emoji: string;
  latitude: number;
  longitude: number;
  address?: string;
  detected_at: string;
  updated_at: string;
  resolved_at?: string;
  source_id?: string;
  raw_data?: EOCRawData;
}

export interface EOCRawData {
  police?: string;
  neighborhood?: string;
  incidentScore?: number;
  categories?: string[];
  level?: number;
  confirmed?: boolean;
  shareMap?: string;
  homescreenMapThumbnail?: string;
  updates?: Record<string, EOCUpdate>;
  liveStreamers?: Record<string, EOCLiveStream>;
  videoPreviewFeatured?: string;
}

export interface EOCUpdate {
  ts?: number;
  text?: string;
  type?: string;
  authorId?: string;
  displayLocation?: string;
  radioClips?: EOCRadioClip[];
}

export interface EOCRadioClip {
  source?: string;
  duration?: number;
  channelId?: string;
  audioFileUrl?: string;
  waveformImageUrl?: string;
  transcription?: EOCTranscription;
}

export interface EOCTranscription {
  text?: string;
  segments?: { start?: number; end?: number; text?: string }[];
}

export interface EOCLiveStream {
  cs?: number;
  ts?: number;
  hlsDone?: boolean;
  isOnAir?: boolean;
  username?: string;
  userFullName?: string;
  videoStreamId?: string;
  avatarThumbURL?: string;
}

// Scanner feed from the EOC server /api/scanner/feeds
export interface ScannerFeed {
  feed_id: string;
  feed_name: string;
  last_transcript_at?: string;
  transcript_count: number;
  is_active: boolean;
}

// Scanner transcript from the EOC server /api/scanner/transcripts
export interface ScannerTranscript {
  id: number;
  feed_id: string;
  feed_name: string;
  transcript: string;
  audio_rms?: number;
  created_at: string;
}

export interface EOCWSMessage {
  type: string;
  data?: EOCIncident | ScannerTranscript;
  id?: string;
  timestamp?: string;
}

// Hardcoded Broadcastify stream URLs (matching Swift app)
export const SCANNER_STREAM_URLS: Record<string, string> = {
  kcpd: 'https://broadcastify.cdnstream1.com/14439',
  kcfd: 'https://broadcastify.cdnstream1.com/36219',
  kc_regional: 'https://broadcastify.cdnstream1.com/23630',
};

// Default EOC server URL (matching Swift app)
export const DEFAULT_EOC_SERVER_URL = 'http://192.168.4.21:8080';
