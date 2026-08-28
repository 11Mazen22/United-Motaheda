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

import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { isRtl, flexRow } from "@/utils/layout";
import { GoogleIcon } from "./GoogleIcon";

export type SocialProvider = "google";

interface Props {
  onSocialPress: (provider: SocialProvider) => void;
  loading?: boolean;
}

const IS_RTL = isRtl();

// Google brand red — used only for the loading spinner inside the icon well.
const GOOGLE_RED = "#EA4335";

export function SocialButtons({ onSocialPress, loading = false }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
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
            <GoogleIcon size={18} />
          )}
        </View>
        <UIText weight="bold" style={s.label} numberOfLines={1}>
          {loading ? t("common.loading") : t("auth.continueWithGoogle")}
        </UIText>
      </Pressable>
    </Animated.View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    // Row container — icon + label centered as a single cluster.
    btn: {
      ...theme.shadows[1],
      flexDirection:     flexRow(IS_RTL),
      alignItems:        "center",
      justifyContent:    "center",
      minHeight:         52,
      paddingHorizontal: 16,
      borderRadius:      12,
      backgroundColor:   theme.colors.canvas.surface,
      borderWidth:       1,
      borderColor:       theme.colors.border.default,
    },
    btnPressed: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      transform:       [{ scale: 0.99 }],
    },

    // Icon well — neutral surface so the real four-color "G" mark reads
    // correctly (a red-tinted well made sense for the old monochrome-red
    // glyph, not for the actual brand mark).
    iconWell: {
      width:           34,
      height:          34,
      borderRadius:    10,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      alignItems:      "center",
      justifyContent:  "center",
      flexShrink:      0,
    },

    label: {
      fontSize:           14,
      lineHeight:         20,
      color:              theme.colors.text.primary,
      letterSpacing:      -0.1,
      includeFontPadding: false,
      flexShrink:         1,
    },
  });
}
