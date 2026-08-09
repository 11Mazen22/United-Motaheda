/**
 * HomeSectionHeader — 2026 Premium Redesign.
 *
 * Design language:
 *   • Bold 20px black Cairo title with tight tracking
 *   • Accent-tinted gradient icon tile (12×12 radius, 44pt square)
 *   • Hairline eyebrow in uppercase, spaced, accent-colored
 *   • "View all" affordance: filled accent-tinted pill with chevron —
 *     clearly tappable but never visually dominant
 *   • RTL-aware throughout (flexRow, textAlignStart)
 *   • Accepts an optional `rightSlot` for countdown timers etc.
 */

import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export interface HomeSectionHeaderProps {
  eyebrow?:   string;
  title:      string;
  icon:       IoniconsName;
  accent?:    string;
  onMore?:    () => void;
  /** Custom right-side widget (e.g. flash-sale countdown) */
  rightSlot?: React.ReactNode;
}

export const HomeSectionHeader = memo(function HomeSectionHeader({
  eyebrow,
  title,
  icon,
  accent    = kit.color.accentDeep,
  onMore,
  rightSlot,
}: HomeSectionHeaderProps) {
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  // Derive tint from accent (14% opacity layer)
  const tint = accent + "1A"; // 10% alpha
  const tintMid = accent + "26"; // 15% alpha

  return (
    <View style={[sh.row, { paddingHorizontal: pagePad }]}>

      {/* ── Leading cluster: icon tile + text stack ── */}
      <View style={sh.leading}>

        {/* Gradient icon tile */}
        <LinearGradient
          colors={[tintMid, tint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[sh.iconTile, { borderColor: accent + "22" }]}
        >
          <Ionicons name={icon} size={18} color={accent} />
        </LinearGradient>

        {/* Text stack */}
        <View style={sh.textStack}>
          {eyebrow ? (
            <UIText
              numberOfLines={1}
              style={[sh.eyebrow, { color: accent }]}
            >
              {eyebrow}
            </UIText>
          ) : null}
          <UIText numberOfLines={1} style={sh.title}>
            {title}
          </UIText>
        </View>
      </View>

      {/* ── Trailing: custom slot OR view-all pill ── */}
      <View style={sh.trailing}>
        {rightSlot ?? (onMore ? (
          <Pressable
            onPress={onMore}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("home.viewAll")}
            style={({ pressed }) => [sh.moreBtn, pressed && sh.moreBtnPressed]}
          >
            <UIText style={[sh.moreText, { color: accent }]}>
              {t("home.viewAll")}
            </UIText>
            <Ionicons name={FORWARD_CHEVRON} size={12} color={accent} />
          </Pressable>
        ) : null)}
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  row: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    minHeight:      44,
  },

  // Leading: icon tile + text
  leading: {
    flex:          1,
    flexShrink:    1,
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           12,
    minWidth:      0,
  },

  // 44×44 gradient icon tile, bordered
  iconTile: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
    flexShrink:     0,
  },

  textStack: {
    flexShrink: 1,
    gap:        2,
    minWidth:   0,
  },

  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      1.2,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Trailing
  trailing: {
    flexShrink: 0,
    marginStart: 12,
  },

  // "View all" pill
  moreBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.accentDeep + "20",
  },
  moreBtnPressed: {
    opacity: 0.75,
  },
  moreText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         16,
    includeFontPadding: false,
  },
});
