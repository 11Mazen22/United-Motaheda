/**
 * Cart screen styles — VIP 2026 kit design language.
 *
 * VIP upgrades from previous version:
 *   • Header: 52×52 icon tile, 28px display title (was 42/24), surface bg + shadow
 *   • Eyebrow: accentDeep + letterSpacing 0.5 (was inkFaint, no tracking)
 *   • All cards: 12 (16) instead of 16 (12)
 *   • Product image box: 80×80 (was 72×72)
 *   • Line total: 20px black (was 18px)
 *   • Stepper buttons: 34×34 (was 32×32)
 *   • Free-delivery icon well: 48×48 (was 42×42)
 */
import { StyleSheet } from "react-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";


const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: theme.colors.canvas.background,
  },

  // ── Header — VIP editorial ─────────────────────────────────────────────────
  header: {
    paddingHorizontal: legacyTheme.layout.pagePaddingH,
    paddingBottom:     18,
    backgroundColor:   theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  headerRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  headerIcon: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: theme.colors.brand.primaryLight,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    flexShrink:      0,
  },
  headerEyebrow: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              theme.colors.brand.primary,
    letterSpacing:      0.5,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  headerTitle: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
  },
  countBadge: {
    backgroundColor:   theme.colors.brand.primaryLight,
    borderRadius:      9999,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
  },
  countText: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              theme.colors.brand.primary,
    includeFontPadding: false,
  },
  // Touchable wrapper carries only sizing/radius — visual styling lives on
  // the plain View inside instead of on the Pressable's own function-computed
  // style, which is unreliable under this app's RN/Fabric setup.
  clearBtnTouchable: {
    borderRadius: 9999,
  },
  clearBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 12,
    height:            36,
    borderRadius:      9999,
    backgroundColor:   `${theme.colors.status.error}1A`,
    borderWidth:       1,
    borderColor:       "rgba(179,38,30,0.18)",
  },
  clearBtnPressed: {
    opacity:   0.85,
    transform: [{ scale: 0.97 }],
  },
  clearText: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              theme.colors.status.error,
    includeFontPadding: false,
  },

  // ── List header components ─────────────────────────────────────────────────
  warnBanner: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               10,
    backgroundColor:   `${theme.colors.status.warning}1A`,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   12,
    marginBottom:      10,
    borderWidth:       1,
    borderColor:       "rgba(217,119,6,0.22)",
  },
  warnText: {
    flex:               1,
    fontFamily:         legacyTheme.fonts.semibold,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.status.warning,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  branchPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   14,
    marginBottom:      10,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    ...theme.shadows[1],
  },
  branchIconBox: {
    width:           38,
    height:          38,
    borderRadius:    13,
    backgroundColor: theme.colors.brand.primaryLight,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
  },
  branchEyebrow: {
    fontFamily:         legacyTheme.fonts.regular,
    fontSize:           10,
    lineHeight:         14,
    color:              theme.colors.text.muted,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  branchName: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           13,
    lineHeight:         19,
    color:              theme.colors.text.primary,
    textAlign:          TEXT_START,
    marginTop:          2,
    includeFontPadding: false,
  },
  deliveryCard: {
    backgroundColor: theme.colors.canvas.surface,
    borderRadius:    12,
    padding:         16,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    overflow:        "hidden",
    ...theme.shadows[1],
  },
  freeRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  freeIconBox: {
    width:           48,
    height:          48,
    borderRadius:    16,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: theme.colors.status.success,
    flexShrink:      0,
  },
  freeTitle: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           15,
    lineHeight:         22,
    color:              theme.colors.status.success,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  freeSub: {
    fontFamily:         legacyTheme.fonts.regular,
    fontSize:           11,
    lineHeight:         17,
    color:              theme.colors.text.secondary,
    textAlign:          TEXT_START,
    marginTop:          3,
    includeFontPadding: false,
  },
  progressHeader: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   10,
  },
  progressLeft: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           7,
    flex:          1,
  },
  progressLabel: {
    fontFamily:         legacyTheme.fonts.semibold,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.text.secondary,
    textAlign:          TEXT_START,
    flex:               1,
    includeFontPadding: false,
  },
  progressPct: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           13,
    lineHeight:         19,
    color:              theme.colors.text.primary,
    marginStart:        8,
    includeFontPadding: false,
  },
  track: {
    height:          7,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderRadius:    4,
    overflow:        "hidden",
  },
  fill: {
    height:          "100%",
    backgroundColor: theme.colors.brand.primary,
    borderRadius:    4,
  },
  trustRow: {
    flexDirection:     flexRow(IS_RTL),
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      12,
    paddingVertical:   16,
    paddingHorizontal: 8,
    marginBottom:      10,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    ...theme.shadows[1],
  },
  trustCell: {
    flex:              1,
    alignItems:        "center",
    gap:               7,
    paddingHorizontal: 8,
  },
  trustDivider: {
    borderEndWidth: StyleSheet.hairlineWidth,
    borderEndColor: theme.colors.border.strong,
  },
  trustIconBox: {
    width:          32,
    height:         32,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
  },
  trustLabel: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           9,
    lineHeight:         13,
    color:              theme.colors.text.secondary,
    textAlign:          "center",
    includeFontPadding: false,
  },

  // ── Cart item card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingTop:        14,
    paddingBottom:     14,
    gap:               12,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    ...theme.shadows[1],
  },
  cardTopRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  catLabel: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              theme.colors.text.muted,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    letterSpacing:      0.3,
  },
  deleteBtnTouchable: {
    borderRadius: 10,
  },
  deleteBtn: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: `${theme.colors.status.error}1A`,
    borderWidth:     1,
    borderColor:     "rgba(179,38,30,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  deleteBtnPressed: {
    opacity:   0.82,
    transform: [{ scale: 0.94 }],
  },
  cardMidRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "flex-start",
    gap:           14,
  },
  imgBox: {
    width:           80,
    height:          80,
    borderRadius:    16,
    overflow:        "hidden",
    backgroundColor: theme.colors.canvas.surfaceMuted,
    flexShrink:      0,
  },
  imgFallback: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  productName: {
    flex:               1,
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           14,
    lineHeight:         21,
    color:              theme.colors.text.primary,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  cardBottomRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  priceWrap: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "baseline",
    gap:           4,
  },
  lineTotal: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           20,
    lineHeight:         28,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  currency: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              theme.colors.text.secondary,
    includeFontPadding: false,
  },
  unitHint: {
    fontFamily:         legacyTheme.fonts.regular,
    fontSize:           10,
    lineHeight:         15,
    color:              theme.colors.text.muted,
    marginStart:        4,
    includeFontPadding: false,
  },

  // ── Stepper — product-detail parity: square wells, neutral −, accent + ─────
  // Outer well holds three children of equal height (36): minus, value, plus.
  // RTL flow is handled by flexRow(IS_RTL) so the accent + always sits on the
  // logical END, mirroring the product detail page.
  stepper: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    gap:             3,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    padding:         3,
  },
  // Touchable wrapper carries only sizing/radius for both stepper variants —
  // visual styling (bg, border, glyph) lives on the plain View inside instead
  // of on the Pressable's own function-computed style, which is unreliable
  // under this app's RN/Fabric setup.
  stepBtnTouchable: {
    width:        36,
    height:       36,
    borderRadius: 9,
  },
  // Decrement — neutral surface chip
  stepBtn: {
    width:           36,
    height:          36,
    borderRadius:    9,
    backgroundColor: theme.colors.canvas.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
  },
  stepBtnPressed: {
    backgroundColor: theme.colors.brand.primaryLight,
    borderColor:     theme.colors.brand.primary,
    transform:       [{ scale: 0.96 }],
  },
  stepBtnDisabled: {
    opacity: 0.45,
  },
  // Increment — primary accent (mirrors product detail)
  stepBtnPrimary: {
    width:           36,
    height:          36,
    borderRadius:    9,
    backgroundColor: theme.colors.brand.primary,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     theme.colors.brand.primary,
  },
  stepBtnPrimaryPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.96 }],
  },
  qtyCell: {
    minWidth:       36,
    height:         36,
    alignItems:     "center",
    justifyContent: "center",
  },
  qtyNum: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           16,
    lineHeight:         22,
    color:              theme.colors.text.primary,
    minWidth:           24,
    textAlign:          "center",
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  qtyNumMax: {
    color: theme.colors.status.warning,
  },
  maxHint: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    alignSelf:         "flex-start",
    paddingHorizontal: 10,
    paddingVertical:   4,
    backgroundColor:   `${theme.colors.status.warning}1A`,
    borderRadius:      9999,
    borderWidth:       1,
    borderColor:       "rgba(217,119,6,0.22)",
  },
  maxHintText: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    color:              theme.colors.status.warning,
    includeFontPadding: false,
  },

  // ── Checkout Footer — sticky, elevated ────────────────────────────────────
  footer: {
    backgroundColor:   theme.colors.canvas.surface,
    paddingHorizontal: legacyTheme.layout.pagePaddingH,
    paddingTop:        16,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    theme.colors.border.default,
    shadowColor:       theme.colors.text.primary,
    shadowOffset:      { width: 0, height: -6 },
    shadowOpacity:     0.06,
    shadowRadius:      16,
    elevation:         14,
    boxShadow:         "0px -6px 16px rgba(7,18,42,0.06)",
  },
  footerHandle: {
    width:           36,
    height:          3,
    borderRadius:    2,
    backgroundColor: theme.colors.border.strong,
    alignSelf:       "center",
    marginBottom:    14,
  },
  totalsBlock: {
    gap:               6,
    marginBottom:      12,
    paddingBottom:     12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
  },
  totalRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontFamily:         legacyTheme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.text.muted,
    includeFontPadding: false,
  },
  totalValue: {
    fontFamily:         legacyTheme.fonts.semibold,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.text.secondary,
    includeFontPadding: false,
  },
  totalFree: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.status.success,
    includeFontPadding: false,
  },
  totalDiscount: {
    fontFamily:         legacyTheme.fonts.semibold,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.status.error,
    includeFontPadding: false,
  },

  // ── Checkout row — price block + solid-ink pill CTA ───────────────────────
  checkoutRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            14,
  },
  priceBlock: { gap: 2 },
  priceLabel: {
    fontFamily:         legacyTheme.fonts.regular,
    fontSize:           11,
    lineHeight:         16,
    color:              theme.colors.text.muted,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  priceRow: {
    flexDirection: "row",
    alignItems:    "baseline",
    gap:           4,
  },
  priceTotal: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.8,
    includeFontPadding: false,
  },
  priceCurrency: {
    fontFamily:         legacyTheme.fonts.bold,
    fontSize:           13,
    lineHeight:         19,
    color:              theme.colors.text.secondary,
    includeFontPadding: false,
  },
  checkoutOuter: {
    flex:         1,
    borderRadius: 9999,
    overflow:     "hidden",
    maxWidth:     220,
  },
  checkoutInner: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    gap:               8,
    paddingVertical:   17,
    paddingHorizontal: 20,
    borderRadius:      9999,
    backgroundColor:   theme.colors.text.primary,
  },
  checkoutInnerDisabled: {
    backgroundColor: theme.colors.text.muted,
  },
  checkoutInnerPressed: {
    opacity:   0.92,
    transform: [{ scale: 0.98 }],
  },
  checkoutText: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              theme.colors.text.inverse,
    includeFontPadding: false,
  },
});
