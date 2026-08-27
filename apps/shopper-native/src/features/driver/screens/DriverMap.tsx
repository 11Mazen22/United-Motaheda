/**
 * DriverMap — dedicated Map tab + compact home-screen preview.
 *
 * Confirmed bug fixed here: this screen used to read `orderId` from route
 * params, but nothing ever navigated to it with one — the tab has no
 * dynamic segment, and both call sites just pushed the bare route. `dest`
 * was therefore always undefined, so the map permanently showed the
 * hardcoded Cairo default region with no destination pin, a disabled
 * "Navigate" button, and RouteSummary stuck on "—/—". Fixed by having this
 * screen resolve its own destination — the current active delivery from the
 * driver's own manifest (same stage-priority ranking DriverManifest uses to
 * pick its spotlight order) — instead of depending on a param that was
 * never wired through.
 */
import React, { useMemo } from "react";
import { Linking, StyleSheet, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen, Button, Text as UIText, EmptyState, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { MapView, Marker } from "@/shared/maps";
import { useAuth } from "@/features/auth";
import RouteSummary from "../components/RouteSummary";
import { useDriverManifest } from "../hooks/useDriverManifest";
import { useDriverLivePosition } from "../hooks/useDriverLivePosition";
import { getDeliveryStage } from "../lib/deliveryStage";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { Ionicons as Ion } from "@expo/vector-icons";

const DEFAULT_REGION = { latitude: 30.0444, longitude: 31.2357 };
const DELTA = 0.02;

const STAGE_URGENCY: Record<string, number> = { at_customer: 4, to_customer: 3, at_pharmacy: 2, to_pharmacy: 1, delivered: 0, unknown: 0 };

export default function DriverMap({ compact }: { compact?: boolean } = {}): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  // Same hook DeliveryExecutionScreen uses for its own live distance
  // readout — previously this screen re-implemented its own independent
  // permission-request + GpsKalmanFilter wiring from scratch (a confirmed
  // duplication in the driver-system audit); now there's one implementation
  // of "watch and smooth my own position" for the whole driver app.
  const { fix } = useDriverLivePosition(!compact);
  const driverCoords = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const manifestQuery = useDriverManifest(user?.id);

  const activeOrder = useMemo(() => {
    const orders = manifestQuery.data ?? [];
    return [...orders].sort((a, b) => {
      const diff = STAGE_URGENCY[getDeliveryStage(b.status, b)] - STAGE_URGENCY[getDeliveryStage(a.status, a)];
      if (diff !== 0) return diff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })[0];
  }, [manifestQuery.data]);

  const s = useMemo(() => StyleSheet.create({
    container: { paddingHorizontal: kit.inset.screen, paddingTop: 12 },
    mapBox: { borderRadius: 16, overflow: "hidden", backgroundColor: theme.colors.canvas.surface, borderWidth: 1, borderColor: theme.colors.border.default, height: 320, justifyContent: "center", alignItems: "center", ...theme.shadows[1] },
    mapOverlayRow: { position: "absolute", bottom: 12, start: 12, end: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    navigateBtn: { paddingHorizontal: 12 },
    routeWrap: { marginTop: 12 },
    mapPreviewCompact: { borderRadius: 12, overflow: "hidden", height: 120, justifyContent: "center" },
    compactOverlay: { position: "absolute", start: 12, bottom: 12, backgroundColor: theme.colors.brand.primary, padding: 8, borderRadius: 10 },
    pin: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
    driverPin: { width: 24, height: 24, borderRadius: 12, ...theme.shadows[1] },
    compactEmpty: { height: 120, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.colors.canvas.surfaceMuted },
  }), [theme]);

  const dest = activeOrder && typeof activeOrder.lat === "number" && typeof activeOrder.lng === "number" ? { lat: activeOrder.lat, lng: activeOrder.lng } : undefined;
  const region = dest ? { latitude: dest.lat, longitude: dest.lng } : DEFAULT_REGION;

  if (compact) {
    if (!dest) {
      return (
        <View style={s.compactEmpty}>
          <Ion name="map-outline" size={20} color={theme.colors.text.muted} />
          <UIText variant="caption" color="secondary">{t("driver.noActiveDeliveryShort", "No active delivery")}</UIText>
        </View>
      );
    }
    return (
      <Pressable onPress={() => router.push("/(driver)/map" as never)} style={{ height: 120 }} accessibilityRole="button">
        <View style={[s.mapPreviewCompact, { backgroundColor: theme.colors.canvas.surface }]}>
          <MapView style={StyleSheet.absoluteFill} initialRegion={{ ...region, latitudeDelta: DELTA, longitudeDelta: DELTA }} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false} pointerEvents="none">
            <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={[s.pin, { backgroundColor: theme.colors.brand.primary }]}><Ion name="home" size={12} color="#fff" /></View>
            </Marker>
          </MapView>
          <View style={s.compactOverlay}><Ion name="navigate" size={16} color="#fff" /></View>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.mapTitle")} subtitle={t("driver.mapSubtitle")} />

      {!activeOrder ? (
        <EmptyState
          icon="map-outline"
          title={t("driver.noActiveDeliveryTitle", "No active delivery")}
          subtitle={t("driver.noActiveDeliveryBody", "Accept a delivery offer to see its route here.")}
          action={{ label: t("driver.offers"), onPress: () => router.push("/(driver)/offers" as never) }}
        />
      ) : (
        <View style={s.container}>
          <View style={s.mapBox}>
            <MapView style={StyleSheet.absoluteFill} initialRegion={{ ...region, latitudeDelta: DELTA, longitudeDelta: DELTA }} showsCompass={false} toolbarEnabled={false}>
              {dest && (
                <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} anchor={{ x: 0.5, y: 1 }}>
                  <View style={[s.pin, { backgroundColor: theme.colors.brand.primary }]}><Ion name="home" size={16} color="#fff" /></View>
                </Marker>
              )}
              {driverCoords && (
                <Marker coordinate={{ latitude: driverCoords.lat, longitude: driverCoords.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[s.pin, s.driverPin, { backgroundColor: theme.colors.status.info }]}><Ion name="navigate" size={14} color="#fff" /></View>
                </Marker>
              )}
            </MapView>

            <View style={s.mapOverlayRow}>
              <Ion name="locate" size={18} color="#fff" />
              <Button
                label={t("driver.navigate")}
                disabled={!dest}
                onPress={() => { if (dest) void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`); }}
                style={s.navigateBtn}
              />
            </View>
          </View>

          <View style={s.routeWrap}>
            <RouteSummary driverCoords={driverCoords} destCoords={dest} />
          </View>

          <Button
            label={t("driver.viewDelivery", "View delivery details")}
            variant="ghost"
            full
            onPress={() => router.push(`/(driver)/delivery/${activeOrder.id}` as never)}
            style={{ marginTop: 4 }}
          />
        </View>
      )}
    </Screen>
  );
}
