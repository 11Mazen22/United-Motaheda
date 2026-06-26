/**
 * Shared styles for the Orders screen family — 2026 kit design language.
 *
 * Only two style sets remain: `emptyS` (authenticated empty state) and
 * `listS` (the order list + card chrome + skeletons). The dark-hero gradient
 * palette constants and the `authS` block were removed when OrdersScreen,
 * EmptyOrdersState, and UnauthenticatedState moved to the light kit.
 */
import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, valueTextAlign } from "@/utils/layout";
import { kit } from "@/shared/kit";

// ── Empty state (authenticated, no orders)
export const emptyS = StyleSheet.create({
  container: {
    alignItems:        "center",
    paddingTop:        36,
    paddingHorizontal: theme.spacing[3],
    gap:               theme.spacing[3],
  },
  illusWrap: { marginBottom: theme.spacing.xs },
  illusBg: {
    width:           160,
    height:          160,
    borderRadius:    80,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.accentTint,
  },
  illusRing: {
    width:          130,
    height:         130,
    borderRadius:   65,
    borderWidth:    1.5,
    borderColor:    kit.color.line,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: kit.color.surface,
  },
  illusBadge: {
    position:        "absolute",
    bottom:          16,
    end:             16,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: kit.color.accent,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     kit.color.surface,
  },
  textBlock: {
    alignItems: "center",
    gap:        theme.spacing.sm,
  },
  headline: { letterSpacing: -0.4 },
  sub: {
    lineHeight: 20,
    maxWidth:   280,
    textAlign:  "center",
  },
  catsSection: {
    width:      "100%",
    alignItems: "center",
    marginTop:  theme.spacing.sm,
  },
  catRow: {
    flexDirection:  flexRow(isRtl()),
    gap:            10,
    flexWrap:       "wrap",
    justifyContent: "center",
  },
  catChip: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               7,
    paddingHorizontal: 14,
    height:            40,
    borderRadius:      kit.radius.pill,
  },
  catLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 12, lineHeight: 18,
    includeFontPadding: false,
  },
});

// ── Orders list
// listContent padding is overridden inline by OrdersScreen with
// useScreenLayout().pagePad so the gutter scales on tablet/large-tablet.
export const listS = StyleSheet.create({
  listContent: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingTop:        theme.spacing.lg,
    paddingBottom:     theme.spacing.lg,
    gap:               theme.spacing.md,
  },
  card: {
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.card,
    paddingHorizontal: 16,
    paddingVertical:   18,
    gap:               14,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  cardFooter: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  // Footer total — value-shaped, LTR-locked
  totalText: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         24,
    color:              kit.color.ink,
    textAlign:          valueTextAlign,
    includeFontPadding: false,
  },
  skeletonRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           10,
    marginTop:     theme.spacing.xs,
  },
  skeletonItems: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             theme.spacing.md,
    backgroundColor: kit.color.well,
    borderRadius:    14,
    padding:         theme.spacing.md,
  },
  skeletonFooter: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  skeletonRect: {
    backgroundColor: kit.color.well,
    borderRadius:    6,
  },
  skeletonContainer: {
    gap:     theme.spacing.md,
    padding: theme.spacing.lg,
  },
});
