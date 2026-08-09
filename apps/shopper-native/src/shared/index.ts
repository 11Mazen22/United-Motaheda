/**
 * Top-level barrel for shared (cross-feature) code.
 *
 * Import paths:
 *   - Theme tokens:  "@pharmacy/design-tokens"  (or granular submodules)
 *   - UI primitives: "@pharmacy/ui-native"
 *   - Components:    "@/shared/components"
 */

export * from "@pharmacy/design-tokens";
export * from "@pharmacy/ui-native";
export { ErrorBoundary } from "./components";
