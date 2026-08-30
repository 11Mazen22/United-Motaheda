/**
 * HomeSectionHeader — icon tile + eyebrow/title + "view all" affordance.
 * Theme-driven throughout (useTheme()) so it reads correctly in both light
 * and dark; accepts an optional accent color for persona/category tinting.
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { PressableScale, Text as UIText, useTheme } from "@pharmacy/ui-native";
import { isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { shStyles } from "./home.styles";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export interface HomeSectionHeaderProps {
  eyebrow?: string;
  title: string;
  icon: IoniconsName;
  /** Defaults to the brand color when omitted. */
  accent?: string;
  onMore?: () => void;
  /** Custom right-side widget (e.g. flash-sale countdown) */
  rightSlot?: React.ReactNode;
}

export const HomeSectionHeader = memo(function HomeSectionHeader({
  eyebrow,
  title,
  icon,
  accent,
  onMore,
  rightSlot,
}: HomeSectionHeaderProps) {
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const { theme } = useTheme();
  const tone = accent ?? theme.colors.brand.primary;

  const tint = `${tone}1A`;
  const tintMid = `${tone}26`;

  return (
    <View style={[shStyles.row, { paddingHorizontal: pagePad, minHeight: 44 }]}>
      <View style={shStyles.start}>
        <LinearGradient
          colors={[tintMid, tint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[shStyles.icon, { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: `${tone}22` }]}
        >
          <Ionicons name={icon} size={18} color={tone} />
        </LinearGradient>

        <View style={{ flexShrink: 1, gap: 2, minWidth: 0 }}>
          {eyebrow ? (
            <UIText
              weight="bold"
              numberOfLines={1}
              style={[styles.eyebrow, { color: tone, textAlign: TEXT_START }]}
            >
              {eyebrow}
            </UIText>
          ) : null}
          <UIText variant="h4" numberOfLines={1} style={[shStyles.title, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>
            {title}
          </UIText>
        </View>
      </View>

      <View style={{ flexShrink: 0, marginStart: 12 }}>
        {rightSlot ?? (onMore ? (
          <PressableScale
            onPress={onMore}
            scaleTo={0.94}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("home.viewAll")}
            style={[
              shStyles.moreBtn,
              { borderRadius: 9999, backgroundColor: tint, borderWidth: 1, borderColor: `${tone}20` },
            ]}
          >
            <UIText variant="caption" style={{ color: tone }}>{t("home.viewAll")}</UIText>
            <Ionicons name={FORWARD_CHEVRON} size={12} color={tone} />
          </PressableScale>
        ) : null)}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
