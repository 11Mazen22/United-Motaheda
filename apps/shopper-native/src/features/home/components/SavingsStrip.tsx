/**
 * SavingsStrip — 2026 Premium Redesign.
 *
 * Matches the reference image trust-strip section (bottom of home):
 *   • 4-cell grid in a white rounded card
 *   • Each cell: tinted icon badge + bold label
 *   • Light teal tint background
 *   • Cells: دفع آمن وحماية تامة / دعم فني على مدار الساعة /
 *             منتجات أصلية مضمونة 100% / أكثر من 35,000 منتج
 *
 * Full RTL support.
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface TrustCell {
  icon:    IoniconsName;
  labelKey: string;
  bg:      string;
  fg:      string;
}

const TRUST_CELLS: TrustCell[] = [
  {
    icon:     "shield-checkmark",
    labelKey: "home.savingsLine1",
    bg:       kit.color.accentTint,
    fg:       kit.color.accentDeep,
  },
  {
    icon:     "headset",
    labelKey: "home.savingsLine2",
    bg:       "#EFF6FF",
    fg:       "#2563EB",
  },
  {
    icon:     "ribbon",
    labelKey: "home.savingsLine3",
    bg:       "#ECFDF5",
    fg:       "#059669",
  },
  {
    icon:     "cube-outline",
    labelKey: "home.savingsLine4",
    bg:       "#FFF7ED",
    fg:       "#EA580C",
  },
];

export const SavingsStrip = memo(function SavingsStrip() {
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  return (
    <View style={[s.wrap, { marginHorizontal: pagePad }]}>
      {/* Eyebrow header */}
      <View style={s.eyebrowRow}>
        <View style={s.eyebrowDot} />
        <UIText style={s.eyebrow}>{t("home.savingsPromise")}</UIText>
        <View style={s.eyebrowDot} />
      </View>

      {/* 2×2 grid */}
      <View style={s.grid}>
        {TRUST_CELLS.map((cell) => (
          <View key={cell.labelKey} style={s.cell}>
            <View style={[s.iconWrap, { backgroundColor: cell.bg }]}>
              <Ionicons name={cell.icon} size={18} color={cell.fg} />
            </View>
            <UIText style={s.label} numberOfLines={2}>
              {t(cell.labelKey)}
            </UIText>
          </View>
        ))}
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: {
    marginTop:       24,
    marginBottom:    8,
    backgroundColor: "#FFFFFF",
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     "rgba(15,23,42,0.06)",
    paddingHorizontal: 20,
    paddingVertical:   20,
    gap:             16,
    shadowColor:     "#0C2240",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },

  eyebrowRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
  },
  eyebrowDot: {
    width:           24,
    height:          1.5,
    backgroundColor: kit.color.accentDeep + "40",
    borderRadius:    1,
  },
  eyebrow: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    letterSpacing:      1.4,
    textTransform:      "uppercase",
    textAlign:          "center",
    includeFontPadding: false,
  },

  grid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    gap:           0,
    rowGap:        16,
  },
  cell: {
    width:         "50%",
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           12,
    paddingEnd:    8,
  },
  iconWrap: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  label: {
    flex:               1,
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
});
