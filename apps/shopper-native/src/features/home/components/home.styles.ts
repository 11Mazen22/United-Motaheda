/**
 * home.styles — Shared design tokens for the Home screen component family.
 *
 * 2026 Premium Redesign:
 *   • Richer section wrapper variants with staggered entry spacing
 *   • Elevated card tokens (shadow layering, border system)
 *   • Countdown cell styles with glow shadow
 *   • Flash-sale rail styles
 *   • All dimensions on the 4 px grid
 */

import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

// ─── Section wrapper styles ───────────────────────────────────────────────────

export const sectionStyles = StyleSheet.create({
  /** Standard section wrapper — 28 px top gap */
  wrap: {
    paddingTop: 28,
    gap: 16,
  },
  /** Taller top padding for the first section after the header (e.g. HomeHero) */
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
  /** Full-bleed horizontal hairline divider */
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    backgroundColor: "rgba(15,23,42,0.07)",
  },
});

// ─── HomeSectionHeader styles ─────────────────────────────────────────────────

export const shStyles = StyleSheet.create({
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
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

// ─── Flash sale section styles ────────────────────────────────────────────────

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

// ─── Featured section styles ──────────────────────────────────────────────────

export const featuredStyles = StyleSheet.create({
  itemWrap: {
    flex: 1,
  },
});

// ─── Shared premium card tokens ───────────────────────────────────────────────

export const cardTokens = {
  /** Full-radius surface card with soft shadow */
  surfaceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#0C2240",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  /** Slightly more elevated card */
  elevatedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    shadowColor: "#0C2240",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  /** Brand-tinted card */
  brandCard: {
    borderRadius: 20,
    overflow: "hidden" as const,
  },
} as const;
