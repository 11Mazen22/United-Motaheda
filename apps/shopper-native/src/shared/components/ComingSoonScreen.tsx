/**
 * ComingSoonScreen — minimal placeholder for route stubs.
 *
 * Used while a real screen is still on the roadmap (e.g., prescription
 * detail lands later in §7; refill flow on Day 10). Renders the AppHeader,
 * an icon, a title, an optional subtitle, and a "قريباً" eyebrow so it's
 * obvious to dev + QA that the page isn't real yet.
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AppHeader } from "./AppHeader";
import { Text, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

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
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();

  return (
    <View style={styles.screen}>
      <AppHeader title={title} showBack />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={theme.colors.brand.primary} />
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

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.canvas.background,
    },
    body: {
      flex:           1,
      alignItems:     "center",
      justifyContent: "center",
      padding:        legacyTheme.layout.pagePaddingH,
      gap:            6,
    },
    iconWrap: {
      width:           72,
      height:          72,
      borderRadius:    theme.radii["2xl"],
      backgroundColor: theme.colors.brand.primaryLight,
      alignItems:      "center",
      justifyContent:  "center",
      marginBottom:    theme.spacing[1],
    },
  });
}
