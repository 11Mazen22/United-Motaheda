/**
 * LangSwitcher — one-tap language toggle (AR ↔ EN).
 *
 * Calls setAppLanguage() which persists the choice, sets forceRTL, and
 * reloads the app. Shows a spinner while the reload is in flight.
 */

import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { setAppLanguage, type AppLanguage } from "@/i18n";

export function LangSwitcher() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  const isAr = i18n.language === "ar";

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const next: AppLanguage = isAr ? "en" : "ar";
    await setAppLanguage(next);
    // App will reload; setLoading(false) only reached if reload fails
    setLoading(false);
  };

  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      disabled={loading}
      style={s.btn}
      accessibilityRole="button"
      accessibilityLabel={isAr ? "Switch to English" : "التبديل إلى العربية"}>
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.brand.primary} />
      ) : (
        <View style={s.inner}>
          <UIText style={s.flag}>{isAr ? "🇺🇸" : "🇸🇦"}</UIText>
          <UIText style={s.label}>{isAr ? "English" : "العربية"}</UIText>
        </View>
      )}
    </Pressable>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    btn: {
      height:          36,
      paddingHorizontal: 12,
      borderRadius:    9999,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      alignItems:      "center",
      justifyContent:  "center",
      minWidth:        36,
    },
    inner: {
      flexDirection: "row",
      alignItems:    "center",
      gap:           5,
    },
    flag: {
      fontSize:           14,
      lineHeight:         18,
      includeFontPadding: false,
    },
    label: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           12,
      lineHeight:         16,
      color:              theme.colors.text.secondary,
      includeFontPadding: false,
    },
  });
}
