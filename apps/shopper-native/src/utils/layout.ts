/**
 * layout.ts — RTL-aware layout utilities.
 *
 * i18n/index.ts calls I18nManager.forceRTL(true) for Arabic at boot.
 * With forceRTL active, React Native's flex engine treats START as the
 * physical RIGHT edge — so flexDirection:"row" ALREADY flows right-to-left.
 * Returning "row-reverse" in RTL would double-mirror back to LTR.
 *
 * flexRow() therefore maps:
 *   forceRTL active   (AR, _isRTL=true):  rtl=true  → "row"         (RTL via system)
 *                                          rtl=false → "row-reverse" (explicit LTR override)
 *   no forceRTL       (EN, _isRTL=false): rtl=true  → "row-reverse" (manual RTL)
 *                                          rtl=false → "row"         (standard LTR)
 *
 * All other helpers are unaffected — text alignment uses physical "right"/"left"
 * which are correct regardless of forceRTL state.
 *
 * Values are frozen at module load; a language switch triggers a full app
 * reload (Updates.reloadAsync / DevSettings.reload) so they refresh correctly.
 */

import { I18nManager, type TextStyle, type ViewStyle } from "react-native";

// ─── RTL flag ─────────────────────────────────────────────────────────────────
// Read once at import time — stable for the entire session.
const _isRTL = I18nManager.isRTL;

/** Returns true when the app is in RTL mode (Arabic). */
export function isRtl(): boolean {
  return _isRTL;
}

// ─── flexDirection ────────────────────────────────────────────────────────────

/**
 * RTL-aware flex row direction, accounting for I18nManager.forceRTL.
 *
 * When forceRTL is active (_isRTL=true), "row" already flows RTL.
 * When not active (_isRTL=false), "row-reverse" produces RTL flow.
 *
 * @param rtl  Override (defaults to app RTL flag). Pass false to force LTR.
 */
export function flexRow(rtl = _isRTL): ViewStyle["flexDirection"] {
  if (_isRTL) {
    // forceRTL active: "row" = RTL, "row-reverse" = explicit LTR override
    return rtl ? "row" : "row-reverse";
  }
  // No forceRTL: "row-reverse" = RTL, "row" = LTR
  return rtl ? "row-reverse" : "row";
}

// ─── textAlign ────────────────────────────────────────────────────────────────

/**
 * Text alignment for the logical START of the current direction.
 * AR → "right"   EN → "left"
 */
export function textAlignStart(rtl = _isRTL): TextStyle["textAlign"] {
  return rtl ? "right" : "left";
}

/**
 * Text alignment for the logical END of the current direction.
 * AR → "left"   EN → "right"
 */
export function textAlignEnd(rtl = _isRTL): TextStyle["textAlign"] {
  return rtl ? "left" : "right";
}

// ─── Absolute edge helpers ────────────────────────────────────────────────────
// Use when you need to position an element at a physical edge but want it
// to map to the logical start/end instead.

/**
 * Physical edge key for the logical START of the current direction.
 * AR → "right"  (Arabic start = physical right)
 * EN → "left"   (English start = physical left)
 */
export function edgeStart(rtl = _isRTL): "left" | "right" {
  return rtl ? "right" : "left";
}

/**
 * Physical edge key for the logical END of the current direction.
 * AR → "left"   (Arabic end = physical left)
 * EN → "right"  (English end = physical right)
 */
export function edgeEnd(rtl = _isRTL): "left" | "right" {
  return rtl ? "left" : "right";
}

// ─── Directional chevron icons ───────────────────────────────────────────────
//
// Ionicons glyphs are NOT auto-mirrored by I18nManager.forceRTL — they are
// plain font characters.  Use these named constants everywhere a directional
// chevron is needed so the correct glyph is chosen per language at module load.
//
// Back  (→ Arabic, ← English): previous screen is to the RIGHT in RTL navigation.
// Fwd   (← Arabic, → English): deeper content is to the LEFT in RTL reading.

/** Chevron icon for "go back / return to previous screen". */
export const BACK_CHEVRON    = (_isRTL ? "chevron-forward" : "chevron-back")    as "chevron-forward" | "chevron-back";

/** Chevron icon for "go forward / see more / expand". */
export const FORWARD_CHEVRON = (_isRTL ? "chevron-back"    : "chevron-forward") as "chevron-forward" | "chevron-back";

/** Arrow icon (thicker than chevron) for "go back / return to previous screen". */
export const BACK_ARROW      = (_isRTL ? "arrow-forward"   : "arrow-back")      as "arrow-forward" | "arrow-back";

/** Arrow icon for "advance to next / continue / submit". */
export const FORWARD_ARROW   = (_isRTL ? "arrow-back"      : "arrow-forward")   as "arrow-forward" | "arrow-back";

// ─── justifyContent helpers ───────────────────────────────────────────────────

/**
 * justifyContent value that pushes items toward the logical START.
 * Both "row" and "row-reverse" use "flex-start" for the start-aligned
 * direction — but the physical edge differs. Use with `flexRow()`.
 */
export const justifyStart = "flex-start" as const;

/**
 * justifyContent value for logical END alignment.
 */
export const justifyEnd   = "flex-end"   as const;
