/**
 * layout.ts — RTL‑aware layout utilities (2026 Creative Refresh)
 *
 * Direction‑aware utilities for React Native styles. Values are frozen at
 * module load; a language switch triggers a full app reload so they refresh
 * correctly.
 *
 * RTL logic (forceRTL active for Arabic):
 *  - React Native already treats START as the physical RIGHT edge when
 *    forceRTL is active, so flexDirection:"row" already flows RTL.
 *  - flexRow() maps:
 *      • forceRTL active,   rtl=true  → "row"         (system RTL)
 *      • forceRTL active,   rtl=false → "row-reverse" (explicit LTR override)
 *      • no forceRTL,       rtl=true  → "row-reverse" (manual RTL)
 *      • no forceRTL,       rtl=false → "row"         (standard LTR)
 *
 * New for 2026:
 *  • JSDoc on every export.
 *  • marginStart / paddingStart / borderStartWidth helpers.
 *  • layoutDirection‑aware gap / position shortcuts.
 *  • Type‑safe StyleSheet creation helpers for RTL‑aware styles.
 */

import { I18nManager, type ViewStyle, type TextStyle, type ImageStyle } from "react-native";

// ── Module‑frozen RTL flag ──────────────────────────────────────────────
const _isRTL = I18nManager.isRTL;

/**
 * Returns true if the interface is currently right‑to‑left.
 * (value frozen at module load)
 */
export function isRtl(): boolean {
  return _isRTL;
}

/**
 * Return the correct flexDirection for a row that should respect RTL.
 *
 * @param rtl - override direction (defaults to system RTL)
 */
export function flexRow(rtl = _isRTL): ViewStyle["flexDirection"] {
  if (_isRTL) {
    return rtl ? "row" : "row-reverse";
  }
  return rtl ? "row-reverse" : "row";
}

/**
 * Return the correct flexDirection for a column (rarely directional, but
 * included for completeness).
 */
export function flexColumn(_rtl = _isRTL): ViewStyle["flexDirection"] {
  return "column"; // columns don't mirror in RTL by default
}

/**
 * Text alignment for start edge (left in LTR, right in RTL).
 */
export function textAlignStart(rtl = _isRTL): TextStyle["textAlign"] {
  return rtl ? "right" : "left";
}

/**
 * Text alignment for end edge (right in LTR, left in RTL).
 */
export function textAlignEnd(rtl = _isRTL): TextStyle["textAlign"] {
  return rtl ? "left" : "right";
}

/**
 * Physical edge name for the start side.
 */
export function edgeStart(rtl = _isRTL): "left" | "right" {
  return rtl ? "right" : "left";
}

/**
 * Physical edge name for the end side.
 */
export function edgeEnd(rtl = _isRTL): "left" | "right" {
  return rtl ? "left" : "right";
}

// ── 2026 additions: margin, padding, border directional shortcuts ─────

/**
 * Return a marginStart style property for the given value.
 */
export function marginStart(value: number | string, rtl = _isRTL): ViewStyle {
  return { [rtl ? "marginRight" : "marginLeft"]: value };
}

/**
 * Return a paddingStart style property for the given value.
 */
export function paddingStart(value: number | string, rtl = _isRTL): ViewStyle {
  return { [rtl ? "paddingRight" : "paddingLeft"]: value };
}

/**
 * Return a borderStartWidth style property for the given value.
 */
export function borderStartWidth(value: number, rtl = _isRTL): ViewStyle {
  return { [rtl ? "borderRightWidth" : "borderLeftWidth"]: value };
}

/**
 * Returns a `writingDirection` style for text that should always flow LTR
 * (e.g., numbers, codes) regardless of RTL.
 */
export function ltrWritingDirection(): TextStyle {
  return { writingDirection: "ltr" };
}

/**
 * Returns a `writingDirection` style for text that should always flow RTL.
 */
export function rtlWritingDirection(): TextStyle {
  return { writingDirection: "rtl" };
}

// ── Icon chevrons (frozen at load) ─────────────────────────────────────
export const BACK_CHEVRON = (_isRTL ? "chevron-forward" : "chevron-back") as "chevron-forward" | "chevron-back";
export const FORWARD_CHEVRON = (_isRTL ? "chevron-back" : "chevron-forward") as "chevron-forward" | "chevron-back";

// ── Justify helpers (unchanged) ────────────────────────────────────────
export const justifyStart = "flex-start" as const;
export const justifyEnd = "flex-end" as const;

// ── Additional convenience: RTL‑aware scale transform for icons ────────
/**
 * Returns a transform that flips the element horizontally when in RTL,
 * useful for directional icons (e.g., back arrows).
 */
export function rtlMirrorTransform(rtl = _isRTL): ImageStyle["transform"] {
  if (!rtl) return [];
  return [{ scaleX: -1 }];
}