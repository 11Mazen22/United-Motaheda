/**
 * AddressMapPlaceholder — real Geoapify static-map tile.
 *
 * Behaviour:
 *   1. lat + lng provided  → renders a real map image centred on those coords
 *   2. addressHint provided → geocodes on mount, then renders the map
 *   3. Nothing              → elegant animated placeholder with pin
 *
 * Works on both web and native — it is just an <Image> component.
 * No additional packages required.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { geocodeAddress } from "@/lib/geocoding";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl } from "@/utils/layout";

const GEOAPIFY_KEY = "c6beba954a794cb49263d1679e4bc8bf";

const PIN_COLOR = "#0db8a8";

interface AddressHint {
  street:   string;
  building: string;
  district: string;
  city:     string;
}

interface Props {
  lat?:         number;
  lng?:         number;
  addressHint?: AddressHint;
  compact?:     boolean;
  height?:      number;
}

function buildMapUrl(lat: number, lng: number, compact: boolean): string {
  const w    = compact ? 400 : 800;
  const h    = compact ? 200 : 400;
  const zoom = compact ? 14   : 15;

  // Geoapify marker format uses `;` as separator — URLSearchParams would encode
  // it to %3B which breaks the marker parser. Build the URL as a template string
  // so semicolons and the `lonlat:` prefix stay as literal characters.
  const markerColor = encodeURIComponent(PIN_COLOR); // "#0db8a8" → "%230db8a8"
  const marker = `lonlat:${lng},${lat};color:${markerColor};size:large;icontype:awesome;icon:map-marker-alt`;

  return (
    `https://maps.geoapify.com/v1/staticmap` +
    `?style=osm-bright-smooth` +
    `&width=${w}` +
    `&height=${h}` +
    `&zoom=${zoom}` +
    `&center=lonlat:${lng},${lat}` +
    `&marker=${marker}` +
    `&apiKey=${GEOAPIFY_KEY}`
  );
}

function openInMaps(lat: number, lng: number) {
  const url =
    Platform.OS === "ios"
      ? `maps:?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}

// ─── Pulsing placeholder (no coords yet) ────────────────────────────────────
function MapPlaceholder({ height }: { height: number }) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 1100 }), -1, true);
  }, [opacity]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={[styles.placeholder, { height }]}>
      {/* Fake road grid */}
      <Animated.View style={[StyleSheet.absoluteFill, anim]}>
        {[15, 35, 55, 75].map((t) => (
          <View key={`h${t}`} style={[styles.road, { top: `${t}%` as any }]} />
        ))}
        {[20, 45, 70].map((l) => (
          <View key={`v${l}`} style={[styles.roadV, { left: `${l}%` as any }]} />
        ))}
      </Animated.View>

      {/* Centre pin */}
      <View style={styles.pinStack}>
        <View style={styles.pinRing} />
        <View style={styles.pinCircle}>
          <Ionicons name="location" size={22} color={kit.color.accentDeep} />
        </View>
        <View style={styles.pinShadow} />
      </View>

      {/* Label */}
      <View style={styles.placeholderLabel}>
        <Ionicons name="navigate-circle-outline" size={14} color={kit.color.accentDeep} />
        <UIText style={styles.placeholderText}>
          {t("addressForm.mapPlaceholderHint")}
        </UIText>
      </View>
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function AddressMapPlaceholder({
  lat,
  lng,
  addressHint,
  compact = false,
  height: heightProp,
}: Props) {
  const { t }  = useTranslation();
  const height = heightProp ?? (compact ? 120 : 200);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null,
  );
  const [loading, setLoading]   = useState(false);
  const [imgError, setImgError] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);
  // Auto-geocode from hint when no coords are supplied
  useEffect(() => {
    if (coords) return;
    if (!addressHint?.city) return;

    let cancelled = false;
    setLoading(true);
    setImgError(false);
    setGeoFailed(false);

    geocodeAddress({
      street:   addressHint.street   ?? "",
      building: addressHint.building ?? "",
      district: addressHint.district ?? "",
      city:     addressHint.city,
    }).then((result) => {
      if (!cancelled) {
        if (result) setCoords({ lat: result.lat, lng: result.lng });
        else setGeoFailed(true);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [addressHint?.street, addressHint?.district, addressHint?.city]);

  if (!coords) {
    if (loading) {
      return (
        <View style={[styles.loadingBox, { height }]}>
          <ActivityIndicator color={kit.color.accentDeep} />
          <UIText style={styles.loadingText}>{t("addressForm.locating")}</UIText>
        </View>
      );
    }
    if (geoFailed) {
      return <MapPlaceholder height={height} />;
    }
    return <MapPlaceholder height={height} />;
  }

  const mapUrl = buildMapUrl(coords.lat, coords.lng, compact);

  return (
    <View style={[styles.container, { height }]}>
      {imgError ? (
        <MapPlaceholder height={height} />
      ) : (
        <Image
          source={{ uri: mapUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      )}

      {/* Coordinate badge */}
      {!compact && (
        <View style={styles.coordBadge}>
          <Ionicons name="navigate" size={10} color={kit.color.accentDeep} />
          <UIText style={styles.coordText}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </UIText>
        </View>
      )}

      {/* Open in Maps button */}
      <Pressable
        style={styles.openMapsBtn}
        onPress={() => openInMaps(coords.lat, coords.lng)}
        hitSlop={8}
      >
        <Ionicons name="map-outline" size={13} color={kit.color.accentDeep} />
        <UIText style={styles.openMapsText}>{t("addressForm.openInMaps")}</UIText>
      </Pressable>

      {/* Verified badge */}
      {!compact && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={12} color="#059669" />
          <UIText style={styles.verifiedText}>{t("addressForm.locationVerified")}</UIText>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: theme.colors.slate[100],
  },

  // ── Loading ──
  loadingBox: {
    borderRadius:   16,
    backgroundColor: theme.colors.slate[50],
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    borderWidth:    1,
    borderColor:    theme.colors.border.default,
  },
  loadingText: {
    fontSize:   12,
    fontFamily: theme.fonts.semibold,
    color:      theme.colors.text.tertiary,
  },
  // ── Placeholder ──
  placeholder: {
    borderRadius:   16,
    overflow:       "hidden",
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: "#EEF5F9",
    borderWidth:    1,
    borderColor:    theme.colors.border.default,
  },
  road: {
    position: "absolute",
    left:     0,
    right:    0,
    height:   8,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 4,
  },
  roadV: {
    position: "absolute",
    top:    0,
    bottom: 0,
    width:  8,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 4,
  },
  pinStack: {
    alignItems: "center",
    gap: 4,
  },
  pinRing: {
    position:        "absolute",
    width:           52,
    height:          52,
    borderRadius:    26,
    borderWidth:     2,
    borderColor:     "rgba(13,184,168,0.2)",
    backgroundColor: "rgba(13,184,168,0.06)",
  },
  pinCircle: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "#fff",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     kit.color.accentDeep,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.2,
    shadowRadius:    8,
    elevation:       6,
    borderWidth:     2,
    borderColor:     "rgba(14,126,116,0.20)",
  },
  pinShadow: {
    width:           18,
    height:          6,
    borderRadius:    999,
    backgroundColor: "rgba(13,184,168,0.15)",
    marginTop:       2,
  },
  placeholderLabel: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             5,
    position:        "absolute",
    bottom:          14,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
  },
  placeholderText: {
    fontSize:   11,
    fontFamily: theme.fonts.semibold,
    color:      theme.colors.text.secondary,
  },

  // ── Real map overlays ──
  coordBadge: {
    position:          "absolute",
    bottom:            10,
    left:              10,
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               4,
    backgroundColor:   "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
  },
  coordText: {
    fontSize:   9,
    fontFamily: theme.fonts.semibold,
    color:      theme.colors.slate[500],
  },
  openMapsBtn: {
    position:          "absolute",
    bottom:            10,
    right:             10,
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               5,
    backgroundColor:   "#fff",
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      10,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.1,
    shadowRadius:      4,
    elevation:         3,
    borderWidth:       1,
    borderColor:       theme.colors.border.brandSoft,
  },
  openMapsText: {
    fontSize:   11,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accentDeep,
  },
  verifiedBadge: {
    position:          "absolute",
    top:               10,
    right:             10,
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               4,
    backgroundColor:   "rgba(5,150,105,0.10)",
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       "rgba(5,150,105,0.2)",
  },
  verifiedText: {
    fontSize:   10,
    fontFamily: theme.fonts.bold,
    color:      "#059669",
  },
});
