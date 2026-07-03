/**
 * Shared styles for the Profile screen family.
 *
 * Intentional non-token values (documented):
 *   HERO_GLASS   — white glass overlays on the dark hero gradient
 *   PROFILE      — feature-specific accent colours without theme tokens
 */
import { StyleSheet } from "react-native";
import { theme } from "@/shared/theme";
import { flexRow, isRtl } from "@/utils/layout";

// ─── Glass overlay constants ──────────────────────────────────────────────────
/** Semi-transparent white values for glass surfaces on the hero gradient. */
export const HERO_GLASS = {
  w02:  "rgba(255,255,255,0.02)",
  w025: "rgba(255,255,255,0.025)",
  w04:  "rgba(255,255,255,0.04)",
  w10:  "rgba(255,255,255,0.10)",
  w12:  "rgba(255,255,255,0.12)",
  w13:  "rgba(255,255,255,0.13)",
  w15:  "rgba(255,255,255,0.15)",
  w16:  "rgba(255,255,255,0.16)",
  w18:  "rgba(255,255,255,0.18)",
  w25:  "rgba(255,255,255,0.25)",
  w45:  "rgba(255,255,255,0.45)",
  w55:  "rgba(255,255,255,0.55)",
  w65:  "rgba(255,255,255,0.65)",
  w70:  "rgba(255,255,255,0.70)",
  w80:  "rgba(255,255,255,0.80)",
  w90:  "rgba(255,255,255,0.90)",
  w92:  "rgba(255,255,255,0.92)",
  w95:  "rgba(255,255,255,0.95)",
} as const;

/** Profile-specific accent colours without theme palette tokens. */
export const PROFILE = {
  loyaltyPurple: "#9333EA",  // purple-600 — loyalty accent
  loyaltyViolet: "#7C3AED",  // violet-600 — loyalty gradient start
  wishlistRed:   "#E11D48",  // rose-600   — wishlist gradient
  whatsappGreen: "#25D366",  // WhatsApp brand green
  shadowDark:    "#000000",  // pure black — icon shadow wrapper
} as const;

