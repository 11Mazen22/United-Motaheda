import { defaultTheme as theme } from "@pharmacy/ui-native";
import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, View, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ExpoLocation from "expo-location";
import { Screen, Button } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import MapView, { Marker } from "react-native-maps";
import RouteSummary from "../components/RouteSummary";
import { useDriverOrderDetail } from "../hooks/useDriverManifest";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { Ionicons as Ion } from "@expo/vector-icons";

const DEFAULT_REGION = { latitude: 30.0444, longitude: 31.2357 };
const DELTA = 0.02;

/** Watches the driver's own live position while the full map screen is open
 * (not the compact preview — a barely-visible thumbnail doesn't need a live
 * GPS subscription). Mirrors the permission/accuracy pattern already proven
 * in DeliveryExecutionScreen's broadcast loop. */
function useOwnPosition(enabled: boolean) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let subscription: ExpoLocation.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== "granted" || cancelled) return;
      subscription = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
        (position) => {
          if (cancelled) return;
          setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return coords;
}

export default function DriverMap({ compact }: { compact?: boolean } = {}): React.ReactElement {
  const { t } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const orderQ = useDriverOrderDetail(orderId);
  const order = orderQ.data;
  const router = useRouter();
  const driverCoords = useOwnPosition(!compact);

  const dest = order && typeof order.customerLat === 'number' && typeof order.customerLng === 'number' ? { lat: order.customerLat, lng: order.customerLng } : undefined;
  const region = dest ? { latitude: dest.lat, longitude: dest.lng } : DEFAULT_REGION;

  if (compact) {
    return (
      <Pressable onPress={() => router.push('/(driver)/map' as never)} style={{ height: 120 }} accessibilityRole="button">
        <View style={[s.mapPreviewCompact, { backgroundColor: theme.colors.canvas.surface }]}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ ...region, latitudeDelta: DELTA, longitudeDelta: DELTA }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
          >
            {dest && (
              <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} anchor={{ x: 0.5, y: 1 }}>
                <View style={[s.pin, { backgroundColor: theme.colors.brand.primary }]}>
                  <Ion name="home" size={12} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>
          <View style={s.compactOverlay}>
            <Ion name="navigate" size={16} color="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.mapTitle")} subtitle={t("driver.mapSubtitle")} />

      <View style={s.container}>
        <View style={s.mapBox}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ ...region, latitudeDelta: DELTA, longitudeDelta: DELTA }}
            showsCompass={false}
            toolbarEnabled={false}
          >
            {dest && (
              <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} anchor={{ x: 0.5, y: 1 }}>
                <View style={[s.pin, { backgroundColor: theme.colors.brand.primary }]}>
                  <Ion name="home" size={16} color="#fff" />
                </View>
              </Marker>
            )}
            {driverCoords && (
              <Marker coordinate={{ latitude: driverCoords.lat, longitude: driverCoords.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[s.pin, s.driverPin, { backgroundColor: theme.colors.status.info }]}>
                  <Ion name="navigate" size={14} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>

          <View style={s.mapOverlayRow}>
            <Ion name="locate" size={18} color="#fff" />
            <Button
              label={t("driver.navigate")}
              disabled={!dest}
              onPress={() => {
                if (!dest) return;
                void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`);
              }}
              style={s.navigateBtn}
            />
          </View>
        </View>

        <View style={s.routeWrap}>
          <RouteSummary driverCoords={driverCoords} destCoords={dest} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: kit.inset.screen, paddingTop: 12 },
  mapBox: { borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.canvas.surface, borderWidth: 1, borderColor: theme.colors.border.default, height: 320, justifyContent: 'center', alignItems: 'center', ...theme.shadows[1] },
  mapOverlayRow: { position: 'absolute', bottom: 12, start: 12, end: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navigateBtn: { paddingHorizontal: 12 },
  routeWrap: { marginTop: 12 },
  mapPreviewCompact: { borderRadius: 12, overflow: 'hidden', height: 120, justifyContent: 'center' },
  compactOverlay: { position: 'absolute', start: 12, bottom: 12, backgroundColor: theme.colors.brand.primary, padding: 8, borderRadius: 10 },
  pin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  driverPin: { width: 24, height: 24, borderRadius: 12, ...theme.shadows[1] },
});
