/**
 * Authoritative, platform-neutral design tokens for United Pharmacies.
 *
 * The named `colors` export is the light semantic palette. The historical
 * shopper-native palette remains available as `legacyColors`, while `theme`
 * and the default export preserve the legacy shopper theme contract.
 */
export * from "./semantic.js";
export * from "./legacy.js";

import { lightTheme } from "./semantic.js";
import { theme } from "./legacy.js";

/** Backward-compatible aggregate alias for the default semantic token set. */
export const designTokens = lightTheme;

export default theme;