// ─── StyleSheet ───────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  // ── Hero (logged in) ──
  hero: {
    paddingHorizontal: 20,
    paddingBottom:     58,
    overflow:          "hidden",
  },
  // Richer layered geometry — four orbs of varying scale/opacity + a stripe
  // heroDecor1: larger (220) with stronger teal opacity for more bloom presence
  heroDecor1: {
    position:        "absolute",
    right:           -60,
    top:             -60,
    width:           220,
    height:          220,
    borderRadius:    110,
    backgroundColor: "rgba(13,184,168,0.09)",
  },
  heroDecor2: {
    position:        "absolute",
    left:            -50,
    bottom:          -60,
    width:           180,
    height:          180,
    borderRadius:    90,
    backgroundColor: HERO_GLASS.w025,
  },
  // heroDecor3: slightly larger (80×80) for better visual balance
  heroDecor3: {
    position:        "absolute",
    right:           70,
    top:             50,
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: "rgba(13,184,168,0.06)",
  },
  // heroDecor4: new — subtle light orb on the opposite corner for depth
  heroDecor4: {
    position:        "absolute",
    left:            30,
    top:             80,
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  // Diagonal stripe — subtle scan line across the hero
  heroDecorStripe: {
    position:        "absolute",
    top:             -20,
    left:            -120,
    right:           -120,
    height:          1.5,
    backgroundColor: HERO_GLASS.w04,
    transform:       [{ rotate: "-8deg" }],
  },
  heroTopBar: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   22,
  },
  heroPageLabelNew: {
    color: HERO_GLASS.w55,
  },
  heroIconBtn: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: HERO_GLASS.w10,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     HERO_GLASS.w12,
    position:        "relative",
  },
  heroIconBadge: {
    position:          "absolute",
    top:               -4,
    // Use end instead of left so the badge sits at the logical end of the
    // icon tile — physical right in LTR, physical left in RTL.
    end:               -4,
    minWidth:          18,
    height:            18,
    paddingHorizontal: theme.spacing.xs,
    borderRadius:      9,
    backgroundColor:   theme.colors.error.base,
    borderWidth:       2,
    borderColor:       theme.colors.hero,
    alignItems:        "center",
    justifyContent:    "center",
  },
  heroIconBadgeText: {
    color:              theme.colors.surface,
    fontSize:           10,
    lineHeight:         12,
    fontFamily:         theme.fonts.extrabold,
    includeFontPadding: false,
  },

  // ── Avatar + identity — asymmetric horizontal layout ──
  // Avatar floats to the logical start edge; name / email / tier chip stack
  // vertically in the identity column beside it. More editorial than the old
  // centered-column approach.
  heroIdentity: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           16,
    paddingHorizontal: 4,
  },
  heroIdentityCol: {
    flex: 1,
    gap:  6,
  },
  avatarContainer: { position: "relative" },
  // avatarGlow: larger borderRadius (35) and higher opacity (0.75) for
  // a stronger tier-colour halo effect around the avatar.
  avatarGlow: {
    position:     "absolute",
    top:          -4,
    left:         -4,
    right:        -4,
    bottom:       -4,
    borderRadius: 35,
    opacity:      0.75,
  },
  // avatarRing: subtle white hairline ring outside the glow for premium depth.
  // Rendered as the first child in avatarContainer (behind the glow).
  avatarRing: {
    position:     "absolute",
    top:          -6,
    left:         -6,
    right:        -6,
    bottom:       -6,
    borderRadius: 37,
    borderWidth:  1,
    borderColor:  "rgba(255,255,255,0.12)",
  },
  // avatar: 90×90 (was 88) for a slightly stronger identity presence
  avatar: {
    width:           90,
    height:          90,
    borderRadius:    30,
    backgroundColor: theme.colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     3,
    borderColor:     HERO_GLASS.w25,
  },
  // avatarLetter: 38px (was 36) — bolder initials
  avatarLetter: {
    fontSize:           38,
    fontFamily:         theme.fonts.black,
    color:              theme.colors.heroMid,
    includeFontPadding: false,
    textAlignVertical:  "center",
    lineHeight:         46,
  },
  heroTextGroup: { alignItems: "flex-start", gap: theme.spacing.xs },
  userNameNew:   { letterSpacing: -0.4 },

  // ── Guest hero ──
  guestHero: {
    paddingHorizontal: theme.layout.pagePaddingH,  // 20 — consistent with auth hero
    paddingBottom:     44,
    alignItems:        "center",
    gap:               20,
    overflow:          "hidden",
  },
  guestAvatar: {
    width:           78,
    height:          78,
    borderRadius:    26,
    backgroundColor: HERO_GLASS.w10,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     HERO_GLASS.w15,
    marginBottom:    theme.spacing.xs,
  },
  guestTitleNew: {
    letterSpacing: -0.4,
    marginTop:     theme.spacing.sm,
  },
  guestDescNew: {
    lineHeight: 20,
    maxWidth:   320,
  },
  guestActions: {
    width:     "100%",
    marginTop: theme.spacing.lg,
    gap:       9,
  },
  guestPrimaryBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      "center",
    ...theme.shadow.md,
  },
  guestSecondaryBtn: {
    backgroundColor: HERO_GLASS.w10,
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      "center",
    borderWidth:     1,
    borderColor:     HERO_GLASS.w18,
  },

  // ── Stats card — premium lifted surface, hairline dividers ──
  // marginTop: -40 (was -36) — deeper overlap for a more dramatic hero emergence.
  // borderRadius: 24, paddingVertical: 22 — more generous, premium proportions.
  statsCard: {
    flexDirection:     flexRow(isRtl()),
    backgroundColor:   theme.colors.surface,
    marginHorizontal:  theme.layout.pagePaddingH,
    marginTop:         -40,
    borderRadius:      24,
    paddingVertical:   22,
    paddingHorizontal: theme.spacing.xs,
    ...theme.shadow.xl,
    shadowOpacity:     0.12,
    borderWidth:       1,
    borderColor:       theme.colors.border.hairline,
  },
  statCol: {
    flex:       1,
    alignItems: "center",
    gap:        6,
  },
  // statIconWrap: 40×40 (was 38), borderRadius 13 (was 12) — more spacious
  statIconWrap: {
    width:          40,
    height:         40,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   2,
    borderWidth:    1,
  },
  statDivider: {
    width:           StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.default,
    marginVertical:  10,
  },
  // letterSpacing: -0.4 (was -0.3) — tighter for premium numerals
  statValueNew: { letterSpacing: -0.4 },

  // ── Quick last-order card ──
  quickCardWrap: {
    paddingHorizontal: theme.layout.pagePaddingH,  // 20 — matches section bounds
    marginTop:         14,
  },
  quickCard: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius:    16,
    padding:         14,
    ...theme.shadow.card,
  },
  quickCardIcon: {
    width:           42,
    height:          42,
    borderRadius:    13,
    backgroundColor: theme.colors.brand.lighter,
    borderWidth:     1,
    borderColor:     theme.colors.border.brandSoft,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },
  quickCardSubNew: {
    marginTop:     2,
    textTransform: "none" as const,
    letterSpacing: 0,
  },
  statusDot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: theme.colors.success.base,
  },

  // ── Quick action grid ──
  // quickGridItem: borderRadius 20, paddingVertical 22, heavier shadow
  quickGrid: {
    flexDirection:     flexRow(isRtl()),
    gap:               10,
    paddingHorizontal: theme.layout.pagePaddingH,
    marginTop:         20,
  },
  quickGridItem: {
    flex:              1,
    backgroundColor:   theme.colors.surface,
    borderRadius:      20,
    paddingVertical:   22,
    paddingHorizontal: theme.spacing.sm,
    alignItems:        "center",
    gap:               12,
    shadowColor:       theme.colors.hero,
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.10,
    shadowRadius:      14,
    elevation:         5,
    borderWidth:       1,
    borderColor:       theme.colors.border.hairline,
  },
  quickGridIconShadow: {
    borderRadius:  20,
    shadowColor:   PROFILE.shadowDark,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius:  10,
    elevation:     5,
  },
  // quickGridIconWrap: 60×60 (was 58), borderRadius 20 (was 18)
  quickGridIconWrap: {
    width:          60,
    height:         60,
    borderRadius:   20,
    alignItems:     "center",
    justifyContent: "center",
    overflow:       "hidden",
  },
  // quickGridShine: slightly less opacity (0.15 vs 0.18), height 44% (was 48%)
  quickGridShine: {
    position:             "absolute",
    top:                  0,
    left:                 0,
    right:                0,
    height:               "44%",
    backgroundColor:      "rgba(255,255,255,0.15)",
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: theme.layout.pagePaddingH,  // 20 — forces whole group to pagePaddingH bounds
    marginTop:         theme.spacing['2xl'],        // 24
    gap:               10,
  },
  sectionLabelNew: {
    marginBottom: theme.spacing.xs,
  },

  // ── Menu card — pure white surface for premium iOS Settings look ──
  menuCard: {
    backgroundColor: theme.colors.surface,   // white card on bg background
    borderRadius:    16,
    overflow:        "hidden",
    ...theme.shadow.sm,
  },

  // ── Menu row ──
  // "row" + RTL system flag = icon on logical right, chevron on logical left.
  // "row-reverse" was causing double-reversal (RTL flip + row-reverse = LTR),
  // which destroyed the visual hierarchy.
  menuRow: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical:   16,           // was 15 — strict 16px spec
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.hairline,
  },
  menuIcon: {
    width:          40,
    height:         40,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
  },
  menuTextWrap: {
    flex: 1,
    gap:  2,
  },
  menuSubtitleNew: {
    marginTop:     2,
    textTransform: "none" as const,
    letterSpacing: 0,
  },
  badge: {
    minWidth:          24,
    height:            24,
    borderRadius:      12,
    backgroundColor:   theme.colors.brand.lighter,
    borderWidth:       1,
    borderColor:       theme.colors.border.brandSoft,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: theme.spacing.sm,
  },

  // ── Footer ──
  footer: {
    alignItems:    "center",
    marginTop:     theme.spacing[4],
    gap:           6,
    paddingBottom: theme.spacing.md,
  },
  footerBrand: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   theme.colors.brand.lighter,
    borderRadius:      999,
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       theme.colors.border.brandSoft,
  },
  footerVersionNew: {
    marginTop: theme.spacing.xs,
  },
});
