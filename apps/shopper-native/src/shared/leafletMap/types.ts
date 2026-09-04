/**
 * LeafletMap — shared types for the WebView/Leaflet map replacement.
 *
 * Why this exists: `react-native-maps` requires a Google Maps API key on
 * Android (a `com.google.android.geo.API_KEY` meta-data entry, normally
 * injected from `app.json`'s `expo.android.config.googleMaps.apiKey`). This
 * project never had one configured, and Google Cloud requires a billing
 * account (a credit card) to issue one at all. Without that key, the native
 * Google Maps SDK fails during `MapView`'s native initialization on Android
 * — not gracefully, it takes the whole process down. Every screen that
 * mounted a `react-native-maps` `MapView` (driver map, order tracking,
 * delivery-address picker) was one tap away from crashing the app.
 *
 * This replaces the native map with MapLibre GL JS running inside a
 * `react-native-webview`, styled from MapTiler's vector tiles (no Google
 * dependency, no billing account, works with a free-tier API key). It ships
 * through the same OTA update pipeline as everything else in this app — no
 * native rebuild required, since `react-native-webview` was already a
 * dependency.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends LatLng {
  /** Leaflet zoom level (roughly: 13 ≈ city district, 16 ≈ street). */
  zoom: number;
}

export interface MapMarkerSpec {
  id: string;
  coordinate: LatLng;
  /** Raw HTML rendered inside a Leaflet divIcon. Built by the `markerHtml`
   *  helpers in html.ts — kept as plain HTML/CSS rather than real React so
   *  the WebView never needs its own React runtime. */
  html: string;
  /** Pixel size of the divIcon's bounding box. */
  width: number;
  height: number;
  /** Anchor point as a 0..1 fraction of (width, height) — 0.5/1 for a pin
   *  that should touch the ground at its tip, 0.5/0.5 to center. */
  anchorX: number;
  anchorY: number;
  draggable?: boolean;
  /** Higher draws on top; used to keep the drag pin above branch markers. */
  zIndexOffset?: number;
}

export interface MapCircleSpec {
  id: string;
  center: LatLng;
  radiusMeters: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth?: number;
}

export interface MapPolyline {
  coordinates: LatLng[];
  color: string;
  width?: number;
  /** Dashed stroke — signals "as-the-crow-flies direction", not a real
   *  road-following route (this app has no routing/directions API). */
  dashed?: boolean;
}

export interface LeafletMapRef {
  animateToRegion: (region: MapRegion, durationMs?: number) => void;
  fitToCoordinates: (coordinates: LatLng[], paddingPx?: number) => void;
}

export interface LeafletMapProps {
  initialRegion: MapRegion;
  markers?: MapMarkerSpec[];
  circles?: MapCircleSpec[];
  polyline?: MapPolyline | null;
  onPress?: (coordinate: LatLng) => void;
  onMarkerPress?: (id: string) => void;
  onMarkerDragEnd?: (id: string, coordinate: LatLng) => void;
  /** MapTiler vector style id (e.g. "streets-v2") — resolved to that
   *  style's style.json. See https://docs.maptiler.com/cloud/api/maps/ */
  tileStyle?: string;
  zoomControl?: boolean;
  /** false renders a fixed, non-pannable/non-zoomable preview (drag, touch-zoom,
   *  scroll-zoom and double-click-zoom all disabled). Default true. Used by
   *  AddressMapPlaceholder's compact preview card, which sits inside a
   *  scrollable form — an interactive Leaflet map there would steal the
   *  parent ScrollView's drag gesture the moment a finger lands on the card. */
  interactive?: boolean;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
  testID?: string;
}

/** Messages the WebView posts back to React Native. */
export type LeafletOutboundMessage =
  | { type: "ready" }
  | { type: "press"; lat: number; lng: number }
  | { type: "markerPress"; id: string }
  | { type: "markerDragEnd"; id: string; lat: number; lng: number }
  | { type: "error"; message: string };
