/**
 * camera — thin re-export of expo-camera for screens that use CameraView
 * directly. See src/shared/maps.ts for why this indirection exists: Metro
 * resolves camera.web.tsx instead when bundling for web, where CameraView's
 * native view manager isn't registered — importing expo-camera unshimmed
 * crashes the entire web bundle at Expo Router's route-tree registration
 * step (every route module is imported eagerly to build the tree), not
 * just the screen that uses it.
 */
export { CameraView, useCameraPermissions } from "expo-camera";
