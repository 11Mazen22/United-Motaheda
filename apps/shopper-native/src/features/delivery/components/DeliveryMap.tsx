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

import { Text as UIText } from "@/shared/ui";
import { kit }            from "@/shared/kit";
import { theme }          from "@/shared/theme";
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

const pinS = StyleSheet.create({
  root:   { alignItems: "center" },
  circle: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: kit.color.accent,
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
    backgroundColor:             kit.color.accent,
    borderBottomLeftRadius:      2,
    borderBottomRightRadius:     2,
  },
});

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
  const open = isOpenNow(branch);
  const iconColor = selected ? "#fff" : open ? kit.color.accentDeep : kit.color.inkFaint;

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
            <Ionicons name="walk-outline" size={8} color={kit.color.accentDeep} />
          </View>
        )}
        {branch.acceptsPrescriptions && (
          <View style={[bmS.badge, bmS.badgeRx]}>
            <UIText style={[bmS.badgeText, { color: "#7C3AED" }]}>Rx</UIText>
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

const bmS = StyleSheet.create({
  root: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    borderWidth:     2,
    borderColor:     kit.color.accentDeep,
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    4,
    elevation:       4,
  },
  rootSelected: {
    backgroundColor: kit.color.accentDeep,
    borderColor:     kit.color.accent,
    width:           52,
    height:          52,
    borderRadius:    26,
  },
  rootClosed: {
    backgroundColor: kit.color.well,
    borderColor:     kit.color.lineStrong,
    opacity:         0.7,
  },
  iconRow: { alignItems: "center", justifyContent: "center" },
  badges: {
    position:       "absolute",
    top:            -6,
    right:          -6,
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
    backgroundColor: kit.color.ink,
  },
  badgePickup: {
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.accentDeep,
  },
  badgeRx: {
    backgroundColor: "#F5F3FF",
    borderWidth:     1,
    borderColor:     "#7C3AED",
  },
  badgeText: {
    fontSize:   7,
    fontFamily: theme.fonts.black,
    color:      "#fff",
  },
  distChip: {
    position:          "absolute",
    bottom:            -14,
    left:              "50%",
    transform:         [{ translateX: -16 }],
    backgroundColor:   kit.color.ink,
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      6,
    minWidth:          32,
    alignItems:        "center",
  },
  distText: {
    fontSize:   8,
    fontFamily: theme.fonts.bold,
    color:      "#fff",
  },
  closedBadge: {
    position:        "absolute",
    bottom:          -18,
    backgroundColor: kit.color.dangerTint,
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      6,
  },
  closedText: {
    fontSize:   8,
    fontFamily: theme.fonts.bold,
    color:      kit.color.danger,
  },
});

// ─── Branch callout card (shown below selected branch) ────────────────────────

function BranchCallout({ branch }: { branch: Branch }) {
  const open = isOpenNow(branch);
  return (
    <View style={calloutS.root}>
      <View style={[calloutS.row, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={calloutS.dot} />
        <UIText style={calloutS.name} numberOfLines={1}>{branch.nameAr}</UIText>
        <View style={[calloutS.statusPill, open ? calloutS.open : calloutS.closed]}>
          <UIText style={[calloutS.statusText, { color: open ? kit.color.success : kit.color.danger }]}>
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
  return (
    <View style={[calloutS.cap, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name={icon} size={10} color={kit.color.accentDeep} />
      <UIText style={calloutS.capText}>{label}</UIText>
    </View>
  );
}

const calloutS = StyleSheet.create({
  root: {
    backgroundColor: "#fff",
    borderRadius:    kit.radius.lg,
    padding:         10,
    width:           190,
    gap:             5,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.14,
    shadowRadius:    8,
    elevation:       6,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  row: { alignItems: "center", gap: 6 },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: kit.color.accent,
    flexShrink:      0,
  },
  name: {
    flex:       1,
    fontSize:   12,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
    textAlign:  TEXT_START,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      kit.radius.pill,
    flexShrink:        0,
  },
  open:       { backgroundColor: kit.color.successTint },
  closed:     { backgroundColor: kit.color.dangerTint  },
  statusText: { fontSize: 9, fontFamily: theme.fonts.black },
  addr: {
    fontSize:   10,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkSoft,
    textAlign:  TEXT_START,
  },
  caps: { flexWrap: "wrap", gap: 5, marginTop: 2 },
  cap: {
    alignItems:        "center",
    gap:               3,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
  },
  capText: { fontSize: 8, fontFamily: theme.fonts.bold, color: kit.color.accentDeep },
});

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
            strokeColor={`${kit.color.accent}55`}
            fillColor={`${kit.color.accent}12`}
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
            <Ionicons name="close-circle" size={18} color={kit.color.inkFaint} />
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
            <ActivityIndicator size="small" color={kit.color.accentDeep} />
          ) : (
            <Ionicons name="navigate" size={18} color={kit.color.accentDeep} />
          )}
        </Pressable>

        {/* Fit all branches */}
        <Pressable
          onPress={handleFitBranches}
          style={s.controlBtn}
          accessibilityRole="button"
          accessibilityLabel={t("delivery.fitBranches", "عرض كل الفروع")}
        >
          <Ionicons name="grid-outline" size={18} color={kit.color.accentDeep} />
        </Pressable>
      </View>

      {/* ── Bottom overlay: coordinate + confirm ───────────────────────── */}
      <View style={s.overlay}>
        <View style={[s.coordRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.coordIcon}>
            <Ionicons name="location-outline" size={13} color={kit.color.accentDeep} />
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

const s = StyleSheet.create({
  container: {
    flex:            1,
    minHeight:       320,
    borderRadius:    kit.radius.xl,
    overflow:        "hidden",
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },

  // ── Map controls ──────────────────────────────────────────────────────
  controls: {
    position: "absolute",
    top:      12,
    gap:      8,
  },
  controlsLtr: { right: 12 },
  controlsRtl: { left:  12 },
  controlBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: "#fff",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
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
  calloutPanelLtr: { left:  62 },
  calloutPanelRtl: { right: 62 },
  calloutClose: {
    marginTop: 4,
  },

  // ── Bottom overlay ────────────────────────────────────────────────────
  overlay: {
    position:          "absolute",
    left:              12,
    right:             12,
    bottom:            12,
    backgroundColor:   kit.color.ink,
    borderRadius:      kit.radius.xl,
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
    fontFamily: theme.fonts.semibold,
    color:      "rgba(255,255,255,0.72)",
  },
  branchHint: {
    fontSize:   10,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accent,
    flexShrink: 0,
  },
  confirmBtn: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    backgroundColor: kit.color.accent,
    borderRadius:    kit.radius.lg,
    paddingVertical: 13,
    ...kit.shadow.brandGlow,
  },
  confirmBtnPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.98 }],
  },
  confirmText: {
    fontSize:   14,
    fontFamily: theme.fonts.black,
    color:      "#fff",
  },
});
