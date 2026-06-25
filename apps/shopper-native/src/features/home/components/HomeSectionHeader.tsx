/**
 * HomeSectionHeader — 2026 rebuild on the @/shared/kit design language.
 *
 * Editorial section title bar: tinted icon tile (derived from the accent),
 * eyebrow + ink title stack, and a quiet ghost "view all" affordance
 * (text + chevron — the bordered pill is gone).
 */
import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { shStyles as base } from "./home.styles";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { kit } from "@/shared/kit";
import { useScreenLayout } from "@/utils/responsive";

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
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  return (
    <View style={[base.row, { paddingHorizontal: pagePad }]}>
      {/* Leading cluster — icon tile + text stack */}
      <View style={base.left}>
        <View style={[sh.iconTile, { backgroundColor: accent + "14" }]}>
          <Ionicons name={icon} size={17} color={accent} />
        </View>

        <View style={sh.textStack}>
          {eyebrow && <UIText style={[sh.eyebrow, { color: accent }]}>{eyebrow}</UIText>}
          <UIText style={sh.title}>{title}</UIText>
        </View>
      </View>

      {/* Trailing slot — ghost "view all" */}
      {rightSlot ?? (onMore && (
        <Pressable
          onPress={onMore}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("home.viewAll")}
          style={sh.more}>
          {/*
            `weight="bold"` forces fontFamily via the Text component's
            FONT_STYLES path. This is more reliable than passing fontFamily
            inside a style object — the weight prop bypasses variant defaults
            entirely so Cairo_700Bold cannot be lost to a stale layout pass.
          */}
          <UIText weight="bold" style={sh.moreText}>
            {t("home.viewAll")}
          </UIText>
          <Ionicons name={FORWARD_CHEVRON} size={13} color={kit.color.inkSoft} />
        </Pressable>
      ))}
    </View>
  );
});

const sh = StyleSheet.create({
  iconTile: {
    width:          42,
    height:         42,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
  },
  textStack: { gap: 1 },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    letterSpacing:      0.4,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           19,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  more: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    paddingVertical:   5,
    paddingHorizontal: 11,
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
    borderColor:       kit.color.line,
    backgroundColor:   kit.color.surface,
  },
  moreText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
});
