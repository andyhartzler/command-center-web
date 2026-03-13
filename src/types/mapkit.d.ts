/* Minimal MapKit JS type declarations */
declare namespace mapkit {
  function init(options: {
    authorizationCallback: (done: (token: string) => void) => void;
  }): void;

  class Map {
    constructor(element: HTMLElement | string, options?: MapConstructorOptions);
    static readonly MapTypes: {
      Standard: string;
      MutedStandard: string;
      Satellite: string;
      Hybrid: string;
    };
    static readonly ColorSchemes: {
      Light: string;
      Dark: string;
    };
    region: CoordinateRegion;
    mapType: string;
    colorScheme: string;
    showsCompass: string;
    showsZoomControl: boolean;
    showsMapTypeControl: boolean;
    showsScale: string;
    isScrollEnabled: boolean;
    isZoomEnabled: boolean;
    isRotationEnabled: boolean;
    annotations: Annotation[];
    overlays: Overlay[];
    addAnnotation(annotation: Annotation): void;
    addAnnotations(annotations: Annotation[]): void;
    removeAnnotation(annotation: Annotation): void;
    removeAnnotations(annotations: Annotation[]): void;
    addOverlay(overlay: Overlay): void;
    removeOverlay(overlay: Overlay): void;
    removeOverlays(overlays: Overlay[]): void;
    setCenterAnimated(coordinate: Coordinate, animate?: boolean): void;
    setRegionAnimated(region: CoordinateRegion, animate?: boolean): void;
    destroy(): void;
  }

  interface MapConstructorOptions {
    mapType?: string;
    colorScheme?: string;
    showsCompass?: string;
    showsZoomControl?: boolean;
    showsMapTypeControl?: boolean;
    showsScale?: string;
    isScrollEnabled?: boolean;
    isZoomEnabled?: boolean;
    isRotationEnabled?: boolean;
    region?: CoordinateRegion;
    center?: Coordinate;
  }

  class Coordinate {
    constructor(latitude: number, longitude: number);
    latitude: number;
    longitude: number;
  }

  class CoordinateSpan {
    constructor(latitudeDelta: number, longitudeDelta: number);
    latitudeDelta: number;
    longitudeDelta: number;
  }

  class CoordinateRegion {
    constructor(center: Coordinate, span: CoordinateSpan);
    center: Coordinate;
    span: CoordinateSpan;
  }

  class Annotation {
    constructor(coordinate: Coordinate, factory: (coordinate: Coordinate, options: Record<string, unknown>) => HTMLElement, options?: AnnotationOptions);
    coordinate: Coordinate;
    data: unknown;
    element: HTMLElement;
    title: string;
    subtitle: string;
    selected: boolean;
    callout: CalloutDelegate;
  }

  interface AnnotationOptions {
    data?: unknown;
    title?: string;
    subtitle?: string;
    callout?: CalloutDelegate;
    animates?: boolean;
    anchorOffset?: { x: number; y: number };
  }

  interface CalloutDelegate {
    calloutContentForAnnotation?: (annotation: Annotation) => HTMLElement;
  }

  class MarkerAnnotation extends Annotation {
    constructor(coordinate: Coordinate, options?: MarkerAnnotationOptions);
    color: string;
    glyphColor: string;
    glyphText: string;
  }

  interface MarkerAnnotationOptions {
    color?: string;
    glyphColor?: string;
    glyphText?: string;
    title?: string;
    subtitle?: string;
    data?: unknown;
    callout?: CalloutDelegate;
  }

  class CircleOverlay implements Overlay {
    constructor(coordinate: Coordinate, radius: number, options?: OverlayOptions);
    style: OverlayStyle;
  }

  interface Overlay {
    style: OverlayStyle;
  }

  interface OverlayStyle {
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeOpacity: number;
    lineWidth: number;
  }

  interface OverlayOptions {
    style?: Partial<OverlayStyle>;
  }

  // For compatibility
  const FeatureVisibility: {
    Hidden: string;
    Visible: string;
    Adaptive: string;
  };
}
