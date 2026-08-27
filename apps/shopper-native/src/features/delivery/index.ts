export * from "./constants";
export * from "./types";
export { useDeliveryQuote } from "./useDeliveryQuote";
export { useDeliveryContext, type DeliveryContext } from "./useDeliveryContext";
export {
  useLocationStore,
  useLocationState,
  type Coordinates as LocationCoordinates,
  type LocationPermission,
} from "./locationStore";

// ─── Geofencing ─────────────────────────────────────────────────────────────
export {
  CAIRO_BOUNDS,
  DEFAULT_BRANCH_RADIUS_KM,
  distanceKm,
  findNearestBranch,
  hasValidCoordinates,
  isWithinCairo,
  sortBranchesByDistance,
  type Coordinates,
  type NearestBranchResult,
} from "./geofencing";

// ─── Branches ───────────────────────────────────────────────────────────────
export type { Branch, Governorate } from "./branches/types";
export { BRANCHES, DELIVERY_BRANCHES, findBranchById, getPrimaryBranch } from "./branches/data";
export { fetchBranches } from "./branches/api";
export { useBranches } from "./branches/useBranches";

// ─── UI ─────────────────────────────────────────────────────────────────────
export { BranchCard } from "./components/BranchCard";
export { DeliveryMap } from "./components/DeliveryMap";
