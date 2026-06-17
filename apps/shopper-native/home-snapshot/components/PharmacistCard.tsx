/**
 * PharmacistCard — 2026 rebuild on the @/shared/kit design language.
 */

import React, { memo, useEffect } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, useReducedMotion, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "../shared/ui/Text";
import { theme } from "../shared/theme";
import { isRtl, textAlignStart, FORWARD_CHEVRON } from "../utils/layout";
import { useAppLanguage } from "../i18n/LanguageProvider";
import { PressableScale } from "../shared/motion/PressableScale";
import { kit } from "../shared/kit";

const WA_NUMBER = "201112343212";
const TEXT_START = textAlignStart(isRtl());

function getWaUrl(lang: string): string {
  const msg =
    lang === "en"
      ? "Hello, I need help with a specific medicine or order."
      : "مرحباً، أحتاج مساعدة بخصوص دواء أو طلب معين.";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export const PharmacistCard = memo(function PharmacistCard() {
  const { t }        = useTranslation();
  const { language } = useAppLanguage();
  const reduced      = useReducedMotion();

  const pulseScale = useSharedValue(1);
  const pulseOp    = useSharedValue(0.7);

  useEffect(() => {
    if (reduced) return;
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 900 }),
        withTiming(1.0, { duration: 700 }),
      ),
      -1,
      false,
    );
    pulseOp.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 900 }),
        withTiming(0.7, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [pulseScale, pulseOp, reduced]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }], opacity: pulseOp.value }));

  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Linking.openURL(getWaUrl(language)).catch(() => {});
  };

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <View style={s.heroRow}>
          <View style={s.textStack}>
            <View style={s.availableRow}>
              {!reduced && <Animated.View style={[s.pulseDot, pulseStyle]} />}
              <View style={s.solidDot} />
              <UIText style={s.availableText}>{t("home.pharmacistAvailable")}</UIText>
            </View>

            <UIText style={s.eyebrow}>{t("home.pharmacistCard")}</UIText>
            <UIText style={s.title}>{t("home.needAdvice")}</UIText>
            <UIText style={s.sub}>{t("home.pharmacistReply")}</UIText>
          </View>

          <View style={s.heroBadge}>
            <View style={s.heroBadgeInner}>
              <Ionicons name="medkit-outline" size={26} color={kit.color.accentDeep} />
            </View>
            <UIText style={s.heroBadgeText}>24/7</UIText>
          </View>
        </View>

        <View style={s.infoRail}>
          <View style={s.infoPill}>
            <Ionicons name="time-outline" size={13} color={kit.color.inkSoft} />
            <UIText style={s.infoLabel}>رد سريع</UIText>
          </View>
          <View style={s.infoPill}>
            <Ionicons name="shield-checkmark-outline" size={13} color={kit.color.inkSoft} />
            <UIText style={s.infoLabel}>دعم موثوق</UIText>
          </View>
        </View>

        <PressableScale
          onPress={handlePress}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={t("home.chatWhatsapp")}
          style={s.ctaBtn}>
          <View style={s.ctaIconWrap}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          </View>
          <View style={s.ctaCopy}>
            <UIText style={s.ctaLabel}>{t("home.chatWhatsapp")}</UIText>
            <UIText style={s.ctaSubLabel}>ابدأ المحادثة الآن</UIText>
          </View>
          <Ionicons name={FORWARD_CHEVRON} size={17} color="rgba(255,255,255,0.7)" />
        </PressableScale>

      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing["3xl"], paddingBottom: theme.spacing.lg },
  card: { backgroundColor: kit.color.surface, borderRadius: kit.radius.card, borderWidth: 1, borderColor: kit.color.line, padding: kit.sp(5), gap: kit.sp(4), ...kit.shadow.raised },
  heroRow: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  availableRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4, alignSelf: "flex-end" },
  pulseDot: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: kit.color.success, opacity: 0.5 },
  solidDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: kit.color.success },
  availableText: { fontFamily: theme.fonts.bold, fontSize: 11, lineHeight: 16, color: kit.color.success, includeFontPadding: false },
  textStack: { gap: 4, flex: 1 },
  eyebrow: { fontFamily: theme.fonts.bold, fontSize: 11, lineHeight: 16, color: kit.color.accentDeep, textAlign: TEXT_START, includeFontPadding: false },
  title: { fontFamily: theme.fonts.black, fontSize: kit.type.title.fontSize, lineHeight: kit.type.title.lineHeight, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
  sub: { fontFamily: theme.fonts.regular, fontSize: 12, lineHeight: 19, color: kit.color.inkSoft, textAlign: TEXT_START, includeFontPadding: false },
  heroBadge: { alignItems: "center", gap: 6 },
  heroBadgeInner: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint },
  heroBadgeText: { fontFamily: theme.fonts.black, fontSize: 11, lineHeight: 16, color: kit.color.accentDeep, includeFontPadding: false },
  infoRail: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  infoPill: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: kit.radius.pill, backgroundColor: kit.color.well },
  infoLabel: { fontFamily: theme.fonts.bold, fontSize: 11, lineHeight: 16, color: kit.color.inkSoft, includeFontPadding: false },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: kit.color.ink, borderRadius: kit.radius.pill, paddingHorizontal: 10, paddingVertical: 8, ...kit.shadow.raised },
  ctaIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.surface },
  ctaCopy: { flex: 1, gap: 1 },
  ctaLabel: { fontFamily: theme.fonts.black, fontSize: 13, lineHeight: 19, color: kit.color.onInk, textAlign: TEXT_START, includeFontPadding: false },
  ctaSubLabel: { fontFamily: theme.fonts.semibold, fontSize: 10, lineHeight: 15, color: "rgba(255,255,255,0.65)", textAlign: TEXT_START, includeFontPadding: false },
});
