/**
 * home.styles — Shared geometry + theme-driven token helpers for the Home
 * screen component family. Pure-geometry values (padding, gap, radius) stay
 * as static StyleSheet objects; anything color-dependent is now a function
 * of the live theme instead of a hardcoded light-mode-only hex value, so
 * every section actually responds to dark mode.
 */

import { StyleSheet } from "react-native";
import { theme } from "@pharmacy/design-tokens";
import type { NativeTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

// ─── Section wrapper styles (pure geometry) ──────────────────────────────────

export const sectionStyles = StyleSheet.create({
  /** Standard section wrapper — 28 px top gap */
  wrap: {
    paddingTop: 28,
    gap: 16,
  },
  /** Taller top padding for the first section after the hero */
  wrapTall: {
    paddingTop: 36,
  },
  /** Section that starts immediately below — no top padding */
  wrapFlush: {
    paddingTop: 0,
    gap: 16,
  },
  /** Compact section */
  wrapSmall: {
    paddingTop: 16,
    gap: 12,
  },
});

/** Full-bleed hairline divider color, theme-driven. */
export function dividerColor(activeTheme: NativeTheme): string {
  return activeTheme.colors.border.default;
}

// ─── HomeSectionHeader styles (pure geometry) ────────────────────────────────

export const shStyles = StyleSheet.create({
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
  },
  start: {
    flex: 1,
    flexShrink: 1,
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    letterSpacing: -0.4,
  },
  moreBtn: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
});

// ─── Countdown styles (FlashSaleSection) ─────────────────────────────────────
// Always rendered against the same dark gradient banner regardless of app
// light/dark mode (a deliberate fixed-dark surface, like a hero), so these
// stay static white-on-dark rather than theme-driven.

export const cntStyles = StyleSheet.create({
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  colon: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 17,
    fontFamily: theme.fonts.black,
    marginBottom: 16,
  },
  unit: {
    alignItems: "center",
    gap: 4,
  },
  cell: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  value: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: theme.fonts.black,
    includeFontPadding: false,
  },
  unitLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 9,
    fontFamily: theme.fonts.bold,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  separator: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    fontFamily: theme.fonts.black,
    lineHeight: 22,
    marginBottom: 14,
  },
});

// ─── Flash sale / featured section styles (pure geometry) ───────────────────

export const flashStyles = StyleSheet.create({
  itemWrap: {
    width: 170,
    marginEnd: 12,
  },
  sectionGap: {
    gap: 0,
    overflow: "hidden",
  },
  railContainer: {
    overflow: "hidden",
  },
  railContent: {
    paddingVertical: 8,
  },
});

export const featuredStyles = StyleSheet.create({
  itemWrap: {
    flex: 1,
  },
});

// ─── Shared premium card tokens, theme-driven ────────────────────────────────

export interface CardTokenSet {
  surfaceCard: object;
  elevatedCard: object;
}

/** Call from a component that already has `theme` via useTheme() — replaces the old static cardTokens. */
export function getCardTokens(activeTheme: NativeTheme): CardTokenSet {
  return {
    surfaceCard: {
      backgroundColor: activeTheme.colors.canvas.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: activeTheme.colors.border.default,
      ...activeTheme.shadows[2],
    },
    elevatedCard: {
      backgroundColor: activeTheme.colors.canvas.surface,
      borderRadius: 20,
      ...activeTheme.shadows[3],
    },
  };
}
