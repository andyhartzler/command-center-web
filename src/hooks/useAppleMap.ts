'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// Track global MapKit JS initialization state
let mapkitInitialized = false;
let mapkitInitPromise: Promise<void> | null = null;

function loadMapKitJS(): Promise<void> {
  if (mapkitInitPromise) return mapkitInitPromise;

  mapkitInitPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof mapkit !== 'undefined' && mapkitInitialized) {
      resolve();
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
    script.crossOrigin = 'anonymous';
    script.onload = async () => {
      try {
        // Fetch token and initialize
        const res = await fetch('/api/mapkit-token');
        if (!res.ok) throw new Error('Failed to fetch MapKit token');
        const { token } = await res.json();

        mapkit.init({
          authorizationCallback: (done) => done(token),
        });

        mapkitInitialized = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => reject(new Error('Failed to load MapKit JS'));
    document.head.appendChild(script);
  });

  return mapkitInitPromise;
}

interface UseAppleMapOptions {
  center: [number, number]; // [lat, lon]
  zoom?: number; // Approximate zoom level (Leaflet-compatible)
  interactive?: boolean;
}

// Convert Leaflet-style zoom to MapKit span
function zoomToSpan(zoom: number): [number, number] {
  // Approximate: zoom 2 = 180°, zoom 4 = 45°, zoom 8 = 2.8°, etc.
  const delta = 360 / Math.pow(2, zoom);
  return [delta, delta];
}

export function useAppleMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseAppleMapOptions
) {
  const mapRef = useRef<mapkit.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize map
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let destroyed = false;

    loadMapKitJS().then(() => {
      if (destroyed || !containerRef.current) return;

      const [latDelta, lonDelta] = zoomToSpan(options.zoom ?? 4);
      const region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(options.center[0], options.center[1]),
        new mapkit.CoordinateSpan(latDelta, lonDelta)
      );

      const map = new mapkit.Map(containerRef.current, {
        mapType: mapkit.Map.MapTypes.MutedStandard,
        colorScheme: mapkit.Map.ColorSchemes.Dark,
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsZoomControl: false,
        showsMapTypeControl: false,
        showsScale: mapkit.FeatureVisibility.Hidden,
        isScrollEnabled: options.interactive ?? true,
        isZoomEnabled: options.interactive ?? true,
        isRotationEnabled: false,
        region,
      });

      mapRef.current = map;
      setReady(true);
    }).catch((err) => {
      console.error('[useAppleMap] init failed:', err);
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
        setReady(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Add circle-style annotation (for earthquake dots, conflict markers, etc.)
  const addDotAnnotation = useCallback((
    lat: number,
    lon: number,
    opts: {
      color: string;
      radius: number; // px
      opacity?: number;
      data?: unknown;
      popupHtml?: string;
    }
  ): mapkit.Annotation | null => {
    const map = mapRef.current;
    if (!map) return null;

    const coord = new mapkit.Coordinate(lat, lon);
    const size = opts.radius * 2;

    const annotation = new mapkit.Annotation(
      coord,
      () => {
        const el = document.createElement('div');
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = '50%';
        el.style.backgroundColor = opts.color;
        el.style.opacity = String(opts.opacity ?? 0.7);
        el.style.border = `1px solid ${opts.color}`;
        el.style.cursor = 'pointer';
        return el;
      },
      {
        data: opts.data,
        anchorOffset: new DOMPoint(0, 0),
        callout: opts.popupHtml
          ? {
              calloutContentForAnnotation: () => {
                const el = document.createElement('div');
                el.innerHTML = opts.popupHtml!;
                return el;
              },
            }
          : undefined,
      }
    );

    map.addAnnotation(annotation);
    return annotation;
  }, []);

  // Clear all annotations
  const clearAnnotations = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.removeAnnotations(map.annotations);
  }, []);

  // Set region
  const setRegion = useCallback((lat: number, lon: number, zoom: number) => {
    const map = mapRef.current;
    if (!map) return;
    const [latDelta, lonDelta] = zoomToSpan(zoom);
    map.setRegionAnimated(
      new mapkit.CoordinateRegion(
        new mapkit.Coordinate(lat, lon),
        new mapkit.CoordinateSpan(latDelta, lonDelta)
      ),
      false
    );
  }, []);

  return {
    map: mapRef,
    ready,
    isReady: () => ready && mapRef.current !== null,
    addDotAnnotation,
    clearAnnotations,
    setRegion,
  };
}
