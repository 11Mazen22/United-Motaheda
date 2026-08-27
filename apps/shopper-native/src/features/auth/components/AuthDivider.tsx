/**
 * AuthDivider — "or" horizontal rule used between social login and email form.
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";

export function AuthDivider() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  return (
    <View style={s.row}>
      <View style={s.line} />
      <UIText style={s.text}>{t("auth.or")}</UIText>
      <View style={s.line} />
    </View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems:    "center",
      gap:           10,
    },
    line: {
      flex:            1,
      height:          1,
      backgroundColor: theme.colors.border.default,
    },
    text: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           11,
      lineHeight:         16,
      color:              theme.colors.text.muted,
      letterSpacing:      0.5,
      textTransform:      "uppercase",
      includeFontPadding: false,
    },
  });
}
