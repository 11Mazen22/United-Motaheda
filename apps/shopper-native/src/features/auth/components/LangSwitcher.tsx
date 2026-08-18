/**
 * LangSwitcher — one-tap language toggle (AR ↔ EN).
 *
 * Calls setAppLanguage() which persists the choice, sets forceRTL, and
 * reloads the app. Shows a spinner while the reload is in flight.
 */

import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { setAppLanguage, type AppLanguage } from "@/i18n";

export function LangSwitcher() {
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
        <ActivityIndicator size="small" color={kit.color.accentDeep} />
      ) : (
        <View style={s.inner}>
          <UIText style={s.flag}>{isAr ? "🇺🇸" : "🇸🇦"}</UIText>
          <UIText style={s.label}>{isAr ? "English" : "العربية"}</UIText>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    height:          36,
    paddingHorizontal: 12,
    borderRadius:    kit.radius.pill,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
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
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
});
