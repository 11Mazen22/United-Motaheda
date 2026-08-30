/**
 * SocialButtons — "Continue with Google" button.
 *
 * Uses PressableScale (not raw Pressable) — a raw `Pressable` whose `style`
 * prop is the `({pressed}) => [...]` function form was silently dropping
 * `flexDirection: "row"` on this RN/Fabric version: icon and label measured
 * and laid out as a column (confirmed via uiautomator bounds — both
 * children spanned the same full width, stacked top/bottom) despite the
 * style object clearly requesting a centered row. PressableScale applies a
 * static `[style, animatedStyle]` array instead, which is the same pattern
 * every other working row-shaped button in this design system uses
 * (Button, Chip) — and it renders correctly.
 */

import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PressableScale, Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";

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
    <PressableScale
      onPress={() => !loading && onSocialPress("google")}
      disabled={loading}
      scaleTo={0.99}
      style={[s.btn, loading && { opacity: 0.72 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      accessibilityLabel={t("auth.continueWithGoogle")}>
      <View style={s.iconWell}>
        {loading ? (
          <ActivityIndicator size="small" color={GOOGLE_RED} />
        ) : (
          <GoogleIcon size={18} />
        )}
      </View>
      <UIText weight="bold" style={s.label} numberOfLines={1}>
        {loading ? t("common.loading") : t("auth.continueWithGoogle")}
      </UIText>
    </PressableScale>
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
      gap:               12,
      minHeight:         52,
      paddingHorizontal: 16,
      borderRadius:      12,
      backgroundColor:   theme.colors.canvas.surface,
      borderWidth:       1,
      borderColor:       theme.colors.border.default,
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
