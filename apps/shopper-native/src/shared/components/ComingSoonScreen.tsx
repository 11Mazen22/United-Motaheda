/**
 * ComingSoonScreen — minimal placeholder for route stubs.
 *
 * Used while a real screen is still on the roadmap (e.g., prescription
 * detail lands later in §7; refill flow on Day 10). Renders the AppHeader,
 * an icon, a title, an optional subtitle, and a "قريباً" eyebrow so it's
 * obvious to dev + QA that the page isn't real yet.
 */

import { kit } from "@pharmacy/ui-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AppHeader } from "./AppHeader";
import { Text } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";

export interface ComingSoonScreenProps {
  title:     string;
  subtitle?: string;
  icon?:     React.ComponentProps<typeof Ionicons>["name"];
}

export function ComingSoonScreen({
  title,
  subtitle,
  icon = "construct-outline",
}: ComingSoonScreenProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <AppHeader title={title} showBack />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={kit.color.accent.base} />
        </View>
        <Text variant="eyebrow" color="brand">{t("common.comingSoon")}</Text>
        <Text variant="sheet-title" align="center">{title}</Text>
        {subtitle && (
          <Text variant="body" color="secondary" align="center">
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: kit.color.canvas,
  },
  body: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    padding:        theme.layout.pagePaddingH,
    gap:            theme.spacing[1.5],
  },
  iconWrap: {
    width:           72,
    height:          72,
    borderRadius:    theme.radius["2xl"],
    backgroundColor: kit.color.accent.lighter,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    theme.spacing[1],
  },
});
