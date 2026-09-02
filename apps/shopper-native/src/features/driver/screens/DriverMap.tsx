/**
 * DriverMap — full-screen operational map for the driver's active delivery.
 *
 * Root cause fixed here (not just a visual redesign): every screen in this
 * app that mounted `react-native-maps`' `MapView` crashed the whole process
 * on Android, because the app has never had a Google Maps API key
 * configured (that requires a Google Cloud billing account) and the native
 * Google Maps SDK does not fail gracefully without one. This screen now
 * renders on `LeafletMap` (see src/shared/leafletMap) — Leaflet.js inside a
 * WebView, tiled from Geoapify, no Google dependency, no crash, no native
 * rebuild needed to ship it.
 *
 * Also fixed: the "recenter" control in the map overlay used to be a bare
 * `<Ionicons>` with no `Pressable` around it — it looked like a working
 * button and did nothing.
 *
 * Layout: the map is the full screen, not a fixed-height box with a
 * separate content area below it — a driver glancing at this while moving
 * needs the map itself to dominate, with the delivery's details in a
 * compact floating card rather than competing for vertical space.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text as UIText, EmptyState, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { LeafletMap } from "@/shared/leafletMap/LeafletMap";
import { headingMarkerHtml, pinMarkerHtml } from "@/shared/leafletMap/html";
import type { LeafletMapRef, MapMarkerSpec } from "@/shared/leafletMap/types";
import { useAuth } from "@/features/auth";
import { useScreenLayout } from "@/utils/responsive";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import RouteSummary from "../components/RouteSummary";
import { useDriverManifest } from "../hooks/useDriverManifest";
import { useDriverLivePosition } from "../hooks/useDriverLivePosition";
import { getDeliveryStage, getStageAction, getStageStatusLabel } from "../lib/deliveryStage";
import { DriverScreenHeader } from "../components/DriverScreenHeader";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const DEFAULT_REGION = { latitude: 30.0444, longitude: 31.2357, zoom: 12 };
const ACTIVE_ZOOM = 15;

const STAGE_URGENCY: Record<string, number> = {
  at_customer: 4, to_customer: 3, at_pharmacy: 2, to_pharmacy: 1, delivered: 0, unknown: 0,
};

export default function DriverMap({ compact }: { compact?: boolean } = {}): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { pagePad } = useScreenLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<LeafletMapRef>(null);

  const { fix, permissionDenied } = useDriverLivePosition(!compact);
  const driverCoords = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const manifestQuery = useDriverManifest(user?.id);
  const [recentering, setRecentering] = useState(false);

  const activeOrder = useMemo(() => {
    const orders = manifestQuery.data ?? [];
    return [...orders].sort((a, b) => {
      const diff = STAGE_URGENCY[getDeliveryStage(b.status, b)] - STAGE_URGENCY[getDeliveryStage(a.status, a)];
      if (diff !== 0) return diff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })[0];
  }, [manifestQuery.data]);

  const dest = activeOrder && typeof activeOrder.lat === "number" && typeof activeOrder.lng === "number"
    ? { lat: activeOrder.lat, lng: activeOrder.lng }
    : undefined;

  const initialRegion = dest
    ? { latitude: dest.lat, longitude: dest.lng, zoom: ACTIVE_ZOOM }
    : driverCoords
      ? { latitude: driverCoords.lat, longitude: driverCoords.lng, zoom: ACTIVE_ZOOM }
      : DEFAULT_REGION;

  const brand = theme.colors.brand.primary;
  const info  = theme.colors.status.info;

  const markers: MapMarkerSpec[] = useMemo(() => {
    const list: MapMarkerSpec[] = [];
    if (dest) {
      list.push({
        id: "destination",
        coordinate: { latitude: dest.lat, longitude: dest.lng },
        html: pinMarkerHtml(brand, "&#127968;"),
        width: 38, height: 46, anchorX: 0.5, anchorY: 1, zIndexOffset: 10,
      });
    }
    if (driverCoords) {
      list.push({
        id: "driver",
        coordinate: { latitude: driverCoords.lat, longitude: driverCoords.lng },
        html: headingMarkerHtml(info, fix?.heading),
        width: 30, height: 30, anchorX: 0.5, anchorY: 0.5, zIndexOffset: 20,
      });
    }
    return list;
  }, [dest, driverCoords, fix?.heading, brand, info]);

  const s = useMemo(() => getStyles(theme, pagePad), [theme, pagePad]);

  const handleRecenter = useCallback(() => {
    if (!driverCoords) return;
    setRecentering(true);
    mapRef.current?.animateToRegion({ latitude: driverCoords.lat, longitude: driverCoords.lng, zoom: ACTIVE_ZOOM }, 500);
    setTimeout(() => setRecentering(false), 550);
  }, [driverCoords]);

  const handleFitRoute = useCallback(() => {
    if (!dest || !driverCoords) return;
    mapRef.current?.fitToCoordinates(
      [{ latitude: dest.lat, longitude: dest.lng }, { latitude: driverCoords.lat, longitude: driverCoords.lng }],
      70,
    );
  }, [dest, driverCoords]);

  const stage       = activeOrder ? getDeliveryStage(activeOrder.status, activeOrder) : "unknown";
  const stageAction = activeOrder ? getStageAction(stage) : null;
  const stageLabel  = activeOrder ? getStageStatusLabel(stage) : null;

  // ── Compact home-screen preview ─────────────────────────────────────────
  if (compact) {
    if (!dest) {
      return (
        <View style={s.compactEmpty}>
          <Ionicons name="map-outline" size={20} color={theme.colors.text.muted} />
          <UIText variant="caption" color="secondary">{t("driver.noActiveDeliveryShort", "No active delivery")}</UIText>
        </View>
      );
    }
    return (
      <Pressable
        onPress={() => router.push("/(driver)/map" as never)}
        style={s.compactPressable}
        accessibilityRole="button"
        accessibilityLabel={t("driver.mapTitle")}
      >
        <View style={s.compactMapWrap}>
          <LeafletMap
            initialRegion={{ latitude: dest.lat, longitude: dest.lng, zoom: 13 }}
            markers={[markers.find((m) => m.id === "destination")].filter((m): m is MapMarkerSpec => !!m)}
            zoomControl={false}
          />
          <View pointerEvents="none" style={s.compactOverlay}>
            <Ionicons name="navigate" size={16} color="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Full map screen ──────────────────────────────────────────────────────
  return (
    <Screen edgeToEdge background={theme.colors.canvas.background}>
      <View style={s.mapFill}>
        <LeafletMap
          ref={mapRef}
          initialRegion={initialRegion}
          markers={markers}
          testID="driver-map"
        />
      </View>

      <View pointerEvents="box-none" style={[s.headerOverlay, { paddingTop: insets.top }]}>
        <DriverScreenHeader title={t("driver.mapTitle")} subtitle={t("driver.mapSubtitle")} />
      </View>

      {permissionDenied ? (
        <View style={s.bannerWrap} pointerEvents="box-none">
          <View style={[s.banner, { backgroundColor: `${theme.colors.status.warning}E6` }]}>
            <Ionicons name="location-outline" size={16} color="#fff" />
            <UIText style={s.bannerText} numberOfLines={2}>
              {t("driver.locationPermissionRequired")}
            </UIText>
          </View>
        </View>
      ) : null}

      {dest ? (
        <View pointerEvents="box-none" style={[s.controlsCol, IS_RTL ? s.controlsColRtl : s.controlsColLtr]}>
          <Pressable
            onPress={handleFitRoute}
            disabled={!driverCoords}
            style={[s.controlBtn, { backgroundColor: theme.colors.canvas.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t("driver.fitRoute", { defaultValue: "Fit route" })}
          >
            <Ionicons name="scan-outline" size={19} color={driverCoords ? theme.colors.text.primary : theme.colors.text.disabled} />
          </Pressable>
          <Pressable
            onPress={handleRecenter}
            disabled={!driverCoords}
            style={[s.controlBtn, { backgroundColor: theme.colors.canvas.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t("driver.recenter", { defaultValue: "Recenter on me" })}
          >
            <Ionicons
              name="locate"
              size={19}
              color={recentering ? theme.colors.brand.primary : driverCoords ? theme.colors.text.primary : theme.colors.text.disabled}
            />
          </Pressable>
        </View>
      ) : null}

      {!activeOrder ? (
        <View style={s.emptyOverlay} pointerEvents="box-none">
          {/* EmptyState's own base style is `flex: 1` -- nested inside a
             shrink-wrap card with no explicit height, that flex:1 child
             measured larger than the card's own painted background, so the
             white rounded box covered only the icon while the title/
             subtitle/button rendered past its edge on the bare map. `style`
             here is merged on top of EmptyState's base style, so flex:0
             lets the card size to its actual content instead. */}
          <View style={[s.emptyCard, { backgroundColor: theme.colors.canvas.surface }]}>
            <EmptyState
              icon="map-outline"
              title={t("driver.noActiveDeliveryTitle", "No active delivery")}
              subtitle={t("driver.noActiveDeliveryBody", "Accept a delivery offer to see its route here.")}
              action={{ label: t("driver.offers"), onPress: () => router.push("/(driver)/offers" as never) }}
              style={s.emptyStateInner}
            />
          </View>
        </View>
      ) : (
        <View style={s.sheetWrap} pointerEvents="box-none">
          <View style={[s.sheet, { backgroundColor: theme.colors.canvas.surfaceElevated }]}>
            <View style={[s.sheetHeaderRow, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={s.sheetIcon}>
                <Ionicons name="navigate" size={16} color={theme.colors.brand.primary} />
              </View>
              <View style={s.flexMin}>
                {stageLabel ? (
                  <UIText variant="caption" color="brand" style={s.startText} numberOfLines={1}>
                    {t(stageLabel.key, stageLabel.fallback)}
                  </UIText>
                ) : null}
                <UIText variant="card-title" style={s.startText} numberOfLines={1}>
                  #{activeOrder.id.slice(-8).toUpperCase()}
                </UIText>
              </View>
            </View>

            <UIText variant="body-sm" color="secondary" numberOfLines={2} style={s.startText}>
              {activeOrder.customerName
                ? `${activeOrder.customerName} · ${activeOrder.customerAddress || "—"}`
                : (activeOrder.customerAddress || "—")}
            </UIText>

            <RouteSummary driverCoords={driverCoords} destCoords={dest} bare />

            <View style={[s.sheetActions, { flexDirection: flexRow(IS_RTL) }]}>
              <Pressable
                onPress={() => { if (dest) void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`); }}
                style={[s.sheetSecondaryBtn, { borderColor: theme.colors.border.default }]}
                accessibilityRole="button"
                accessibilityLabel={t("driver.openInMaps", { defaultValue: "Open in external maps" })}
              >
                <Ionicons name="compass-outline" size={17} color={theme.colors.text.primary} />
              </Pressable>

              {stageAction ? (
                <Pressable
                  onPress={() => router.push(`/(driver)/delivery/${activeOrder.id}` as never)}
                  style={[s.sheetPrimaryBtn, { backgroundColor: theme.colors.brand.primary }]}
                  accessibilityRole="button"
                >
                  <Ionicons name={stageAction.icon} size={17} color="#fff" />
                  <UIText color="#fff" variant="label" numberOfLines={1}>
                    {t(stageAction.labelKey, stageAction.fallback)}
                  </UIText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}

function getStyles(theme: NativeTheme, pagePad: number) {
  return StyleSheet.create({
    mapFill: { ...StyleSheet.absoluteFillObject },
    flexMin: { flex: 1, minWidth: 0 },
    startText: { textAlign: TEXT_START },

    headerOverlay: { position: "absolute", top: 0, start: 0, end: 0 },

    bannerWrap: { position: "absolute", top: 100, start: pagePad, end: pagePad },
    banner: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 14,
    },
    bannerText: { flex: 1, color: "#fff", fontSize: 12.5, lineHeight: 17, textAlign: TEXT_START },

    controlsCol: { position: "absolute", top: 100, gap: 10 },
    controlsColLtr: { end: pagePad },
    controlsColRtl: { start: pagePad },
    controlBtn: {
      width: 44, height: 44, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
      ...theme.shadows[2],
    },

    emptyOverlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: pagePad },
    emptyCard: { borderRadius: 24, paddingVertical: 12, width: "100%", ...theme.shadows[2] },
    emptyStateInner: { flex: 0, minHeight: 0 },

    sheetWrap: { position: "absolute", start: 0, end: 0, bottom: 0, paddingHorizontal: pagePad, paddingBottom: 16 },
    sheet: {
      borderRadius: 22,
      padding: 16,
      gap: 10,
      ...theme.shadows[3],
    },
    sheetHeaderRow: { alignItems: "center", gap: 10 },
    sheetIcon: {
      width: 36, height: 36, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.brand.primaryLight,
      flexShrink: 0,
    },
    sheetActions: { gap: 10, marginTop: 2 },
    sheetSecondaryBtn: {
      width: 48, height: 48, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1,
      flexShrink: 0,
    },
    sheetPrimaryBtn: {
      flex: 1,
      flexDirection: flexRow(IS_RTL),
      alignItems: "center", justifyContent: "center",
      gap: 8,
      height: 48,
      borderRadius: 14,
    },

    compactEmpty: {
      height: 120, borderRadius: 12,
      alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: theme.colors.canvas.surfaceMuted,
    },
    compactPressable: { height: 120 },
    compactMapWrap: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: theme.colors.canvas.surface },
    compactOverlay: {
      position: "absolute", start: 12, bottom: 12,
      backgroundColor: theme.colors.brand.primary,
      padding: 8, borderRadius: 10,
    },
  });
}
