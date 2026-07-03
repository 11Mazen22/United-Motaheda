import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

export interface DeliveryMapCoordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryMapProps {
  initialLatitude?: number;
  initialLongitude?: number;
  initialZoom?: number;
  onCoordinateChange?: (coords: DeliveryMapCoordinates) => void;
  onConfirmAddress?: (coords: DeliveryMapCoordinates) => void;
  style?: ViewStyle;
}

const DEFAULT_LATITUDE  = 30.0444;
const DEFAULT_LONGITUDE = 31.2357;
const DEFAULT_ZOOM      = 13;

export function DeliveryMap({
  initialLatitude  = DEFAULT_LATITUDE,
  initialLongitude = DEFAULT_LONGITUDE,
  initialZoom      = DEFAULT_ZOOM,
  onCoordinateChange,
  onConfirmAddress,
  style,
}: DeliveryMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<DeliveryMapCoordinates>({
    latitude:  initialLatitude,
    longitude: initialLongitude,
  });

  const html = useMemo(
    () =>
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><style>html,body,#map{margin:0;padding:0;height:100%;width:100%;overflow:hidden;} .leaflet-container{background:#f7fafc;}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const initialLat=${initialLatitude};const initialLng=${initialLongitude};const map = L.map('map').setView([initialLat, initialLng], ${initialZoom});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom:19}).addTo(map);const marker = L.marker([initialLat, initialLng], {draggable:true}).addTo(map);function sendPosition(){const pos = marker.getLatLng();window.ReactNativeWebView.postMessage(JSON.stringify({latitude:pos.lat,longitude:pos.lng}));}marker.on('dragend', sendPosition);map.on('click', (event)=>{marker.setLatLng(event.latlng);sendPosition();});sendPosition();</script></body></html>`,
    [initialLatitude, initialLongitude, initialZoom],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as DeliveryMapCoordinates;
        if (
          typeof payload.latitude === "number" &&
          Number.isFinite(payload.latitude) &&
          typeof payload.longitude === "number" &&
          Number.isFinite(payload.longitude)
        ) {
          const nextLocation = { latitude: payload.latitude, longitude: payload.longitude };
          setSelectedLocation(nextLocation);
          onCoordinateChange?.(nextLocation);
        }
      } catch {
        // Ignore malformed WebView payloads
      }
    },
    [onCoordinateChange],
  );

  const handleConfirm = useCallback(() => {
    onConfirmAddress?.(selectedLocation);
  }, [onConfirmAddress, selectedLocation]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        automaticallyAdjustContentInsets={false}
        mixedContentMode="always"
        accessibilityLabel="خريطة اختيار عنوان التوصيل"
      />

      <View style={styles.overlay}>
        <View style={styles.infoRow}>
          <UIText style={styles.label}>الموقع المختار</UIText>
          <UIText style={styles.coordinates}>
            {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
          </UIText>
        </View>

        <Pressable
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="تأكيد العنوان المختار"
          style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.85 }]}>
          <UIText style={styles.confirmText}>تأكيد العنوان</UIText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.colors.slate[50],
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: theme.colors.hero,
    ...theme.shadow.lg,
  },
  infoRow: {
    flexDirection: flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    color: theme.colors.text.inverse,
    fontSize: 13,
    fontFamily: theme.fonts.bold,
    textAlign: textAlignStart(isRtl()),
  },
  coordinates: {
    color: theme.colors.info.light,
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    lineHeight: 18,
    textAlign: textAlignStart(isRtl()),
  },
  confirmButton: {
    alignSelf: "stretch",
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    color: theme.colors.hero,
    fontSize: 14,
    fontFamily: theme.fonts.black,
  },
});
