/**
 * DeliveryMap.web.tsx — web stub for DeliveryMap.
 *
 * react-native-maps uses native modules that don't exist on web.
 * Metro/Expo resolves .web.tsx before .tsx so this stub is loaded
 * instead of the native implementation when bundling for web.
 *
 * The web shopper app has its own map experience via Leaflet/Google Maps
 * in the shopper-web app — the native DeliveryMap is not needed there.
 */

import React from "react";
import { View, StyleSheet } from "react-native";

export interface DeliveryMapCoordinates {
  latitude:  number;
  longitude: number;
}

export interface DeliveryMapProps {
  initialLatitude?:    number;
  initialLongitude?:   number;
  branches?:           readonly unknown[];
  showBranchMarkers?:  boolean;
  activeBranchId?:     string | null;
  onCoordinateChange?: (coords: DeliveryMapCoordinates) => void;
  onConfirmAddress?:   (coords: DeliveryMapCoordinates) => void;
  style?:              object;
}

/** No-op on web — react-native-maps is native only. */
export function DeliveryMap(_props: DeliveryMapProps): React.ReactElement {
  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, minHeight: 200 },
});
