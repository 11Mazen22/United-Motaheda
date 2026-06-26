import { StyleSheet } from "react-native";
import { flexRow, isRtl, textAlignStart, valueTextAlign } from "@/utils/layout";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";

const TEXT_START = textAlignStart(isRtl());

export const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  centerScreen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  header: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom:     14,
    paddingTop:        10,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  headerEyebrow: {
    textAlign: TEXT_START,
  },
  headerOrderId: {
    letterSpacing: -0.3,
    // Order IDs are value-shaped: keep LTR composition on both languages.
    textAlign:     valueTextAlign,
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
  },
  // scrollContent padding is overridden inline with useScreenLayout().pagePad
  // by the screen so tablet breakpoints get the wider gutter.
  scrollContent: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingTop:        14,
    gap:               14,
  },

  // Meta chips
  metaRow: {
    flexDirection: flexRow(isRtl()),
    flexWrap:      "wrap",
    gap:           theme.spacing.sm,
    marginBottom:  2,
  },
  metaChip: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.well,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },

  // Section card
  section: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.card,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  sectionHeader: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: theme.spacing.lg,
    paddingTop:        14,
    paddingBottom:     theme.spacing.sm,
  },
  sectionIconBox: {
    width:           30,
    height:          30,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  sectionTitle: {
    letterSpacing: -0.2,
  },
  sectionBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom:     theme.spacing.lg,
    paddingTop:        theme.spacing.xs,
    gap:               10,
  },

  // Timeline
  timelineRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "flex-start",
    marginBottom:  theme.spacing.xs,
  },
  timelineLeft: {
    alignItems:  "center",
    width:       36,
    marginStart: theme.spacing.xs,
  },
  timelineDot: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: kit.color.accent,
  },
  timelineDotPending: {
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.lineStrong,
  },
  timelineLine: {
    width:           2,
    height:          20,
    marginTop:       3,
    backgroundColor: kit.color.lineStrong,
    borderRadius:    1,
  },
  timelineLineDone: {
    backgroundColor: kit.color.accent,
  },
  timelineText: {
    textAlign:    textAlignStart(isRtl()),
    flex:         1,
    marginEnd:    theme.spacing.md,
  },

  // Item cards
  itemCard: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             theme.spacing.md,
    backgroundColor: kit.color.surface,
    borderRadius:    14,
    padding:         theme.spacing.md,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  itemCardPressed: {
    backgroundColor: kit.color.well,
    transform:       [{ scale: 0.99 }],
  },
  itemImage: {
    width:           60,
    height:          60,
    borderRadius:    10,
    overflow:        "hidden",
    backgroundColor: kit.color.well,
  },
  itemImagePlaceholder: {
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },
  itemTitle: {
    textAlign: TEXT_START,
  },
  itemMeta: {
    flexDirection:  flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      theme.spacing.xs,
  },
  itemPrice: {
    textAlign: valueTextAlign,
  },

  // Address
  addressCard: {
    backgroundColor: kit.color.well,
    borderRadius:    14,
    padding:         14,
    gap:             10,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  addressRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           10,
  },
  addressText: {
    textAlign: textAlignStart(isRtl()),
    flex:      1,
  },

  // Payment
  paymentCard: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           theme.spacing.md,
    borderRadius:  14,
    padding:       14,
  },
  paymentIconBox: {
    width:           44,
    height:          44,
    borderRadius:    14,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.surface,
    ...kit.shadow.raised,
  },
  paymentStatusRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           theme.spacing.xs,
    marginTop:     theme.spacing.xs,
  },
  transferRow: {
    flexDirection:     flexRow(isRtl()),
    justifyContent:    "space-between",
    alignItems:        "center",
    paddingVertical:   10,
    paddingHorizontal: theme.spacing.md,
    borderRadius:      10,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  proofContainer: {
    marginTop: theme.spacing.xs,
  },
  proofImage: {
    width:           "100%",
    height:          220,
    borderRadius:    14,
    overflow:        "hidden",
    backgroundColor: kit.color.well,
  },

  // ── Price block — receipt grammar
  // The breakdown reads like a pharmacy receipt: small label on the logical
  // START, numeric value on the logical END, hairlines for groupings, a thicker
  // dashed-feel divider before the total row.
  infoRow: {
    flexDirection:   flexRow(isRtl()),
    justifyContent:  "space-between",
    alignItems:      "center",
    paddingVertical: 5,
  },
  infoLabel: {
    textAlign: TEXT_START,
  },
  infoValue: {
    // Numeric values stay LTR for "199.00 EGP" readability in either language.
    textAlign: valueTextAlign,
  },
  priceDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.line,
    marginVertical:  6,
  },
  priceDividerSpaced: {
    height:          1,
    backgroundColor: kit.color.lineStrong,
    marginVertical:  theme.spacing.md,
    opacity:         0.6,
  },
  totalRow: {
    flexDirection:  flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems:     "baseline",
  },
  totalLabel: {
    textAlign: TEXT_START,
  },
  totalValueText: {
    textAlign: valueTextAlign,
  },

  // Error state
  errorState: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: theme.spacing[4],
    paddingBottom:     80,
  },
  retryBtn: {
    marginTop:         theme.spacing[2.5],
    paddingHorizontal: theme.spacing[3],
    paddingVertical:   theme.spacing.md,
    borderRadius:      12,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
});
