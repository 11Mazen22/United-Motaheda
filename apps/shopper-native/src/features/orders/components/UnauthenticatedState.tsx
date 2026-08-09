/**
 * UnauthenticatedState — kit light rebuild.
 *
 * Light editorial sign-in gate (the dark gradient hero is gone): back
 * icon-button row, accent-tinted bag tile, ink title + sub, then a white
 * action card with kit Buttons (primary sign-in / secondary create),
 * semantic feature rows, and a privacy note.
 */

import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { kit, Button } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

// ─── Feature rows — kit semantic tints ────────────────────────────────────────

const FEATURES = [
  {
    icon:     "location-outline"      as const,
    labelKey: "orders.featureTrack",
    color:    kit.color.success,
    bg:       kit.color.successTint,
  },
  {
    icon:     "notifications-outline" as const,
    labelKey: "orders.featureAlerts",
    color:    kit.color.warn,
    bg:       kit.color.warnTint,
  },
  {
    icon:     "reload-outline"        as const,
    labelKey: "orders.featureReorder",
    color:    kit.color.accentDeep,
    bg:       kit.color.accentTint,
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function UnauthenticatedState({ showBack }: { showBack: boolean }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const handleSignIn = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(auth)/login");
  };
  const handleCreate = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(auth)/register");
  };

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        bounces>

        {/* ── Light hero ── */}
        <View style={[s.hero, { paddingTop: insets.top + 16 }]}>
          {/* Top bar — back button + eyebrow label */}
          <View style={s.topBar}>
            {showBack ? (
              <Pressable
                onPress={() => router.back()}
                style={s.backBtn}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}>
                <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
              </Pressable>
            ) : (
              <View style={s.backBtnSpacer} />
            )}
            <UIText style={s.pageEyebrow}>{t("orders.eyebrow")}</UIText>
            <View style={s.headerIconTile}>
              <Ionicons name="bag-handle-outline" size={17} color={kit.color.accentDeep} />
            </View>
          </View>

          {/* Bag tile */}
          <Animated.View entering={FadeInUp.duration(420).delay(60)}>
            <View style={s.iconTile}>
              <Ionicons name="bag-outline" size={42} color={kit.color.accentDeep} />
            </View>
          </Animated.View>

          {/* Hero text */}
          <Animated.View entering={FadeInUp.duration(400).delay(140)} style={s.heroText}>
            <UIText style={s.heroTitle}>{t("orders.authTitle")}</UIText>
            <UIText style={s.heroSub}>{t("orders.authSub")}</UIText>
          </Animated.View>
        </View>

        {/* ── Action card ── */}
        <Animated.View entering={FadeInDown.duration(380).delay(180)} style={s.card}>
          <Button
            label={t("auth.signIn")}
            icon="log-in-outline"
            size="lg"
            full
            onPress={handleSignIn}
          />
          <Button
            label={t("auth.createAccount")}
            variant="secondary"
            size="lg"
            full
            onPress={handleCreate}
          />

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <UIText style={s.dividerText}>{t("auth.or")}</UIText>
            <View style={s.dividerLine} />
          </View>

          {/* Feature rows */}
          {FEATURES.map((feat) => (
            <View key={feat.labelKey} style={s.feature}>
              <View style={[s.featureIcon, { backgroundColor: feat.bg }]}>
                <Ionicons name={feat.icon} size={15} color={feat.color} />
              </View>
              <UIText style={s.featureLabel}>{t(feat.labelKey)}</UIText>
            </View>
          ))}

          {/* Privacy note */}
          <View style={s.privacyRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={kit.color.inkFaint} />
            <UIText style={s.privacyText}>{t("orders.privacyNote")}</UIText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  hero: {
    alignItems:        "center",
    paddingBottom:     kit.sp(8),
    paddingHorizontal: theme.layout.pagePaddingH,
    gap:               theme.spacing[3],
  },

  topBar: {
    width:          "100%",
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   theme.spacing[3],
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
  backBtnSpacer: { width: 40, height: 40 },
  pageEyebrow: {
    fontSize: 13, lineHeight: 19,
    fontFamily: theme.fonts.black,
    color: kit.color.ink,
    includeFontPadding: false,
  },
  headerIconTile: {
    width:           40,
    height:          40,
    borderRadius:    14,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },

  iconTile: {
    width:           88,
    height:          88,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.accentTint,
  },

  heroText:  { alignItems: "center", gap: theme.spacing.sm },
  heroTitle: {
    fontFamily: theme.fonts.black,
    fontSize: kit.type.title.fontSize,
    lineHeight: kit.type.title.lineHeight,
    color: kit.color.ink,
    textAlign: "center",
    includeFontPadding: false,
  },
  heroSub: {
    fontFamily: theme.fonts.regular,
    fontSize: 13, lineHeight: 20,
    color: kit.color.inkSoft,
    maxWidth: 280,
    textAlign: "center",
    includeFontPadding: false,
  },

  card: {
    marginHorizontal:  theme.spacing.lg,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.sheet - 4,
    paddingVertical:   theme.spacing.xl,
    paddingHorizontal: theme.layout.pagePaddingH,
    gap:               theme.spacing.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },

  divider: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           theme.spacing.md,
  },
  dividerLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.lineStrong,
  },
  dividerText: {
    fontFamily: theme.fonts.regular,
    fontSize: 12, lineHeight: 18,
    color: kit.color.inkFaint,
    includeFontPadding: false,
  },

  feature: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           theme.spacing.md,
  },
  featureIcon: {
    width:          34,
    height:         34,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
  },
  featureLabel: {
    flex:       1,
    fontFamily: theme.fonts.semibold,
    fontSize: 13, lineHeight: 20,
    color: kit.color.ink,
    textAlign: textAlignStart(isRtl()),
    includeFontPadding: false,
  },

  privacyRow: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "center",
    gap:            5,
  },
  privacyText: {
    fontFamily: theme.fonts.regular,
    fontSize: 11, lineHeight: 16,
    color: kit.color.inkFaint,
    includeFontPadding: false,
  },
});
