// Widget types ported from Swift CommandCenter

export type WidgetFamily = 'small' | 'medium' | 'large' | 'wide' | 'extraLarge';

export type WidgetCategory =
  | 'Time & Location'
  | 'Productivity'
  | 'Media'
  | 'Finance'
  | 'World Monitor'
  | 'System';

export type WidgetType =
  | 'clock'
  | 'weather'
  | 'calendar'
  | 'reminders'
  | 'news'
  | 'worldNews'
  | 'webcams'
  | 'camera'
  | 'liveTV'
  | 'stocks'
  | 'crypto'
  | 'predictionMarkets'
  | 'sports'
  | 'sun'
  | 'earthquakes'
  | 'airTraffic'
  | 'conflict'
  | 'faaDelays'
  | 'wildfires'
  | 'moonPhase'
  | 'flightStatus'
  | 'aircraftTracker'
  | 'health'
  | 'homeKit';

export interface GridSize {
  columns: number;
  rows: number;
}

export interface GridPosition {
  column: number;
  row: number;
}

export interface WidgetStyle {
  showTitle: boolean;
  showBorder: boolean;
  opacity: number;
  cornerRadius: number;
}

// Widget configs
export interface ClockConfig {
  timezone: string;
  label: string;
  is24Hour: boolean;
  showSeconds: boolean;
}

export interface WeatherConfig {
  latitude: number;
  longitude: number;
  locationName: string;
  units: 'fahrenheit' | 'celsius';
}

export interface NewsConfig {
  maxItems: number;
  categories: string[];
  feeds?: { name: string; url: string }[];
}

export interface WorldNewsConfig {
  maxItems: number;
  categories: string[];
}

export interface StocksConfig {
  symbols: string[];
}

export interface CryptoConfig {
  coins: string[];
}

export interface SportsConfig {
  leagues: string[];
  favoriteTeams: string[];
}

export interface SunConfig {
  latitude: number;
  longitude: number;
}

export interface EarthquakeConfig {
  minMagnitude: number;
  maxQuakes: number;
  region: 'us' | 'world';
}

export interface AirTrafficConfig {
  centerLat: number;
  centerLon: number;
  radiusNm: number;
}

export interface ConflictConfig {
  maxEvents: number;
}

export interface FAADelaysConfig {
  watchedAirports: string[];
}

export interface WildfireConfig {
  region: 'us' | 'world';
}

export interface PredictionMarketsConfig {
  maxEvents: number;
}

export interface MoonPhaseConfig {
  latitude: number;
  longitude: number;
}

export interface WebcamConfig {
  cameraIds: string[];
  cameraNames: string[];
  corridorFilter: string[];
  loadAllCameras: boolean;
  rotateIntervalSeconds: number;
  viewMode: 'single' | 'rotate';
}

export interface CameraConfig {
  url: string;
  label: string;
  isMuted: boolean;
}

export interface LiveTVConfig {
  selectedChannelURL: string;
  selectedChannelName: string;
  isMuted: boolean;
  showIPTV: boolean;
}

export interface FlightStatusConfig {
  airport: string;
  mode: 'arrivals' | 'departures';
  limit: number;
}

export interface AircraftTrackerConfig {
  tailNumber: string;
  ownerLabel: string;
}

export type WidgetConfig =
  | { type: 'clock'; config: ClockConfig }
  | { type: 'weather'; config: WeatherConfig }
  | { type: 'news'; config: NewsConfig }
  | { type: 'worldNews'; config: WorldNewsConfig }
  | { type: 'stocks'; config: StocksConfig }
  | { type: 'crypto'; config: CryptoConfig }
  | { type: 'sports'; config: SportsConfig }
  | { type: 'sun'; config: SunConfig }
  | { type: 'earthquakes'; config: EarthquakeConfig }
  | { type: 'airTraffic'; config: AirTrafficConfig }
  | { type: 'conflict'; config: ConflictConfig }
  | { type: 'faaDelays'; config: FAADelaysConfig }
  | { type: 'wildfires'; config: WildfireConfig }
  | { type: 'predictionMarkets'; config: PredictionMarketsConfig }
  | { type: 'webcams'; config: WebcamConfig }
  | { type: 'camera'; config: CameraConfig }
  | { type: 'liveTV'; config: LiveTVConfig }
  | { type: 'moonPhase'; config: MoonPhaseConfig }
  | { type: 'flightStatus'; config: FlightStatusConfig }
  | { type: 'aircraftTracker'; config: AircraftTrackerConfig }
  | { type: 'calendar'; config: { feeds?: { name: string; url: string }[] } }
  | { type: 'reminders'; config: Record<string, never> }
  | { type: 'health'; config: Record<string, never> }
  | { type: 'homeKit'; config: Record<string, never> };

