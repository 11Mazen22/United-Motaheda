/**
 * kit — Unified Design System (V3)
 *
 * Single source of truth for all design tokens used across the app.
 * Every component imports from here — NOT from the legacy `theme` object —
 * to guarantee visual consistency.
 *
 * Tokens added in V3 (2026):
 *   color.canvas      App background (#f8fafc)
 *   color.well        Recessed surface for inner areas (#f1f5f9)
 *   color.onAccent    Text on accent-colored backgrounds (#fff)
 *   shadow.floating   More prominent shadow for search bars / overlays
 *   type.display      Large hero / hero-title text
 *   type.heading      Section sub-heading text
 *   type.body         Default body copy
 *   type.caption      Fine print / labels
 *   radius.sm / lg / xl  Extended radius scale
 *   spacing.*         Full 4 px-grid scale (xs → 6xl)
 */

import { Platform } from "react-native";

// ─── Platform-aware shadow helper ────────────────────────────────────────────

function makeShadow(
  color:    string,
  yOffset:  number,
  opacity:  number,
  blur:     number,
  elevation: number,
): object {
  return Platform.select({
    ios: {
      shadowColor:   color,
      shadowOffset:  { width: 0, height: yOffset },
      shadowOpacity: opacity,
      shadowRadius:  blur,
    },
    android: { elevation },
    default: {},
  }) ?? {};
}

// ─── Kit ─────────────────────────────────────────────────────────────────────

export const kit = {
  // ── 4 px grid ────────────────────────────────────────────────────────────
  /** Convert grid units to pixels: sp(3) = 12 */
  sp: (n: number): number => n * 4,

  spacing: {
    "1":  4,
    "2":  8,
    "3":  12,
    "4":  16,
    "5":  20,
    "6":  24,
    xs:   4,
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
    "5xl": 48,
    "6xl": 64,
  },

  // ── Colour palette ────────────────────────────────────────────────────────
  color: {
    // Brand
    accent:        "#06b6d4",   // cyan-500  — primary brand
    accentDeep:    "#0ea5b7",   // cyan-600  — buttons, links
    accentTint:    "#e6f7f8",   // cyan-50   — tinted backgrounds
    onAccent:      "#ffffff",   // text on accent surfaces
    onInk:         "#ffffff",   // text on dark ink surface

    // Ink / text
    ink:           "#07122a",   // near-black — primary text
    inkSoft:       "#475569",   // slate-600  — secondary text
    inkFaint:      "#94a3b8",   // slate-400  — placeholder / tertiary

    // Surfaces
    canvas:        "#f8fafc",   // app background (slate-50)
    surface:       "#ffffff",   // card / sheet surface
    well:          "#f1f5f9",   // recessed / inner surface (slate-100)

    // Borders
    line:          "#e6eef6",   // hairline separator
    lineStrong:    "rgba(15, 23, 42, 0.12)",

    // Semantic: success
    success:       "#059669",   // emerald-600
    successTint:   "#ecfdf5",   // emerald-50

    // Semantic: warning
    warn:          "#f59e0b",   // amber-500
    warnTint:      "#fff7ed",   // amber-50

    // Semantic: danger
    danger:        "#ef4444",   // red-500  (was #ff4d4f — minor correction)
    dangerTint:    "#fff1f0",   // red-50
  },

  // ── Border radius ─────────────────────────────────────────────────────────
  radius: {
    sm:   6,
    md:   8,
    card: 12,
    lg:   16,
    xl:   20,
    "2xl": 24,
    pill: 999,
    control: 10,
    sheet: 20,
  },

  // ── Shadows ───────────────────────────────────────────────────────────────
  shadow: {
    /** Subtle card lift — most surfaces */
    raised:   makeShadow("#0f172a", 1, 0.06, 3,  2),
    /** Prominent lift — sheets, modals, search bar */
    floating: makeShadow("#0f172a", 4, 0.10, 12, 6),
    /** Deep pop — bottom-sheets, toasts */
    deep:     makeShadow("#0f172a", 8, 0.14, 20, 10),
    brandGlow: makeShadow("#06b6d4", 0, 0.12, 12, 2),
  },

  // ── Typography scale ─────────────────────────────────────────────────────
  type: {
    /** Hero / screen title (e.g. "Find your medicine") */
    display: { fontSize: 26, lineHeight: 32 },
    /** Section title / card headline */
    title:   { fontSize: 20, lineHeight: 26 },
    /** Card sub-heading / widget heading */
    heading: { fontSize: 17, lineHeight: 24 },
    /** Default body copy */
    body:    { fontSize: 14, lineHeight: 20 },
    /** Small body / metadata */
    caption: { fontSize: 12, lineHeight: 17 },
    /** Micro labels, badges, eyebrows */
    micro:   { fontSize: 10, lineHeight: 14 },
  },
} as const;

export default kit;