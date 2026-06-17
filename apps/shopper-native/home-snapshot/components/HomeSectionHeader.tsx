/**
 * HomeSectionHeader — 2026 rebuild on the @/shared/kit design language.
 */
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "../shared/ui/Text";
import { theme } from "../shared/theme";
import { shStyles as base } from "./home.styles";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "../utils/layout";
import { kit } from "../shared/kit";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export interface HomeSectionHeaderProps {
  eyebrow?:   string;
  title:      string;
  icon:       IoniconsName;
  accent?:    string;
  onMore?:    () => void;
  rightSlot?: React.ReactNode;
}

export const HomeSectionHeader = memo(function HomeSectionHeader({
  eyebrow, title, icon,
  accent    = kit.color.accentDeep,
  onMore,
  rightSlot,
}: HomeSectionHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={base.row}>
      <View style={base.left}>
        <View style={[sh.iconTile, { backgroundColor: accent + "14" }]}> 
          <Ionicons name={icon} size={17} color={accent} />
        </View>

        <View style={sh.textStack}>
          {eyebrow && <UIText style={sh.eyebrow}>{eyebrow}</UIText>}
          <UIText style={sh.title}>{title}</UIText>
        </View>
      </View>

      {rightSlot ?? (onMore && (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("home.viewAll")} style={sh.more}>
          <UIText style={sh.moreText}>{t("home.viewAll")}</UIText>
          <Ionicons name={FORWARD_CHEVRON} size={13} color={kit.color.inkSoft} />
        </Pressable>
      ))}
    </View>
  );
});

const sh = StyleSheet.create({
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  textStack: { gap: 1 },
  eyebrow: { fontFamily: theme.fonts.bold, fontSize: 10, lineHeight: 15, color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false },
  title: { fontFamily: theme.fonts.black, fontSize: 19, lineHeight: 27, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
  more: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 4 },
  moreText: { fontFamily: theme.fonts.bold, fontSize: 12, lineHeight: 18, color: kit.color.inkSoft, includeFontPadding: false },
});