export interface DashboardWidget {
  id: string;
  widgetConfig: WidgetConfig;
  family: WidgetFamily;
  position: GridPosition;
  size?: GridSize;
  style: WidgetStyle;
}

// Family <-> grid size mapping
// Grid is 24x16 (each old cell is now 2x2 for finer placement)
export const FAMILY_GRID_SIZE: Record<WidgetFamily, GridSize> = {
  small: { columns: 4, rows: 4 },
  medium: { columns: 6, rows: 4 },
  large: { columns: 8, rows: 6 },
  wide: { columns: 12, rows: 4 },
  extraLarge: { columns: 12, rows: 8 },
};

export const FAMILY_DISPLAY_NAME: Record<WidgetFamily, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  wide: 'Wide',
  extraLarge: 'Extra Large',
};

export const WIDGET_TYPE_META: Record<WidgetType, {
  displayName: string;
  category: WidgetCategory;
  icon: string;
  color: string;
  defaultFamily: WidgetFamily;
  supportedFamilies: WidgetFamily[];
}> = {
  clock: { displayName: 'Clock', category: 'Time & Location', icon: 'clock', color: '#60a5fa', defaultFamily: 'small', supportedFamilies: ['small', 'medium', 'large'] },
  weather: { displayName: 'Weather', category: 'Time & Location', icon: 'cloud-sun', color: '#38bdf8', defaultFamily: 'medium', supportedFamilies: ['small', 'medium', 'large', 'wide'] },
  sun: { displayName: 'Sun & Moon', category: 'Time & Location', icon: 'sun', color: '#fbbf24', defaultFamily: 'medium', supportedFamilies: ['small', 'medium'] },
  calendar: { displayName: 'Calendar', category: 'Productivity', icon: 'calendar', color: '#f87171', defaultFamily: 'medium', supportedFamilies: ['medium', 'large'] },
  reminders: { displayName: 'Reminders', category: 'Productivity', icon: 'list-checks', color: '#fb923c', defaultFamily: 'medium', supportedFamilies: ['medium', 'large'] },
  news: { displayName: 'KC News', category: 'Media', icon: 'newspaper', color: '#3b82f6', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'wide', 'extraLarge'] },
  worldNews: { displayName: 'World News', category: 'Media', icon: 'globe', color: '#06b6d4', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'wide'] },
  webcams: { displayName: 'Traffic Cams', category: 'Media', icon: 'video', color: '#64748b', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'extraLarge'] },
  camera: { displayName: 'Camera', category: 'Media', icon: 'camera', color: '#34d399', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'wide', 'extraLarge'] },
  liveTV: { displayName: 'Live TV', category: 'Media', icon: 'tv', color: '#3b82f6', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'wide', 'extraLarge'] },
  sports: { displayName: 'Sports', category: 'Media', icon: 'trophy', color: '#eab308', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'wide'] },
  stocks: { displayName: 'Markets', category: 'Finance', icon: 'trending-up', color: '#34d399', defaultFamily: 'medium', supportedFamilies: ['small', 'medium', 'large'] },
  crypto: { displayName: 'Crypto', category: 'Finance', icon: 'bitcoin', color: '#fbbf24', defaultFamily: 'medium', supportedFamilies: ['small', 'medium', 'large'] },
  predictionMarkets: { displayName: 'Predictions', category: 'Finance', icon: 'bar-chart-3', color: '#3b82f6', defaultFamily: 'medium', supportedFamilies: ['medium', 'large'] },
  earthquakes: { displayName: 'Earthquakes', category: 'World Monitor', icon: 'activity', color: '#ef4444', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'extraLarge'] },
  airTraffic: { displayName: 'Air Traffic', category: 'World Monitor', icon: 'plane', color: '#38bdf8', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'extraLarge'] },
  conflict: { displayName: 'Conflict', category: 'World Monitor', icon: 'alert-triangle', color: '#ef4444', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'extraLarge'] },
  moonPhase: { displayName: 'Moon Phase', category: 'Time & Location', icon: 'moon', color: '#94a3b8', defaultFamily: 'small', supportedFamilies: ['small'] },
  flightStatus: { displayName: 'Flight Status', category: 'World Monitor', icon: 'plane-takeoff', color: '#38bdf8', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'wide', 'extraLarge'] },
  aircraftTracker: { displayName: 'Aircraft Tracker', category: 'World Monitor', icon: 'radar', color: '#a78bfa', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'wide'] },
  faaDelays: { displayName: 'FAA Delays', category: 'World Monitor', icon: 'plane-landing', color: '#fb923c', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'wide'] },
  wildfires: { displayName: 'Wildfires', category: 'World Monitor', icon: 'flame', color: '#fb923c', defaultFamily: 'large', supportedFamilies: ['medium', 'large', 'extraLarge'] },
  health: { displayName: 'Health', category: 'System', icon: 'heart', color: '#f472b6', defaultFamily: 'medium', supportedFamilies: ['medium', 'large', 'wide'] },
  homeKit: { displayName: 'HomeKit', category: 'System', icon: 'home', color: '#34d399', defaultFamily: 'medium', supportedFamilies: ['medium', 'large'] },
};

