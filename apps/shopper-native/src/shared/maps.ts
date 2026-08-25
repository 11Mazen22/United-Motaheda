/**
 * maps — thin re-export of react-native-maps for screens that inline
 * MapView/Marker directly (rather than going through the shared
 * <DeliveryMap> component, which has its own .web.tsx shim).
 *
 * Native builds get the real react-native-maps components; Metro/Expo
 * resolves maps.web.ts instead when bundling for web, where react-native-maps
 * doesn't exist (its native view managers aren't registered — importing it
 * unshimmed crashes the entire web bundle at the Expo Router route-tree
 * registration step, not just the screen that uses it).
 */
export { default as MapView, Marker, Circle } from "react-native-maps";
export type { MapPressEvent } from "react-native-maps";
