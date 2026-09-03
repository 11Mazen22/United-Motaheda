/**
 * maps — thin re-export of react-native-maps for screens that inline
 * MapView/Marker directly (rather than going through the shared
 * <DeliveryMap> component, which has its own .web.tsx shim).
 *
 * Native builds get the real react-native-maps components; Metro/Expo
 * resolves maps.web.tsx instead when bundling for web, where react-native-maps
 * doesn't exist (its native view managers aren't registered — importing it
 * unshimmed crashes the entire web bundle at the Expo Router route-tree
 * registration step, not just the screen that uses it).
 *
 * IMPORTANT: this file must stay a `.tsx` file (even though it has no JSX
 * of its own) so its extension matches maps.web.tsx's. Metro's platform
 * resolution tries `name.web.<ext>` then `name.<ext>` per extension, in
 * sourceExts order — it does NOT try every `.web.*` variant before falling
 * back to bare files. A `maps.ts`/`maps.web.tsx` extension mismatch means
 * Metro finds bare `maps.ts` at the `ts` step and stops, never reaching the
 * `tsx` step where the web shim lives — silently bundling the native,
 * web-incompatible module. Keep native/web shim pairs on the same extension.
 */
export { default as MapView, Marker, Circle, Polyline } from "react-native-maps";
export type { MapPressEvent } from "react-native-maps";
