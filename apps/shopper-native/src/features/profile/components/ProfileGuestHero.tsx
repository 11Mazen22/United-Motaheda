/**
 * ProfileGuestHero — premium sign-up header for unauthenticated users.
 *
 * Redesign (2026): the previous version was a generic centred stack with a flat
 * benefits list and an under-emphasised CTA. This version establishes a clear
 * vertical hierarchy and rhythm:
 *
 *   brand badge  →  welcome title + sub  →  PRIMARY "Create account" CTA
 *                →  secondary "Sign in"  →  benefits card (titled, scannable)
 *
 * Design intent
 *   • Conversion-first: "Create account" is the prominent gradient CTA; "Sign
 *     in" is a quieter glass button beneath it.
 *   • Trust: a branded app mark (not a generic person glyph) with a soft halo.
 *   • Scannability: benefits live in a titled glass card, each a coloured icon
 *     tile + a single readable line — consistent spacing, strong hierarchy.
 *   • Deliberate spacing rhythm via per-block margins (not one uniform gap).
 *
 * RTL: every row uses flexRow + logical start alignment; centred blocks read
 * identically in both directions. Accessibility: CTAs are PressableScale
 * (reduced-motion aware, full a11y), entrances respect OS Reduce Motion, and
 * every touch target clears 48px.
 */
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { kit } from "@/shared/kit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInUp, ReduceMotion } from "react-native-reanimated";
import { Text as UIText } from "@/shared/ui";
import { AppLogo } from "@/shared/components/AppLogo";
import { PressableScale } from "@/shared/motion";
import { theme } from "@/shared/theme";
import { HERO_GLASS } from "./profile.styles";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL = isRtl();
const START  = textAlignStart(IS_RTL);

interface ProfileGuestHeroProps {
  insetsTop: number;
}

// What the user unlocks by creating an account.
const BENEFITS: { icon: IoniconsName; labelKey: string; tint: string; bg: string }[] = [
  { icon: "bag-check-outline", labelKey: "profile.featureOrders",   tint: theme.colors.teal[300],   bg: "rgba(13,184,168,0.16)" },
  { icon: "diamond-outline",   labelKey: "profile.featureLoyalty",  tint: theme.colors.purple[400], bg: "rgba(147,51,234,0.16)" },
  { icon: "heart-outline",     labelKey: "profile.featureWishlist", tint: theme.colors.rose[400],   bg: "rgba(244,63,94,0.16)"  },
];

// Staggered entrance helper — respects OS reduce-motion.
const enter = (delay: number) =>
  FadeInUp.duration(420).delay(delay).springify().damping(20).stiffness(220).reduceMotion(ReduceMotion.System);

