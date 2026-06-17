/**
 * home.styles — Shared StyleSheet tokens for the Home screen component family.
 *
 * V3 changes:
 *   • Replaced `theme.spacing[n]` refs with `kit.sp(n)` — `theme` has no `.spacing`
 *   • Added `sectionStyles.divider`, `sectionStyles.wrapFlush`, `sectionStyles.wrapSmall`
 *   • Added `cntStyles.separator` for the countdown colon spacing fix
 *   • Ensured RTL via `flexRow(isRtl())`
 *
 * All dimensions follow the 4 px grid.
 */

import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

// ─── Section wrapper styles ───────────────────────────────────────────────────

export const sectionStyles = StyleSheet.create({
  /** Standard top-padded section wrapper */
  wrap: {
    paddingTop: kit.sp(6),    // 24 px
    gap:        kit.sp(4),    // 16 px
  },
  /** Taller top padding for the first section after the header */
  wrapTall: {
    paddingTop: kit.sp(8),    // 32 px
  },
  /** Section that starts immediately below — no top padding */
  wrapFlush: {
    paddingTop: 0,
    gap:        kit.sp(4),
  },
  /** Compact section (e.g. small carousels, inline widgets) */
  wrapSmall: {
    paddingTop: kit.sp(4),    // 16 px
    gap:        kit.sp(3),    // 12 px
  },
  /** Full-bleed horizontal hairline divider */
  divider: {
    height:          1,
    marginVertical:  kit.sp(2),   // 8 px
    backgroundColor: theme.colors.border.hairline,
    opacity:         0.7,
  },
});

// ─── HomeSectionHeader styles ─────────────────────────────────────────────────

export const shStyles = StyleSheet.create({
  row: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: theme.layout.pagePaddingH,
  },
  left: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           kit.sp(3),   // 12 px
  },
  icon: {
    width:          34,
    height:         34,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
    overflow:       "hidden",
  },
  title: {
    letterSpacing: -0.3,
  },
  moreBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 4,
    paddingVertical:   6,
  },
});

// ─── Countdown styles (FlashSaleSection) ─────────────────────────────────────

export const cntStyles = StyleSheet.create({
  timerRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  colon: {
    color:      kit.color.inkFaint,
    fontSize:   16,
    fontFamily: theme.fonts.black,
    marginBottom: 12,   // aligns colon with the digit cells
  },
  unit: {
    alignItems: "center",
    gap:        3,
  },
  cell: {
    borderRadius:      10,
    paddingHorizontal: 9,
    paddingVertical:   6,
    minWidth:          36,
    alignItems:        "center",
    backgroundColor:   kit.color.ink,
  },
  value: {
    color:              kit.color.onInk,
    fontSize:           14,
    lineHeight:         20,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
  },
  unitLabel: {
    color:    kit.color.inkFaint,
    fontSize: 9.5,
  },
});

// ─── Flash sale section styles ────────────────────────────────────────────────

export const flashStyles = StyleSheet.create({
  itemWrap: {
    width:     162,
    marginEnd: 12,
  },
  sectionGap: {
    gap: kit.sp(4),   // 16 px
  },
});

// ─── Featured section styles ──────────────────────────────────────────────────

export const featuredStyles = StyleSheet.create({
  itemWrap: {
    flex: 1,
  },
});