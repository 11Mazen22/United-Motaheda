/**
 * AuthDivider — "or" horizontal rule used between social login and email form.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";

export function AuthDivider() {
  const { t } = useTranslation();
  return (
    <View style={s.row}>
      <View style={s.line} />
      <UIText style={s.text}>{t("auth.or")}</UIText>
      <View style={s.line} />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  line: {
    flex:            1,
    height:          1,
    backgroundColor: kit.color.line,
  },
  text: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
});
