import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { kit } from "@/shared/kit";

// ─── Header ──────────────────────────────────────────────────────────────────
export const headerStyles = StyleSheet.create({
  root: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: theme.spacing[4],
    paddingBottom:     16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  badge: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
    backgroundColor:   kit.color.successTint,
    borderWidth:       1.5,
    borderColor:       "rgba(5,150,105,0.25)",
  },
});

// ─── Step bar ─────────────────────────────────────────────────────────────────
export const stepBarStyles = StyleSheet.create({
  root: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: theme.spacing[4],
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  pill: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  pillActive: {
    borderWidth: 1.5,
    ...kit.shadow.raised,
  },
  num: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
  },
  numText:  { fontSize: 11, fontFamily: theme.fonts.black, color: "#fff" },
  label:    { fontSize: 12, fontFamily: theme.fonts.bold,  letterSpacing: 0.2 },
  line: {
    flex:            1,
    height:          3,
    backgroundColor: kit.color.lineStrong,
    borderRadius:    2,
  },
});

// ─── Section card ─────────────────────────────────────────────────────────────
export const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    16,
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderTopWidth:  3,
    borderTopColor:  kit.color.accentDeep,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  head: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     12,
  },
  titleWrap: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           10,
  },
  icon: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  actionWrap: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  body: {
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     16,
    gap:               12,
  },
});

// ─── CTA bar ─────────────────────────────────────────────────────────────────
export const ctaStyles = StyleSheet.create({
  root: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
    paddingHorizontal: theme.spacing[4],
    paddingTop:        16,
    gap:               14,
    ...kit.shadow.floating,
  },
  totals: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  countBadge: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      999,
  },
  btnInner: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 6 },
  btnText:  { fontSize: 15, fontFamily: theme.fonts.black, color: kit.color.onInk, letterSpacing: -0.2 },
  totalValue: {
    color:              kit.color.ink,
    letterSpacing:      -0.8,
    marginTop:          2,
    includeFontPadding: false,
  },
});

// ─── Summary row ─────────────────────────────────────────────────────────────
export const summaryStyles = StyleSheet.create({
  row: {
    flexDirection:   flexRow(isRtl()),
    justifyContent:  "space-between",
    alignItems:      "center",
    paddingVertical: 6,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.line,
    marginVertical:  12,
  },
  totalRow: {
    flexDirection:  flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems:     "baseline",
  },
  totalLabel: {
    fontSize:           14,
    fontFamily:         theme.fonts.extrabold,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    includeFontPadding: false,
  },
  totalValue: {
    fontSize:           24,
    fontFamily:         theme.fonts.black,
    color:              kit.color.ink,
    letterSpacing:      -0.8,
    includeFontPadding: false,
  },
  etaPill: {
    alignSelf:          "flex-end",
    flexDirection:      flexRow(isRtl()),
    alignItems:         "center",
    gap:                5,
    backgroundColor:    kit.color.accentTint,
    paddingHorizontal:  10,
    paddingVertical:    5,
    borderRadius:       999,
    marginTop:          8,
    borderWidth:        1,
    borderColor:        kit.color.line,
  },
  etaText: { fontSize: 10, fontFamily: theme.fonts.bold, color: kit.color.accentDeep, includeFontPadding: false },
});

// ─── Free-delivery banner ─────────────────────────────────────────────────────
export const freeBannerStyles = StyleSheet.create({
  root: {
    borderRadius:    18,
    padding:         14,
    gap:             10,
    marginBottom:    16,
    backgroundColor: kit.color.warnTint,
    borderWidth:     1,
    borderColor:     "rgba(245,158,11,0.28)",
    borderTopWidth:  3,
    borderTopColor:  "rgba(245,158,11,0.6)",
    overflow:        "hidden",
  },
  head: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           10,
  },
  iconBox: {
    width:           34,
    height:          34,
    borderRadius:    11,
    backgroundColor: "rgba(245,158,11,0.18)",
    borderWidth:     1,
    borderColor:     "rgba(245,158,11,0.35)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  title: {
    color:              kit.color.warn,
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    lineHeight:         18,
    marginTop:          2,
    includeFontPadding: false,
  },
  barTrack: {
    height:          5,
    borderRadius:    3,
    backgroundColor: "rgba(245,158,11,0.2)",
    overflow:        "hidden",
  },
  barFill: {
    height:          "100%",
    backgroundColor: kit.color.warn,
    borderRadius:    3,
  },
});

// ─── Error box ───────────────────────────────────────────────────────────────
export const errorStyles = StyleSheet.create({
  box: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "flex-start",
    gap:               8,
    padding:           12,
    borderRadius:      14,
    backgroundColor:   kit.color.dangerTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  text: {
    flex:               1,
    fontSize:           11,
    fontFamily:         theme.fonts.semibold,
    color:              kit.color.danger,
    textAlign:          textAlignStart(isRtl()),
    lineHeight:         18,
    includeFontPadding: false,
  },
});
