/**
 * camera — thin re-export of expo-camera for screens that use CameraView
 * directly. See src/shared/maps.tsx for why this indirection exists: Metro
 * resolves camera.web.tsx instead when bundling for web, where CameraView's
 * native view manager isn't registered — importing expo-camera unshimmed
 * crashes the entire web bundle at Expo Router's route-tree registration
 * step (every route module is imported eagerly to build the tree), not
 * just the screen that uses it.
 *
 * IMPORTANT: keep this a `.tsx` file (no JSX needed) so its extension
 * matches camera.web.tsx's — see the matching note in maps.tsx for why an
 * extension mismatch silently defeats the web shim.
 */
export { CameraView, useCameraPermissions } from "expo-camera";
