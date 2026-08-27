/**
 * maps.web.ts — web stub for react-native-maps, mirroring the pattern
 * already established by DeliveryMap.web.tsx.
 *
 * react-native-maps uses native view managers that don't exist on web —
 * importing it unshimmed crashes the entire web bundle (Expo Router needs
 * to statically import every route module to build the route tree, so a
 * single unshimmed native-only import anywhere breaks every screen, not
 * just the one that uses it). The web shopper app has its own map
 * experience via shopper-web; this native shell's web preview doesn't need
 * a live map, so a static placeholder is enough.
 */
import React from "react";
import { View, type ViewProps } from "react-native";

export function MapView({ style, children: _children, ...rest }: ViewProps & Record<string, unknown>): React.ReactElement {
  void rest;
  return <View style={[{ minHeight: 200 }, style]} />;
}

/** No-op on web — markers only make sense inside a real MapView. */
export function Marker(_props: Record<string, unknown>): null {
  return null;
}

/** No-op on web — same reasoning as Marker. */
export function Circle(_props: Record<string, unknown>): null {
  return null;
}

export type MapPressEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };
