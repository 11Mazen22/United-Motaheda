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
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { kit, Button } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

// ─── Feature rows — kit semantic tints ────────────────────────────────────────

const FEATURES = [
  {
    icon:     "location-outline"      as const,
    labelKey: "orders.featureTrack",
    color:    theme.colors.status.success,
    bg:       `${theme.colors.status.success}1A`,
  },
  {
    icon:     "notifications-outline" as const,
    labelKey: "orders.featureAlerts",
    color:    theme.colors.status.warning,
    bg:       `${theme.colors.status.warning}1A`,
  },
  {
    icon:     "reload-outline"        as const,
    labelKey: "orders.featureReorder",
    color:    theme.colors.brand.primary,
    bg:       theme.colors.brand.primaryLight,
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
                <Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} />
              </Pressable>
            ) : (
              <View style={s.backBtnSpacer} />
            )}
            <UIText style={s.pageEyebrow}>{t("orders.eyebrow")}</UIText>
            <View style={s.headerIconTile}>
              <Ionicons name="bag-handle-outline" size={17} color={theme.colors.brand.primary} />
            </View>
          </View>

          {/* Bag tile */}
          <Animated.View entering={FadeInUp.duration(420).delay(60)}>
            <View style={s.iconTile}>
              <Ionicons name="bag-outline" size={42} color={theme.colors.brand.primary} />
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
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.text.muted} />
            <UIText style={s.privacyText}>{t("orders.privacyNote")}</UIText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  hero: {
    alignItems:        "center",
    paddingBottom:     32,
    paddingHorizontal: legacyTheme.layout.pagePaddingH,
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
    backgroundColor: theme.colors.canvas.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
  },
  backBtnSpacer: { width: 40, height: 40 },
  pageEyebrow: {
    fontSize: 13, lineHeight: 19,
    fontFamily: legacyTheme.fonts.black,
    color: theme.colors.text.primary,
    includeFontPadding: false,
  },
  headerIconTile: {
    width:           40,
    height:          40,
    borderRadius:    14,
    backgroundColor: theme.colors.brand.primaryLight,
    alignItems:      "center",
    justifyContent:  "center",
  },

  iconTile: {
    width:           88,
    height:          88,
    borderRadius:    28,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: theme.colors.brand.primaryLight,
  },

  heroText:  { alignItems: "center", gap: legacyTheme.spacing.sm },
  heroTitle: {
    fontFamily: legacyTheme.fonts.black,
    fontSize: kit.type.title.fontSize,
    lineHeight: kit.type.title.lineHeight,
    color: theme.colors.text.primary,
    textAlign: "center",
    includeFontPadding: false,
  },
  heroSub: {
    fontFamily: legacyTheme.fonts.regular,
    fontSize: 13, lineHeight: 20,
    color: theme.colors.text.secondary,
    maxWidth: 280,
    textAlign: "center",
    includeFontPadding: false,
  },

  card: {
    marginHorizontal:  legacyTheme.spacing.lg,
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      20 - 4,
    paddingVertical:   legacyTheme.spacing.xl,
    paddingHorizontal: legacyTheme.layout.pagePaddingH,
    gap:               legacyTheme.spacing.lg,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    ...theme.shadows[1],
  },

  divider: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           legacyTheme.spacing.md,
  },
  dividerLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.strong,
  },
  dividerText: {
    fontFamily: legacyTheme.fonts.regular,
    fontSize: 12, lineHeight: 18,
    color: theme.colors.text.muted,
    includeFontPadding: false,
  },

  feature: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           legacyTheme.spacing.md,
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
    fontFamily: legacyTheme.fonts.semibold,
    fontSize: 13, lineHeight: 20,
    color: theme.colors.text.primary,
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
    fontFamily: legacyTheme.fonts.regular,
    fontSize: 11, lineHeight: 16,
    color: theme.colors.text.muted,
    includeFontPadding: false,
  },
});
