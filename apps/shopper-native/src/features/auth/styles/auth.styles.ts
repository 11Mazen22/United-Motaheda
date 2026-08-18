import { StyleSheet } from "react-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const { colors, layout, radius, spacing, shadow, fonts } = theme;

/**
 * Shared styles for all auth screens (login, register, forgot-password, verify-phone).
 * Screens may extend with a local StyleSheet for screen-specific rules.
 */
export const authStyles = StyleSheet.create({

  // ── Screen / Root ───────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Hero gradient section ────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: layout.pagePaddingH,
    paddingBottom:     spacing['4xl'],    // 40
    overflow:          "hidden",
    position:          "relative",
  },

  // ── Glass close / back button (top-left of hero) ────────────────────────────
  closeBtn: {
    position:        "absolute",
    top:             spacing.lg,          // 16
    start: layout.pagePaddingH,
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: colors.glass,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     colors.glassBorder,
  },

  // ── Hero icon / logo centering wrapper ──────────────────────────────────────
  iconWrap: {
    alignItems: "center",
    marginTop:  spacing.xl,              // 20
  },

  // ── Logo tile: full AppLogo card (login + register) ─────────────────────────
  logoTile: {
    width:           116,
    height:          116,
    borderRadius:    28,
    backgroundColor: colors.surface,     // was: "#fff"
    alignItems:      "center",
    justifyContent:  "center",
    ...shadow.lg,
  },

  // ── Hero text block ──────────────────────────────────────────────────────────
  heroTextWrap: {
    alignItems: "center",
    marginTop:  22,
  },
  heroTitle: {
    letterSpacing: -0.5,
  },

  // ── Pull-up form card ────────────────────────────────────────────────────────
  formCard: {
    backgroundColor:      colors.surface,
    borderTopStartRadius:  28,
    borderTopEndRadius: 28,
    marginTop:            -22,
    flex:                 1,
    padding:              layout.pagePaddingH,
    paddingTop:           28,            // spacing[3.5]
    gap:                  14,
    ...shadow.lg,
  },

  // ── Inline error banner ──────────────────────────────────────────────────────
  errorBox: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             10,
    backgroundColor: colors.error.bg,
    borderRadius:    radius.lg,
    padding:         spacing.md,         // 12
    borderWidth:     1,
    borderColor:     colors.error.light,
  },
  errorIcon: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: colors.error.bg,   // was: rgba(239,68,68,0.10)
    alignItems:      "center",
    justifyContent:  "center",
  },
  errorText: {
    flex:       1,
    color:      colors.error.text,
    fontFamily: fonts.semibold,
  },

  // ── Divider with label ───────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           spacing.md,           // 12
  },
  divider: {
    flex:            1,
    height:          1,
    backgroundColor: colors.border.hairline,
  },

  // ── Footer link row ──────────────────────────────────────────────────────────
  footer: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
  },
});
