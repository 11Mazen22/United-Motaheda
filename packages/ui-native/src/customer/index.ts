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

export * from "./useLuxuryTheme";
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
