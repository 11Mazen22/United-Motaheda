/**
 * SavingsStrip — Tier-3 supporting trust band.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ ✓ Genuine medicines      ✓ 30-min delivery   │
 *   │ ✓ Licensed pharmacists   ✓ Cold-chain logistics│
 *   └───────────────────────────────────────────────┘
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TRUST_ICONS: IoniconsName[] = ["shield-checkmark", "flash", "ribbon", "snow"];
const TRUST_KEYS = ["home.savingsLine1", "home.savingsLine2", "home.savingsLine3", "home.savingsLine4"] as const;

export const SavingsStrip = memo(function SavingsStrip() {
  const { t } = useTranslation();
  return (
    <View style={s.wrap}>
      <View style={s.eyebrowRow}>
        <Ionicons name="leaf-outline" size={12} color={kit.color.accentDeep} />
        <UIText style={s.eyebrow}>{t("home.savingsPromise")}</UIText>
      </View>

      <View style={s.grid}>
        {TRUST_KEYS.map((key, i) => (
          <View key={key} style={s.cell}>
            <View style={s.iconWrap}>
              <Ionicons name={TRUST_ICONS[i]} size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={s.label} numberOfLines={1}>{t(key)}</UIText>
          </View>
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: {
    marginHorizontal:  theme.layout.pagePaddingH,
    marginTop:         kit.sp(4),
    marginBottom:      kit.sp(2),
    backgroundColor:   kit.color.canvas,
    borderRadius:      kit.radius.lg,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       kit.color.line,
    paddingHorizontal: kit.sp(4),
    paddingVertical:   kit.sp(4),
    gap:               kit.sp(3),
  },
  eyebrowRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           6,
  },
  eyebrow: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      1.2,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  grid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    rowGap:        10,
  },
  cell: {
    width:         "50%",
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
    paddingEnd:    8,
  },
  iconWrap: {
    width:           24,
    height:          24,
    borderRadius:    8,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
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
