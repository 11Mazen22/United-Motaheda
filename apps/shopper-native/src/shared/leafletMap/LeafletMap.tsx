/**
 * LeafletMap — WebView/Leaflet map, tiled from Geoapify. See types.ts for
 * the full rationale (react-native-maps needs a Google Maps API key this
 * project has never had, which crashes the app on Android the instant any
 * MapView mounts). This is the drop-in replacement's shared engine; each
 * screen (DriverMap, TrackOrderScreen, DeliveryMap) builds its own marker
 * HTML via the helpers in html.ts and renders this component underneath.
 *
 * Bridge shape: React Native pushes state INTO the page via
 * `injectJavaScript` calls to the `window.__sync*`/`window.__animate*`
 * functions defined in html.ts's document. The page pushes events OUT via
 * `window.ReactNativeWebView.postMessage`, parsed in `onMessage` below and
 * routed to whichever prop callback applies. There is no two-way data
 * binding beyond that — every render diff is a full re-sync of markers/
 * circles/polyline, which is trivial at this app's marker counts (a handful
 * of branches, one or two live pins) and far simpler than incremental
 * patching would be.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@pharmacy/ui-native";
import { buildMapHtml } from "./html";
import type { LeafletMapProps, LeafletMapRef, LeafletOutboundMessage } from "./types";

const GEOAPIFY_KEY = (process.env["EXPO_PUBLIC_GEOAPIFY_KEY"] as string | undefined) ?? "";
const DEFAULT_STYLE = "osm-bright";

function tileUrlFor(style: string): string {
  return `https://maps.geoapify.com/v1/tile/${style}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`;
}

export const LeafletMap = forwardRef<LeafletMapRef, LeafletMapProps>(function LeafletMap(
  {
    initialRegion, markers = [], circles = [], polyline = null,
    onPress, onMarkerPress, onMarkerDragEnd,
    tileStyle = DEFAULT_STYLE, zoomControl = true, style, testID,
  },
  ref,
) {
  const { theme } = useTheme();
  const webviewRef = useRef<WebView>(null);
  const ready = useRef(false);
  const pendingSync = useRef<{ markers: typeof markers; circles: typeof circles; polyline: typeof polyline } | null>(null);

  // Region/tileStyle only ever seed the initial document -- changing them
  // after mount goes through animateToRegion instead, so this is
  // intentionally not a dependency of the WebView's `source`.
  const html = useMemo(
    () => buildMapHtml(initialRegion, tileUrlFor(tileStyle), zoomControl),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const run = useCallback((script: string) => {
    webviewRef.current?.injectJavaScript(`${script};true;`);
  }, []);

  const syncMarkers = useCallback(() => {
    run(`window.__syncMarkers(${JSON.stringify(JSON.stringify(markers))})`);
  }, [markers, run]);
  const syncCircles = useCallback(() => {
    run(`window.__syncCircles(${JSON.stringify(JSON.stringify(circles))})`);
  }, [circles, run]);
  const syncPolyline = useCallback(() => {
    run(`window.__syncPolyline(${polyline ? JSON.stringify(JSON.stringify(polyline)) : "null"})`);
  }, [polyline, run]);

  useEffect(() => {
    if (!ready.current) {
      pendingSync.current = { markers, circles, polyline };
      return;
    }
    syncMarkers();
    syncCircles();
    syncPolyline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, circles, polyline]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, durationMs) => {
      run(`window.__animateToRegion(${JSON.stringify(JSON.stringify(region))}, ${durationMs ?? 500})`);
    },
    fitToCoordinates: (coordinates, paddingPx) => {
      run(`window.__fitToCoordinates(${JSON.stringify(JSON.stringify(coordinates))}, ${paddingPx ?? 60})`);
    },
  }), [run]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    let msg: LeafletOutboundMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data) as LeafletOutboundMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "ready":
        ready.current = true;
        if (pendingSync.current) {
          syncMarkers();
          syncCircles();
          syncPolyline();
          pendingSync.current = null;
        }
        break;
      case "press":
        onPress?.({ latitude: msg.lat, longitude: msg.lng });
        break;
      case "markerPress":
        onMarkerPress?.(msg.id);
        break;
      case "markerDragEnd":
        onMarkerDragEnd?.(msg.id, { latitude: msg.lat, longitude: msg.lng });
        break;
      case "error":
        break;
    }
  }, [onPress, onMarkerPress, onMarkerDragEnd, syncMarkers, syncCircles, syncPolyline]);

  if (!GEOAPIFY_KEY) {
    return (
      <View style={[styles.missingKey, { backgroundColor: theme.colors.canvas.surfaceMuted }, style]} testID={testID} />
    );
  }

  return (
    <View style={[styles.fill, style]}>
      <WebView
        ref={webviewRef}
        testID={testID}
        style={styles.fill}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        // Leaflet's own zoom buttons render fine without RN pinch-zoom passthrough.
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missingKey: { flex: 1 },
});