export function defaultConfig(type: WidgetType): WidgetConfig {
  switch (type) {
    case 'clock': return { type: 'clock', config: { timezone: 'America/Chicago', label: 'Kansas City', is24Hour: false, showSeconds: false } };
    case 'weather': return { type: 'weather', config: { latitude: 39.0997, longitude: -94.5786, locationName: 'Kansas City', units: 'fahrenheit' } };
    case 'news': return { type: 'news', config: { maxItems: 15, categories: ['local'] } };
    case 'worldNews': return { type: 'worldNews', config: { maxItems: 15, categories: ['world', 'us', 'tech', 'finance'] } };
    case 'stocks': return { type: 'stocks', config: { symbols: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'] } };
    case 'crypto': return { type: 'crypto', config: { coins: ['bitcoin', 'ethereum', 'solana'] } };
    case 'sports': return { type: 'sports', config: { leagues: ['nfl', 'nba', 'mlb'], favoriteTeams: ['Kansas City Chiefs', 'Kansas City Royals'] } };
    case 'sun': return { type: 'sun', config: { latitude: 39.0997, longitude: -94.5786 } };
    case 'earthquakes': return { type: 'earthquakes', config: { minMagnitude: 2.5, maxQuakes: 50, region: 'us' } };
    case 'airTraffic': return { type: 'airTraffic', config: { centerLat: 39.0997, centerLon: -94.5786, radiusNm: 50 } };
    case 'conflict': return { type: 'conflict', config: { maxEvents: 50 } };
    case 'faaDelays': return { type: 'faaDelays', config: { watchedAirports: ['MCI', 'ORD', 'ATL', 'DFW', 'DEN', 'LAX', 'JFK', 'SFO'] } };
    case 'wildfires': return { type: 'wildfires', config: { region: 'us' } };
    case 'predictionMarkets': return { type: 'predictionMarkets', config: { maxEvents: 8 } };
    case 'moonPhase': return { type: 'moonPhase', config: { latitude: 39.0997, longitude: -94.5786 } };
    case 'flightStatus': return { type: 'flightStatus', config: { airport: 'MCI', mode: 'arrivals', limit: 20 } };
    case 'aircraftTracker': return { type: 'aircraftTracker', config: { tailNumber: 'N233AB', ownerLabel: "Dad's Plane" } };
    case 'webcams': return { type: 'webcams', config: { cameraIds: [], cameraNames: [], corridorFilter: [], loadAllCameras: false, rotateIntervalSeconds: 15, viewMode: 'single' } };
    case 'camera': return { type: 'camera', config: { url: '', label: 'Camera', isMuted: true } };
    case 'liveTV': return { type: 'liveTV', config: { selectedChannelURL: '', selectedChannelName: '', isMuted: true, showIPTV: false } };
    case 'calendar': return { type: 'calendar', config: { feeds: [] } };
    case 'reminders': return { type: 'reminders', config: {} };
    case 'health': return { type: 'health', config: {} };
    case 'homeKit': return { type: 'homeKit', config: {} };
  }
}