export const ProfileGuestHero = memo(function ProfileGuestHero({ insetsTop }: ProfileGuestHeroProps) {
  const router = useRouter();
  const { t }  = useTranslation();

  return (
    <View style={[s.hero, { backgroundColor: kit.color.ink, paddingTop: insetsTop + 28 }]}>

      {/* Ambient decor */}
      <View style={s.decorA} pointerEvents="none" />
      <View style={s.decorB} pointerEvents="none" />

      {/* ── Brand badge ── */}
      <Animated.View entering={enter(40)} style={s.badgeWrap}>
        <View style={s.badgeGlow} pointerEvents="none" />
        <View style={s.badge}>
          <AppLogo size="md" />
        </View>
      </Animated.View>

      {/* ── Welcome copy ── */}
      <Animated.View entering={enter(110)} style={s.copy}>
        <UIText variant="sheet-title" color="inverse" align="center" style={s.title}>
          {t("profile.guestTitle")}
        </UIText>
        <UIText variant="body-sm" color="inverse-muted" align="center" style={s.desc}>
          {t("profile.guestDesc")}
        </UIText>
      </Animated.View>

      {/* ── CTAs ── */}
      <Animated.View entering={enter(180)} style={s.ctas}>
        {/* Primary — Create account */}
        <PressableScale
          onPress={() => router.push("/(auth)/register")}
          scaleTo={0.97}
          style={s.primary}
          accessibilityRole="button"
          accessibilityLabel={t("auth.createAccount")}>
          <View style={[s.primaryGrad, { backgroundColor: kit.color.accent }]}>
            <Ionicons name="person-add-outline" size={18} color={kit.color.onInk} />
            <UIText weight="black" style={s.primaryText}>
              {t("auth.createAccount")}
            </UIText>
          </View>
        </PressableScale>

        {/* Secondary — Sign in */}
        <PressableScale
          onPress={() => router.push("/(auth)/login")}
          scaleTo={0.97}
          style={s.secondary}
          accessibilityRole="button"
          accessibilityLabel={t("auth.login")}>
          <Ionicons name="log-in-outline" size={17} color={HERO_GLASS.w90} />
          <UIText weight="bold" style={s.secondaryText}>
            {t("auth.login")}
          </UIText>
        </PressableScale>
      </Animated.View>

      {/* ── Benefits ── */}
      <Animated.View entering={enter(250)} style={s.benefits}>
        <UIText variant="eyebrow" style={s.benefitsTitle}>
          {t("profile.guestBenefitsTitle")}
        </UIText>
        <View style={s.benefitsCard}>
          {BENEFITS.map((b, i) => (
            <View key={b.labelKey} style={[s.benefitRow, i > 0 && s.benefitDivider]}>
              <View style={[s.benefitIcon, { backgroundColor: b.bg }]}>
                <Ionicons name={b.icon} size={16} color={b.tint} />
              </View>
              <UIText variant="body-sm" weight="semibold" style={s.benefitLabel} numberOfLines={1}>
                {t(b.labelKey)}
              </UIText>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
});

const s = StyleSheet.create({
  hero: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingBottom:     30,
    alignItems:        "center",
    overflow:          "hidden",
  },

  // ── Ambient decor ──
  decorA: {
    position:        "absolute",
    top:             -70,
    right:           -60,
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: "rgba(13,184,168,0.10)",
  },
  decorB: {
    position:        "absolute",
    bottom:          -60,
    left:            -50,
    width:           170,
    height:          170,
    borderRadius:    85,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  // ── Brand badge ──
  badgeWrap: {
    alignItems:     "center",
    justifyContent: "center",
  },
  badgeGlow: {
    position:        "absolute",
    width:           104,
    height:          104,
    borderRadius:    34,
    backgroundColor: "rgba(13,184,168,0.22)",
  },
  badge: {
    width:           80,
    height:          80,
    borderRadius:    26,
    overflow:        "hidden",
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: HERO_GLASS.w10,
    borderWidth:     1,
    borderColor:     HERO_GLASS.w18,
  },

  // ── Copy ──
  copy: {
    alignItems: "center",
    gap:        7,
    marginTop:  18,
  },
  title: {
    letterSpacing: -0.5,
    lineHeight:    28,
  },
  desc: {
    lineHeight: 21,
    maxWidth:   320,
    opacity:    0.92,
  },

  // ── CTAs ──
  ctas: {
    width:     "100%",
    gap:       10,
    marginTop: 24,
  },
  primary: {
    width:        "100%",
    borderRadius: 16,
    overflow:     "hidden",
    shadowColor:  theme.colors.teal[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius:  16,
    elevation:     8,
  },
  primaryGrad: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    height:          54,
    borderRadius:    16,
  },
  primaryText: {
    color:              theme.colors.surface,
    fontSize:           15,
    letterSpacing:      0.2,
    includeFontPadding: false,
  },
  secondary: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    width:           "100%",
    height:          50,
    borderRadius:    16,
    backgroundColor: HERO_GLASS.w10,
    borderWidth:     1,
    borderColor:     HERO_GLASS.w18,
  },
  secondaryText: {
    color:              HERO_GLASS.w90,
    fontSize:           14,
    letterSpacing:      0.1,
    includeFontPadding: false,
  },

  // ── Benefits ──
  benefits: {
    width:     "100%",
    marginTop: 24,
    gap:       10,
  },
  benefitsTitle: {
    color:     HERO_GLASS.w55,
    textAlign: START,
    marginStart: 4,
  },
  benefitsCard: {
    backgroundColor:   HERO_GLASS.w10,
    borderRadius:      18,
    borderWidth:       1,
    borderColor:       HERO_GLASS.w15,
    paddingHorizontal: 14,
  },
  benefitRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           12,
    paddingVertical: 13,
  },
  benefitDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HERO_GLASS.w12,
  },
  benefitIcon: {
    width:          34,
    height:         34,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  benefitLabel: {
    flex:               1,
    color:              HERO_GLASS.w90,
    textAlign:          START,
    includeFontPadding: false,
  },
});
