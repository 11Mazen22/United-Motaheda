/**
 * SavingsStrip — Tier-3 supporting trust band.
 *
 * Replaces the old 4-cell TrustStrip with a single-line ranked statement.
 * Flat (no shadow), hairline border only, so it sits visually quieter than
 * any hero/primary card on the page. Used as the closing reassurance just
 * before the PharmacistCard.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ ✓ Genuine medicines      ✓ 30-min delivery   │
 *   │ ✓ Licensed pharmacists   ✓ Cold-chain logistics│
 *   └───────────────────────────────────────────────┘
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TRUST_LINES: Array<{ icon: IoniconsName; ar: string; en: string }> = [
  { icon: "shield-checkmark", ar: "أدوية أصلية ١٠٠٪",     en: "Genuine medicines"     },
  { icon: "flash",            ar: "توصيل في ٣٠ دقيقة",    en: "30-min delivery"       },
  { icon: "ribbon",           ar: "صيادلة معتمدون",       en: "Licensed pharmacists"  },
  { icon: "snow",             ar: "شحن مبرّد للأدوية",    en: "Cold-chain logistics"  },
];

export const SavingsStrip = memo(function SavingsStrip() {
  return (
    <View style={s.wrap}>
      <View style={s.eyebrowRow}>
        <Ionicons name="leaf-outline" size={12} color={kit.color.accentDeep} />
        <UIText style={s.eyebrow}>
          {IS_RTL ? "وعدنا لك" : "Our promise"}
        </UIText>
      </View>

      <View style={s.grid}>
        {TRUST_LINES.map((line, i) => (
          <View key={i} style={s.cell}>
            <View style={s.iconWrap}>
              <Ionicons name={line.icon} size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={s.label} numberOfLines={1}>
              {IS_RTL ? line.ar : line.en}
            </UIText>
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
