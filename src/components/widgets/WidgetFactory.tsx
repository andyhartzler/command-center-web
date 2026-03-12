'use client';
import { type DashboardWidget, WIDGET_TYPE_META } from '@/types/widget';
import dynamic from 'next/dynamic';

const ClockWidget = dynamic(() => import('./ClockWidget').then(m => ({ default: m.ClockWidget })), { ssr: false });
const WeatherWidget = dynamic(() => import('./WeatherWidget').then(m => ({ default: m.WeatherWidget })), { ssr: false });
const NewsWidget = dynamic(() => import('./NewsWidget').then(m => ({ default: m.NewsWidget })), { ssr: false });
const WorldNewsWidget = dynamic(() => import('./WorldNewsWidget').then(m => ({ default: m.WorldNewsWidget })), { ssr: false });
const StocksWidget = dynamic(() => import('./StocksWidget').then(m => ({ default: m.StocksWidget })), { ssr: false });
const CryptoWidget = dynamic(() => import('./CryptoWidget').then(m => ({ default: m.CryptoWidget })), { ssr: false });
const SportsWidget = dynamic(() => import('./SportsWidget').then(m => ({ default: m.SportsWidget })), { ssr: false });
const SunWidget = dynamic(() => import('./SunWidget').then(m => ({ default: m.SunWidget })), { ssr: false });
const FAADelaysWidget = dynamic(() => import('./FAADelaysWidget').then(m => ({ default: m.FAADelaysWidget })), { ssr: false });
const PredictionMarketsWidget = dynamic(() => import('./PredictionMarketsWidget').then(m => ({ default: m.PredictionMarketsWidget })), { ssr: false });
const EarthquakeWidget = dynamic(() => import('./EarthquakeWidget').then(m => ({ default: m.EarthquakeWidget })), { ssr: false });
const AirTrafficWidget = dynamic(() => import('./AirTrafficWidget').then(m => ({ default: m.AirTrafficWidget })), { ssr: false });
const ConflictWidget = dynamic(() => import('./ConflictWidget').then(m => ({ default: m.ConflictWidget })), { ssr: false });
const WildfireWidget = dynamic(() => import('./WildfireWidget').then(m => ({ default: m.WildfireWidget })), { ssr: false });
const WebcamsWidget = dynamic(() => import('./WebcamsWidget').then(m => ({ default: m.WebcamsWidget })), { ssr: false });
const CameraWidget = dynamic(() => import('./CameraWidget').then(m => ({ default: m.CameraWidget })), { ssr: false });
const LiveTVWidget = dynamic(() => import('./LiveTVWidget').then(m => ({ default: m.LiveTVWidget })), { ssr: false });
const MoonPhaseWidget = dynamic(() => import('./MoonPhaseWidget').then(m => ({ default: m.MoonPhaseWidget })), { ssr: false });
const FlightStatusWidget = dynamic(() => import('./FlightStatusWidget').then(m => ({ default: m.FlightStatusWidget })), { ssr: false });
const AircraftTrackerWidget = dynamic(() => import('./AircraftTrackerWidget').then(m => ({ default: m.AircraftTrackerWidget })), { ssr: false });
const CalendarWidget = dynamic(() => import('./CalendarWidget').then(m => ({ default: m.CalendarWidget })), { ssr: false });
const PlaceholderWidget = dynamic(() => import('./PlaceholderWidget').then(m => ({ default: m.PlaceholderWidget })), { ssr: false });

interface WidgetFactoryProps {
  widget: DashboardWidget;
}

export function WidgetFactory({ widget }: WidgetFactoryProps) {
  const { widgetConfig, style } = widget;

  switch (widgetConfig.type) {
    case 'clock': return <ClockWidget config={widgetConfig.config} style={style} />;
    case 'weather': return <WeatherWidget config={widgetConfig.config} style={style} />;
    case 'news': return <NewsWidget config={widgetConfig.config} style={style} />;
    case 'worldNews': return <WorldNewsWidget config={widgetConfig.config} style={style} />;
    case 'stocks': return <StocksWidget config={widgetConfig.config} style={style} />;
    case 'crypto': return <CryptoWidget config={widgetConfig.config} style={style} />;
    case 'sports': return <SportsWidget config={widgetConfig.config} style={style} />;
    case 'sun': return <SunWidget config={widgetConfig.config} style={style} />;
    case 'faaDelays': return <FAADelaysWidget config={widgetConfig.config} style={style} />;
    case 'predictionMarkets': return <PredictionMarketsWidget config={widgetConfig.config} style={style} />;
    case 'earthquakes': return <EarthquakeWidget config={widgetConfig.config} style={style} />;
    case 'airTraffic': return <AirTrafficWidget config={widgetConfig.config} style={style} />;
    case 'conflict': return <ConflictWidget config={widgetConfig.config} style={style} />;
    case 'wildfires': return <WildfireWidget config={widgetConfig.config} style={style} />;
    case 'webcams': return <WebcamsWidget config={widgetConfig.config} style={style} />;
    case 'camera': return <CameraWidget config={widgetConfig.config} style={style} />;
    case 'liveTV': return <LiveTVWidget config={widgetConfig.config} style={style} />;
    case 'moonPhase': return <MoonPhaseWidget config={widgetConfig.config} style={style} />;
    case 'flightStatus': return <FlightStatusWidget config={widgetConfig.config} style={style} />;
    case 'aircraftTracker': return <AircraftTrackerWidget config={widgetConfig.config} style={style} />;
    case 'calendar': return <CalendarWidget config={widgetConfig.config} style={style} />;
    case 'reminders':
    case 'health':
    case 'homeKit': {
      const meta = WIDGET_TYPE_META[widgetConfig.type];
      return <PlaceholderWidget name={meta.displayName} icon={meta.icon} color={meta.color} />;
    }
    default: {
      // Safety net for removed/unknown widget types
      return <PlaceholderWidget name="Unknown" icon="cpu" color="#64748b" />;
    }
  }
}
