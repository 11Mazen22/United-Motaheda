/**
 * Shared styles for the Orders screen family — 2026 kit design language.
 *
 * Only two style sets remain: `emptyS` (authenticated empty state) and
 * `listS` (the order list + card chrome + skeletons). The dark-hero gradient
 * palette constants and the `authS` block were removed when OrdersScreen,
 * EmptyOrdersState, and UnauthenticatedState moved to the light kit.
 */
import { StyleSheet } from "react-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { flexRow, isRtl, valueTextAlign } from "@/utils/layout";


// ── Empty state (authenticated, no orders)
export const emptyS = StyleSheet.create({
  container: {
    alignItems:        "center",
    paddingTop:        36,
    paddingHorizontal: theme.spacing[3],
    gap:               theme.spacing[3],
  },
  illusWrap: { marginBottom: legacyTheme.spacing.xs },
  illusBg: {
    width:           160,
    height:          160,
    borderRadius:    80,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: theme.colors.brand.primaryLight,
  },
  illusRing: {
    width:          130,
    height:         130,
    borderRadius:   65,
    borderWidth:    1.5,
    borderColor:    theme.colors.border.default,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: theme.colors.canvas.surface,
  },
  illusBadge: {
    position:        "absolute",
    bottom:          16,
    end:             16,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: theme.colors.brand.primary,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     theme.colors.canvas.surface,
  },
  textBlock: {
    alignItems: "center",
    gap:        legacyTheme.spacing.sm,
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
    marginTop:  legacyTheme.spacing.sm,
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
    borderRadius:      9999,
  },
  catLabel: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 12, lineHeight: 18,
    includeFontPadding: false,
  },
});

// ── Orders list
// listContent padding is overridden inline by OrdersScreen with
// useScreenLayout().pagePad so the gutter scales on tablet/large-tablet.
export const listS = StyleSheet.create({
  listContent: {
    paddingHorizontal: legacyTheme.layout.pagePaddingH,
    paddingTop:        legacyTheme.spacing.lg,
    paddingBottom:     legacyTheme.spacing.lg,
    gap:               legacyTheme.spacing.md,
  },
  card: {
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      16,
    paddingHorizontal: 16,
    paddingVertical:   18,
    gap:               14,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    ...theme.shadows[1],
  },
  cardFooter: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  // Footer total — value-shaped, LTR-locked
  totalText: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           17,
    lineHeight:         24,
    color:              theme.colors.text.primary,
    textAlign:          valueTextAlign,
    includeFontPadding: false,
  },
  skeletonRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           10,
    marginTop:     legacyTheme.spacing.xs,
  },
  skeletonItems: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             legacyTheme.spacing.md,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderRadius:    14,
    padding:         legacyTheme.spacing.md,
  },
  skeletonFooter: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  skeletonRect: {
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderRadius:    6,
  },
  skeletonContainer: {
    gap:     legacyTheme.spacing.md,
    padding: legacyTheme.spacing.lg,
  },
});
