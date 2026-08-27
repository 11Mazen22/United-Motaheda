/**
 * DeliveryMap — production-grade interactive map for delivery address selection.
 *
 * Features (v2):
 *   - Native react-native-maps (replaces WebView/Leaflet)
 *   - Draggable delivery pin with spring animation
 *   - Branch markers with capability callouts:
 *       • Pickup available badge
 *       • 24h badge
 *       • Prescription badge
 *       • Open/Closed status based on hours
 *       • Distance from user pin
 *   - Delivery zone circle (Circle overlay) around nearest/selected branch
 *   - "My Location" GPS button
 *   - "Fit all branches" button
 *   - Confirm overlay with coordinate display
 *   - RTL-aware layout
 *   - Fully accessible
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import MapView, {
  Circle,
  Marker,
  type MapPressEvent,
} from "react-native-maps";
import { Ionicons }       from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ExpoLocation  from "expo-location";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from "react-native-reanimated";

import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { BRANCHES }       from "../branches/data";
import { distanceKm }     from "../geofencing";
import type { Branch }    from "../branches/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LAT   = 30.0444;
const DEFAULT_LNG   = 31.2357;
const DEFAULT_DELTA = 0.025;
/** Delivery zone radius in metres for the circle overlay */
const ZONE_RADIUS_M = 12_000;

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const SPRING     = { damping: 14, stiffness: 200, mass: 0.6 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryMapCoordinates {
  latitude:  number;
  longitude: number;
}

export interface DeliveryMapProps {
  initialLatitude?:    number;
  initialLongitude?:   number;
  branches?:           readonly Branch[];
  showBranchMarkers?:  boolean;
  /** Which branch to highlight with the delivery zone circle */
  activeBranchId?:     string | null;
  onCoordinateChange?: (coords: DeliveryMapCoordinates) => void;
  onConfirmAddress?:   (coords: DeliveryMapCoordinates) => void;
  style?:              ViewStyle;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOpenNow(branch: Branch): boolean {
  if (branch.is24h) return true;
  try {
    const now   = new Date();
    const hhmm  = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const opens  = branch.hours?.opens  ?? "09:00";
    const closes = branch.hours?.closes ?? "23:00";
    return hhmm >= opens && hhmm < closes;
  } catch {
    return true;
  }
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}م`;
  return `${km.toFixed(1)} كم`;
}

// ─── Animated delivery pin ────────────────────────────────────────────────────

function DeliveryPin({ dragging }: { dragging: boolean }) {
  const { theme } = useTheme();
  const pinS = useMemo(() => getPinStyles(theme), [theme]);
  const scaleY = useSharedValue(1);

  useEffect(() => {
    scaleY.value = withSequence(
      withSpring(dragging ? 1.35 : 1, SPRING),
    );
  }, [dragging, scaleY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View style={[pinS.root, animStyle]}>
      <View style={pinS.circle}>
        <Ionicons name="location" size={22} color="#fff" />
      </View>
      <View style={pinS.needle} />
    </Animated.View>
  );
}

function getPinStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root:   { alignItems: "center" },
    circle: {
      width:           44,
      height:          44,
      borderRadius:    22,
      backgroundColor: theme.colors.brand.primary,
      alignItems:      "center",
      justifyContent:  "center",
      borderWidth:     2.5,
      borderColor:     "#fff",
      shadowColor:     "#000",
      shadowOffset:    { width: 0, height: 4 },
      shadowOpacity:   0.22,
      shadowRadius:    8,
      elevation:       8,
    },
    needle: {
      width:                       3,
      height:                      10,
      backgroundColor:             theme.colors.brand.primary,
      borderBottomStartRadius:      2,
      borderBottomEndRadius:     2,
    },
  });
}

// ─── Branch capability marker ─────────────────────────────────────────────────

function BranchMarker({
  branch,
  distKm,
  selected,
}: {
  branch:   Branch;
  distKm:   number | null;
  selected: boolean;
}) {
  const { theme } = useTheme();
  const bmS = useMemo(() => getBranchMarkerStyles(theme), [theme]);
  const open = isOpenNow(branch);
  const iconColor = selected ? "#fff" : open ? theme.colors.brand.primary : theme.colors.text.muted;

  return (
    <View style={[bmS.root, selected && bmS.rootSelected, !open && bmS.rootClosed]}>
      {/* Icon */}
      <View style={[bmS.iconRow]}>
        <Ionicons
          name={branch.isPrimary ? "star" : "medkit"}
          size={13}
          color={iconColor}
        />
      </View>

      {/* Capability badges */}
      <View style={bmS.badges}>
        {branch.is24h && (
          <View style={[bmS.badge, bmS.badge24h]}>
            <UIText style={bmS.badgeText}>24h</UIText>
          </View>
        )}
        {branch.pickupEnabled && (
          <View style={[bmS.badge, bmS.badgePickup]}>
            <Ionicons name="walk-outline" size={8} color={theme.colors.brand.primary} />
          </View>
        )}
        {branch.acceptsPrescriptions && (
          <View style={[bmS.badge, bmS.badgeRx]}>
            <UIText style={[bmS.badgeText, { color: theme.colors.tertiary.base }]}>Rx</UIText>
          </View>
        )}
      </View>

      {/* Distance chip — only shown when we have a user coordinate */}
      {distKm !== null && (
        <View style={bmS.distChip}>
          <UIText style={bmS.distText}>{fmtDistance(distKm)}</UIText>
        </View>
      )}

      {/* Closed overlay */}
      {!open && (
        <View style={bmS.closedBadge}>
          <UIText style={bmS.closedText}>مغلق</UIText>
        </View>
      )}
    </View>
  );
}

function getBranchMarkerStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: {
      width:           44,
      height:          44,
      borderRadius:    22,
      backgroundColor: theme.colors.canvas.surface,
      borderWidth:     2,
      borderColor:     theme.colors.brand.primary,
      alignItems:      "center",
      justifyContent:  "center",
      shadowColor:     "#000",
      shadowOffset:    { width: 0, height: 2 },
      shadowOpacity:   0.15,
      shadowRadius:    4,
      elevation:       4,
    },
    rootSelected: {
      backgroundColor: theme.colors.brand.primary,
      borderColor:     theme.colors.brand.primary,
      width:           52,
      height:          52,
      borderRadius:    26,
    },
    rootClosed: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderColor:     theme.colors.border.strong,
      opacity:         0.7,
    },
    iconRow: { alignItems: "center", justifyContent: "center" },
    badges: {
      position:       "absolute",
      top:            -6,
      end: -6,
      flexDirection:  "row",
      gap:            2,
    },
    badge: {
      paddingHorizontal: 4,
      paddingVertical:   2,
      borderRadius:      6,
      alignItems:        "center",
      justifyContent:    "center",
    },
    badge24h: {
      backgroundColor: theme.colors.pharmacy.navy,
    },
    badgePickup: {
      backgroundColor: theme.colors.brand.primaryLight,
      borderWidth:     1,
      borderColor:     theme.colors.brand.primary,
    },
    badgeRx: {
      backgroundColor: theme.colors.tertiary.bg,
      borderWidth:     1,
      borderColor:     theme.colors.tertiary.base,
    },
    badgeText: {
      fontSize:   7,
      fontFamily: legacyTheme.fonts.black,
      color:      "#fff",
    },
    distChip: {
      position:          "absolute",
      bottom:            -14,
      start: "50%",
      transform:         [{ translateX: -16 }],
      backgroundColor:   theme.colors.pharmacy.navy,
      paddingHorizontal: 5,
      paddingVertical:   2,
      borderRadius:      6,
      minWidth:          32,
      alignItems:        "center",
    },
    distText: {
      fontSize:   8,
      fontFamily: legacyTheme.fonts.bold,
      color:      "#fff",
    },
    closedBadge: {
      position:        "absolute",
      bottom:          -18,
      backgroundColor: `${theme.colors.status.error}1A`,
      paddingHorizontal: 5,
      paddingVertical:   2,
      borderRadius:      6,
    },
    closedText: {
      fontSize:   8,
      fontFamily: legacyTheme.fonts.bold,
      color:      theme.colors.status.error,
    },
  });
}

// ─── Branch callout card (shown below selected branch) ────────────────────────

function BranchCallout({ branch }: { branch: Branch }) {
  const { theme } = useTheme();
  const calloutS = useMemo(() => getCalloutStyles(theme), [theme]);
  const open = isOpenNow(branch);
  return (
    <View style={calloutS.root}>
      <View style={[calloutS.row, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={calloutS.dot} />
        <UIText style={calloutS.name} numberOfLines={1}>{branch.nameAr}</UIText>
        <View style={[calloutS.statusPill, open ? calloutS.open : calloutS.closed]}>
          <UIText style={[calloutS.statusText, { color: open ? theme.colors.status.success : theme.colors.status.error }]}>
            {open ? "مفتوح" : "مغلق"}
          </UIText>
        </View>
      </View>
      <UIText style={calloutS.addr} numberOfLines={2}>{branch.addressAr}</UIText>
      <View style={[calloutS.caps, { flexDirection: flexRow(IS_RTL) }]}>
        {branch.pickupEnabled      && <Cap icon="walk-outline"        label="استلام" />}
        {branch.acceptsPrescriptions && <Cap icon="document-text-outline" label="وصفات" />}
        {branch.is24h              && <Cap icon="time-outline"        label="٢٤ ساعة" />}
        {branch.supportsRefrigeration && <Cap icon="snow-outline"     label="تبريد" />}
      </View>
    </View>
  );
}

function Cap({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  const { theme } = useTheme();
  const calloutS = useMemo(() => getCalloutStyles(theme), [theme]);
  return (
    <View style={[calloutS.cap, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name={icon} size={10} color={theme.colors.brand.primary} />
      <UIText style={calloutS.capText}>{label}</UIText>
    </View>
  );
}

function getCalloutStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: {
      backgroundColor: theme.colors.canvas.surface,
      borderRadius:    12,
      padding:         10,
      width:           190,
      gap:             5,
      shadowColor:     "#000",
      shadowOffset:    { width: 0, height: 3 },
      shadowOpacity:   0.14,
      shadowRadius:    8,
      elevation:       6,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
    },
    row: { alignItems: "center", gap: 6 },
    dot: {
      width:           8,
      height:          8,
      borderRadius:    4,
      backgroundColor: theme.colors.brand.primary,
      flexShrink:      0,
    },
    name: {
      flex:       1,
      fontSize:   12,
      fontFamily: legacyTheme.fonts.black,
      color:      theme.colors.text.primary,
      textAlign:  TEXT_START,
    },
    statusPill: {
      paddingHorizontal: 7,
      paddingVertical:   2,
      borderRadius:      9999,
      flexShrink:        0,
    },
    open:       { backgroundColor: `${theme.colors.status.success}1A` },
    closed:     { backgroundColor: `${theme.colors.status.error}1A`  },
    statusText: { fontSize: 9, fontFamily: legacyTheme.fonts.black },
    addr: {
      fontSize:   10,
      fontFamily: legacyTheme.fonts.regular,
      color:      theme.colors.text.secondary,
      textAlign:  TEXT_START,
    },
    caps: { flexWrap: "wrap", gap: 5, marginTop: 2 },
    cap: {
      alignItems:        "center",
      gap:               3,
      paddingHorizontal: 7,
      paddingVertical:   3,
      borderRadius:      9999,
      backgroundColor:   theme.colors.brand.primaryLight,
    },
    capText: { fontSize: 8, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary },
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DeliveryMap({
  initialLatitude  = DEFAULT_LAT,
  initialLongitude = DEFAULT_LNG,
  branches         = BRANCHES,
  showBranchMarkers = true,
  activeBranchId,
  onCoordinateChange,
  onConfirmAddress,
  style,
}: DeliveryMapProps) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t }  = useTranslation();
  const mapRef = useRef<MapView>(null);

  const [marker, setMarker] = useState<DeliveryMapCoordinates>({
    latitude:  initialLatitude,
    longitude: initialLongitude,
  });
  const [dragging, setDragging]         = useState(false);
  const [locating,  setLocating]        = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const deliveryBranches = useMemo(
    () => branches.filter((b) => b.deliveryEnabled),
    [branches],
  );

  // Active branch for zone circle — explicit prop or selected callout or nearest
  const zoneBranch = useMemo(() => {
    if (activeBranchId) {
      return deliveryBranches.find((b) => b.id === activeBranchId) ?? null;
    }
    if (selectedBranch) return selectedBranch;
    // Default to nearest
    let nearest: Branch | null = null;
    let minDist = Infinity;
    for (const b of deliveryBranches) {
      const d = distanceKm(
        { lat: marker.latitude, lng: marker.longitude },
        { lat: b.lat, lng: b.lng },
      );
      if (d < minDist) { minDist = d; nearest = b; }
    }
    return nearest;
  }, [activeBranchId, selectedBranch, marker, deliveryBranches]);

  const updateMarker = useCallback(
    (coords: DeliveryMapCoordinates) => {
      setMarker(coords);
      onCoordinateChange?.(coords);
    },
    [onCoordinateChange],
  );

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      updateMarker({ latitude, longitude });
      setSelectedBranch(null);
    },
    [updateMarker],
  );

  const handleMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      updateMarker(coords);
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
        500,
      );
    } catch { /* denied / unavailable */ }
    finally { setLocating(false); }
  }, [updateMarker]);

  const handleFitBranches = useCallback(() => {
    if (deliveryBranches.length === 0) return;
    mapRef.current?.fitToCoordinates(
      deliveryBranches.map((b) => ({ latitude: b.lat, longitude: b.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 160, left: 60 }, animated: true },
    );
  }, [deliveryBranches]);

  const handleConfirm = useCallback(
    () => onConfirmAddress?.(marker),
    [marker, onConfirmAddress],
  );

  return (
    <View style={[s.container, style]}>
      {/* ── Native MapView ─────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude:       initialLatitude,
          longitude:      initialLongitude,
          latitudeDelta:  DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        }}
        onPress={handleMapPress}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel={t("delivery.mapLabel", "خريطة اختيار عنوان التوصيل")}
      >
        {/* Delivery zone circle around active branch */}
        {zoneBranch && (
          <Circle
            center={{ latitude: zoneBranch.lat, longitude: zoneBranch.lng }}
            radius={ZONE_RADIUS_M}
            strokeColor={`${theme.colors.brand.primary}55`}
            fillColor={`${theme.colors.brand.primary}12`}
            strokeWidth={1.5}
          />
        )}

        {/* Branch markers */}
        {showBranchMarkers &&
          deliveryBranches.map((branch) => {
            const distKmVal =
              distanceKm(
                { lat: marker.latitude, lng: marker.longitude },
                { lat: branch.lat,      lng: branch.lng },
              );
            const isSelected = selectedBranch?.id === branch.id;
            return (
              <Marker
                key={branch.id}
                coordinate={{ latitude: branch.lat, longitude: branch.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => setSelectedBranch(isSelected ? null : branch)}
                accessibilityLabel={branch.nameAr}
              >
                <BranchMarker
                  branch={branch}
                  distKm={distKmVal}
                  selected={isSelected}
                />
              </Marker>
            );
          })}

        {/* Draggable delivery-address marker */}
        <Marker
          coordinate={marker}
          draggable
          onDragStart={() => setDragging(true)}
          onDragEnd={(e) => {
            setDragging(false);
            updateMarker(e.nativeEvent.coordinate);
          }}
          anchor={{ x: 0.5, y: 1 }}
          accessibilityLabel={t("delivery.markerLabel", "موقع التوصيل المختار")}
        >
          <DeliveryPin dragging={dragging} />
        </Marker>
      </MapView>

      {/* ── Branch callout panel (slides in when a branch is tapped) ──── */}
      {selectedBranch && (
        <Animated.View
          style={[
            s.calloutPanel,
            IS_RTL ? s.calloutPanelRtl : s.calloutPanelLtr,
          ]}
        >
          <BranchCallout branch={selectedBranch} />
          <Pressable
            onPress={() => setSelectedBranch(null)}
            hitSlop={10}
            style={s.calloutClose}
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
          </Pressable>
        </Animated.View>
      )}

      {/* ── Map controls ───────────────────────────────────────────────── */}
      <View style={[s.controls, IS_RTL ? s.controlsRtl : s.controlsLtr]}>
        {/* My location */}
        <Pressable
          onPress={() => void handleMyLocation()}
          disabled={locating}
          style={s.controlBtn}
          accessibilityRole="button"
          accessibilityLabel={t("delivery.myLocation", "موقعي الحالي")}
        >
          {locating ? (
            <ActivityIndicator size="small" color={theme.colors.brand.primary} />
          ) : (
            <Ionicons name="navigate" size={18} color={theme.colors.brand.primary} />
          )}
        </Pressable>

        {/* Fit all branches */}
        <Pressable
          onPress={handleFitBranches}
          style={s.controlBtn}
          accessibilityRole="button"
          accessibilityLabel={t("delivery.fitBranches", "عرض كل الفروع")}
        >
          <Ionicons name="grid-outline" size={18} color={theme.colors.brand.primary} />
        </Pressable>
      </View>

      {/* ── Bottom overlay: coordinate + confirm ───────────────────────── */}
      <View style={s.overlay}>
        <View style={[s.coordRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.coordIcon}>
            <Ionicons name="location-outline" size={13} color={theme.colors.brand.primary} />
          </View>
          <UIText style={s.coordText} numberOfLines={1}>
            {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
          </UIText>
          {zoneBranch && (
            <UIText style={s.branchHint} numberOfLines={1}>
              {zoneBranch.nameAr}
            </UIText>
          )}
        </View>

        <Pressable
          onPress={handleConfirm}
          style={({ pressed }) => [s.confirmBtn, pressed && s.confirmBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("delivery.confirmAddress", "تأكيد العنوان")}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <UIText style={s.confirmText}>
            {t("delivery.confirmAddress", "تأكيد العنوان")}
          </UIText>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    container: {
      flex:            1,
      minHeight:       320,
      borderRadius:    16,
      overflow:        "hidden",
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
    },

    // ── Map controls ──────────────────────────────────────────────────────
    controls: {
      position: "absolute",
      top:      12,
      gap:      8,
    },
    controlsLtr: { end: 12 },
    controlsRtl: { start: 12 },
    controlBtn: {
      width:           42,
      height:          42,
      borderRadius:    21,
      backgroundColor: theme.colors.canvas.surface,
      alignItems:      "center",
      justifyContent:  "center",
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      shadowColor:     "#000",
      shadowOffset:    { width: 0, height: 2 },
      shadowOpacity:   0.1,
      shadowRadius:    4,
      elevation:       3,
    },

    // ── Branch callout ────────────────────────────────────────────────────
    calloutPanel: {
      position:  "absolute",
      top:       12,
      flexDirection: "row",
      alignItems:    "flex-start",
      gap:           6,
    },
    calloutPanelLtr: { start: 62 },
    calloutPanelRtl: { end: 62 },
    calloutClose: {
      marginTop: 4,
    },

    // ── Bottom overlay ────────────────────────────────────────────────────
    overlay: {
      position:          "absolute",
      start: 12,
      end: 12,
      bottom:            12,
      backgroundColor:   theme.colors.pharmacy.navy,
      borderRadius:      16,
      paddingHorizontal: 16,
      paddingVertical:   14,
      gap:               12,
      shadowColor:       "#000",
      shadowOffset:      { width: 0, height: 6 },
      shadowOpacity:     0.22,
      shadowRadius:      14,
      elevation:         10,
    },
    coordRow: {
      alignItems: "center",
      gap:        8,
    },
    coordIcon: {
      width:           26,
      height:          26,
      borderRadius:    8,
      backgroundColor: "rgba(255,255,255,0.12)",
      alignItems:      "center",
      justifyContent:  "center",
    },
    coordText: {
      flex:       1,
      fontSize:   11,
      fontFamily: legacyTheme.fonts.semibold,
      color:      "rgba(255,255,255,0.72)",
    },
    branchHint: {
      fontSize:   10,
      fontFamily: legacyTheme.fonts.bold,
      color:      theme.colors.brand.primary,
      flexShrink: 0,
    },
    confirmBtn: {
      flexDirection:   flexRow(IS_RTL),
      alignItems:      "center",
      justifyContent:  "center",
      gap:             8,
      backgroundColor: theme.colors.brand.primary,
      borderRadius:    12,
      paddingVertical: 13,
      ...theme.shadows[2],
    },
    confirmBtnPressed: {
      opacity:   0.88,
      transform: [{ scale: 0.98 }],
    },
    confirmText: {
      fontSize:   14,
      fontFamily: legacyTheme.fonts.black,
      color:      "#fff",
    },
  });
}
