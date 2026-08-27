/**
 * Authoritative, platform-neutral design tokens for United Pharmacies.
 *
 * The named `colors` export is the light semantic palette. The historical
 * shopper-native palette remains available as `legacyColors`, while `theme`
 * and the default export preserve the legacy shopper theme contract.
 */
export * from "./semantic";
export * from "./legacy";
export * from "./customer";
export * from "./pharmacist";

import { lightTheme } from "./semantic";
import { theme } from "./legacy";
import { customer } from "./customer";
import { pharmacist } from "./pharmacist";

/** Backward-compatible aggregate alias for the default semantic token set. */
export const designTokens = lightTheme;

export { customer, pharmacist };
export default theme;
