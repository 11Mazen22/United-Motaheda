/** Google sign-in button. Calls onSocialPress("google") on tap. */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { isRtl, flexRow } from "@/utils/layout";

export type SocialProvider = "google";

interface Props {
  onSocialPress: (provider: SocialProvider) => void;
  loading?: boolean;
}

const IS_RTL = isRtl();

export function SocialButtons({ onSocialPress, loading = false }: Props) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.duration(320)}>
      <Pressable
        onPress={() => !loading && onSocialPress("google")}
        disabled={loading}
        style={({ pressed }) => [s.btn, { opacity: pressed || loading ? 0.72 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={t("auth.continueWithGoogle")}>
        <View style={s.iconWell}>
          {loading ? (
            <ActivityIndicator size="small" color="#EA4335" />
          ) : (
            <Ionicons name="logo-google" size={18} color="#EA4335" />
          )}
        </View>
        <UIText style={s.label}>
          {loading ? t("common.loading") : t("auth.continueWithGoogle")}
        </UIText>
        <View style={s.spacer} />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    height:          50,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    backgroundColor: kit.color.surface,
    paddingHorizontal: 14,
    gap:             12,
    ...kit.shadow.raised,
  },

  iconWell: {
    width:           32,
    height:          32,
    borderRadius:    9,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },

  label: {
    flex:               1,
    fontFamily:         theme.fonts.bold,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },

  spacer: { width: 32, flexShrink: 0 },
});
