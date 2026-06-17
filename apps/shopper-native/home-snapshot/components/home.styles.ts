/**
 * Shared StyleSheet tokens for the Home screen component family.
 */
import { StyleSheet } from "react-native";
import { theme } from "../shared/theme";
import { flexRow, isRtl } from "../utils/layout";
import { kit } from "../shared/kit";

export const sectionStyles = StyleSheet.create({
  wrap: { paddingTop: theme.spacing['2xl'], gap: theme.spacing[4] },
  wrapTall: { paddingTop: theme.spacing['3xl'] },
});

export const shStyles = StyleSheet.create({
  row: { flexDirection: flexRow(isRtl()), alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.layout.pagePaddingH },
  left: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  title: { letterSpacing: -0.3 },
  moreBtn: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 4, paddingHorizontal: 4 },
});

export const cntStyles = StyleSheet.create({
  timerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  colon: { color: kit.color.inkFaint, fontSize: 16, fontFamily: theme.fonts.black, marginBottom: 12 },
  unit: { alignItems: "center", gap: 3 },
  cell: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, minWidth: 36, alignItems: "center", backgroundColor: kit.color.ink },
  value: { color: kit.color.onInk, fontSize: 14, lineHeight: 20, fontFamily: theme.fonts.black, includeFontPadding: false },
  unitLabel: { color: kit.color.inkFaint, fontSize: 9.5 },
});

export const flashStyles = StyleSheet.create({ itemWrap: { width: 162, marginEnd: 12 }, sectionGap: { gap: theme.spacing[4] } });
export const featuredStyles = StyleSheet.create({ itemWrap: { flex: 1 } });
