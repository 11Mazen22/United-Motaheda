import { StyleSheet } from "react-native";
import { flexRow, isRtl, textAlignStart, valueTextAlign } from "@/utils/layout";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import type { NativeTheme } from "@pharmacy/ui-native";

const TEXT_START = textAlignStart(isRtl());

/** Theme-driven order-detail styles — call once per render with the live theme. */
export function getOrderDetailStyles(theme: NativeTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.canvas.background,
    },
    centerScreen: {
      flex: 1,
      backgroundColor: theme.colors.canvas.background,
    },
    header: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: legacyTheme.spacing.md,
      paddingHorizontal: legacyTheme.spacing.lg,
      paddingBottom: 14,
      paddingTop: 10,
      backgroundColor: theme.colors.canvas.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border.default,
      ...theme.shadows[1],
    },
    headerEyebrow: {
      textAlign: TEXT_START,
    },
    headerOrderId: {
      letterSpacing: -0.3,
      textAlign: valueTextAlign,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.canvas.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    scrollContent: {
      paddingHorizontal: legacyTheme.layout.pagePaddingH,
      paddingTop: 14,
      gap: 14,
    },

    metaRow: {
      flexDirection: flexRow(isRtl()),
      flexWrap: "wrap",
      gap: legacyTheme.spacing.sm,
      marginBottom: 2,
    },
    metaChip: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: 5,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },

    section: {
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      ...theme.shadows[1],
    },
    sectionHeader: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: 10,
      paddingHorizontal: legacyTheme.spacing.lg,
      paddingTop: 14,
      paddingBottom: legacyTheme.spacing.sm,
    },
    sectionIconBox: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: theme.colors.brand.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      letterSpacing: -0.2,
    },
    sectionBody: {
      paddingHorizontal: legacyTheme.spacing.lg,
      paddingBottom: legacyTheme.spacing.lg,
      paddingTop: legacyTheme.spacing.xs,
      gap: 10,
    },

    timelineRow: {
      flexDirection: flexRow(isRtl()),
      alignItems: "flex-start",
      marginBottom: legacyTheme.spacing.xs,
    },
    timelineLeft: {
      alignItems: "center",
      width: 36,
      marginStart: legacyTheme.spacing.xs,
    },
    timelineDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    timelineDotDone: {
      backgroundColor: theme.colors.brand.primary,
    },
    timelineDotPending: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border.strong,
    },
    timelineLine: {
      width: 2,
      height: 20,
      marginTop: 3,
      backgroundColor: theme.colors.border.strong,
      borderRadius: 1,
    },
    timelineLineDone: {
      backgroundColor: theme.colors.brand.primary,
    },
    timelineText: {
      textAlign: textAlignStart(isRtl()),
      flex: 1,
      marginEnd: legacyTheme.spacing.md,
    },

    itemCardTouchable: {
      borderRadius: 14,
    },
    itemCard: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: legacyTheme.spacing.md,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 14,
      padding: legacyTheme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    itemCardPressed: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      transform: [{ scale: 0.99 }],
    },
    itemImage: {
      width: 60,
      height: 60,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.colors.canvas.surfaceMuted,
    },
    itemImagePlaceholder: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    itemTitle: {
      textAlign: TEXT_START,
    },
    itemMeta: {
      flexDirection: flexRow(isRtl()),
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: legacyTheme.spacing.xs,
    },
    itemPrice: {
      textAlign: valueTextAlign,
    },

    addressCard: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    addressRow: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: 10,
    },
    addressText: {
      textAlign: textAlignStart(isRtl()),
      flex: 1,
    },

    paymentCard: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: legacyTheme.spacing.md,
      borderRadius: 14,
      padding: 14,
    },
    paymentIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.canvas.surface,
      ...theme.shadows[1],
    },
    paymentStatusRow: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: legacyTheme.spacing.xs,
      marginTop: legacyTheme.spacing.xs,
    },
    transferRow: {
      flexDirection: flexRow(isRtl()),
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: legacyTheme.spacing.md,
      borderRadius: 10,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    proofContainer: {
      marginTop: legacyTheme.spacing.xs,
    },
    proofImage: {
      width: "100%",
      height: 220,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: theme.colors.canvas.surfaceMuted,
    },

    infoRow: {
      flexDirection: flexRow(isRtl()),
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 5,
    },
    infoLabel: {
      textAlign: TEXT_START,
    },
    infoValue: {
      textAlign: valueTextAlign,
    },
    priceDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border.default,
      marginVertical: 6,
    },
    priceDividerSpaced: {
      height: 1,
      backgroundColor: theme.colors.border.strong,
      marginVertical: legacyTheme.spacing.md,
      opacity: 0.6,
    },
    totalRow: {
      flexDirection: flexRow(isRtl()),
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    totalLabel: {
      textAlign: TEXT_START,
    },
    totalValueText: {
      textAlign: valueTextAlign,
    },

    errorState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: legacyTheme.spacing[4],
      paddingBottom: 80,
    },
    retryBtnTouchable: {
      marginTop: legacyTheme.spacing[2.5],
      borderRadius: 12,
    },
    retryBtn: {
      paddingHorizontal: legacyTheme.spacing[3],
      paddingVertical: legacyTheme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.colors.brand.primaryLight,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    retryBtnPressed: {
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primaryDark,
      transform: [{ scale: 0.97 }] as const,
    },
  });
}
