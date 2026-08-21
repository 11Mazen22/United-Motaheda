/**
 * Customer primitive library — Project Luxury 2.0
 *
 * All components here are purely presentational.
 * They consume the luxury token system and existing ThemeProvider,
 * but never import commerce/auth/order services directly.
 *
 * Protected services (cart, checkout, auth, notifications, addresses,
 * offline queue, queryClient) are consumed by screen-level components
 * which pass data/callbacks as props into these primitives.
 */

export * from "./useCustomerTheme";
export * from "./Surface";
export * from "./Typography";
export * from "./Button";
export * from "./TextField";
export * from "./Price";
export * from "./Badge";
export * from "./Skeleton";
export * from "./EmptyState";
export * from "./ErrorState";
export * from "./Notice";
export * from "./Section";

// Compatibility names used by the current native screens during the
// transition from the legacy primitive surface to the customer primitives.
export { Text as Typography } from "../components/primitives";
export { ActivityIndicator } from "react-native";
export { CButton as Button } from "./Button";
export { ProductCardSkeleton as SkeletonCard } from "./Skeleton";

// Backward-compatible alias for existing imports
export { useLuxuryTheme } from "./useCustomerTheme";
export { useCustomerTheme } from "./useCustomerTheme";
