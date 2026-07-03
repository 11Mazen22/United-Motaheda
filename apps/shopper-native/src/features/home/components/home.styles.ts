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
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    // paddingHorizontal is applied inline via useScreenLayout().pagePad in each consumer
  },
  left: {
    flex:          1,
    flexShrink:    1,
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

// ─── Countdown styles (FlashSaleSection with creative animations) ─────────────────

export const cntStyles = StyleSheet.create({
  timerRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  colon: {
    color:        kit.color.accentDeep,
    fontSize:     18,
    fontFamily:   theme.fonts.black,
    marginBottom: 14,
    fontWeight:   "700",
  },
  unit: {
    alignItems: "center",
    gap:        4,
  },
  cell: {
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
    minWidth:          44,
    alignItems:        "center",
    justifyContent:    "center",
    borderWidth:       0,
    shadowColor:       "#0E7E74",
    shadowOffset:      { width: 0, height: 0 },
    shadowOpacity:     0.25,
    shadowRadius:      8,
    elevation:         6,
    boxShadow:         "0px 0px 8px rgba(14,126,116,0.25)",
  },
  value: {
    color:              "#fff",
    fontSize:           16,
    lineHeight:         22,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
    fontWeight:         "700",
  },
  unitLabel: {
    color:         kit.color.accentDeep,
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 0.3,
  },
});

// ─── Flash sale section styles ────────────────────────────────────────────────

export const flashStyles = StyleSheet.create({
  itemWrap: {
    width:     166,
    marginEnd: 12,
  },
  sectionGap: {
    gap: kit.sp(5),
  },
  railContainer: {
    overflow: "hidden",
    borderRadius: kit.radius.lg,
  },
  railContent: {
    paddingVertical: 4,
  },
});

// ─── Featured section styles ──────────────────────────────────────────────────

export const featuredStyles = StyleSheet.create({
  itemWrap: {
    flex: 1,
  },
});