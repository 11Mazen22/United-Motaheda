/**
 * SocialButtons — "Continue with Google" button.
 *
 * Redesign (2026 visual pass):
 *   • Fixed the floating "G" bug — the icon now sits inside a tinted well
 *     with explicit background, border, and dimensions.
 *   • Button itself now declares borderColor (was missing — caused the
 *     button outline to disappear on some platforms).
 *   • Icon + label form a tightly-grouped leading cluster, centered as a
 *     unit. No more `spacer` hack to balance the row — RN's `alignItems:
 *     center` + `justifyContent: center` does it cleanly.
 *   • Stronger press feedback (scale + accent-tint background).
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { isRtl, flexRow } from "@/utils/layout";

export type SocialProvider = "google";

interface Props {
  onSocialPress: (provider: SocialProvider) => void;
  loading?: boolean;
}

const IS_RTL = isRtl();

// Google brand red — used only for the G mark inside the icon well.
const GOOGLE_RED = "#EA4335";

export function SocialButtons({ onSocialPress, loading = false }: Props) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.duration(320)}>
      <Pressable
        onPress={() => !loading && onSocialPress("google")}
        disabled={loading}
        style={({ pressed }) => [
          s.btn,
          pressed && s.btnPressed,
          loading && { opacity: 0.72 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading, busy: loading }}
        accessibilityLabel={t("auth.continueWithGoogle")}>
        <View style={[s.iconWell, IS_RTL ? { marginStart: 12 } : { marginEnd: 12 }]}>
          {loading ? (
            <ActivityIndicator size="small" color={GOOGLE_RED} />
          ) : (
            <Ionicons name="logo-google" size={18} color={GOOGLE_RED} />
          )}
        </View>
        <UIText weight="bold" style={s.label} numberOfLines={1}>
          {loading ? t("common.loading") : t("auth.continueWithGoogle")}
        </UIText>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Row container — icon + label centered as a single cluster.
  btn: {
    ...kit.shadow.raised,
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    minHeight:         52,
    paddingHorizontal: 16,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.surface,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  btnPressed: {
    backgroundColor: kit.color.well,
    transform:       [{ scale: 0.99 }],
  },

  // Icon well with explicit Google-brand surface so the G is never naked.
  iconWell: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: "rgba(234,67,53,0.08)",
    borderWidth:     1,
    borderColor:     "rgba(234,67,53,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },

  label: {
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    letterSpacing:      -0.1,
    includeFontPadding: false,
    flexShrink:         1,
  },
});
