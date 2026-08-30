/**
 * SavingsStrip — trust strip (bottom of home): a 2×2 grid of icon+label
 * cells in an elevated card. Theme-driven; variety comes from icon choice
 * only (not arbitrary per-cell hex), consistent with the design language's
 * restraint principle.
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface TrustCell {
  icon: IoniconsName;
  labelKey: string;
}

const TRUST_CELLS: TrustCell[] = [
  { icon: "shield-checkmark", labelKey: "home.savingsLine1" },
  { icon: "headset", labelKey: "home.savingsLine2" },
  { icon: "ribbon", labelKey: "home.savingsLine3" },
  { icon: "cube-outline", labelKey: "home.savingsLine4" },
];

export const SavingsStrip = memo(function SavingsStrip() {
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const { theme } = useTheme();

  return (
    <View style={[s.wrap, { marginHorizontal: pagePad, backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1]]}>
      <View style={s.eyebrowRow}>
        <View style={[s.eyebrowDot, { backgroundColor: `${theme.colors.brand.primary}40` }]} />
        <UIText weight="extrabold" style={[styles.eyebrow, { color: theme.colors.brand.primary }]}>{t("home.savingsPromise")}</UIText>
        <View style={[s.eyebrowDot, { backgroundColor: `${theme.colors.brand.primary}40` }]} />
      </View>

      <View style={s.grid}>
        {TRUST_CELLS.map((cell) => (
          <View key={cell.labelKey} style={s.cell}>
            <View style={[s.iconWrap, { backgroundColor: theme.colors.brand.primaryLight }]}>
              <Ionicons name={cell.icon} size={18} color={theme.colors.brand.primary} />
            </View>
            <UIText variant="caption" style={{ flex: 1, color: theme.colors.text.secondary, textAlign: TEXT_START }} numberOfLines={2}>
              {t(cell.labelKey)}
            </UIText>
          </View>
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: {
    marginTop: 24,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  eyebrowDot: { width: 24, height: 1.5, borderRadius: 1 },
  grid: { flexDirection: flexRow(IS_RTL), flexWrap: "wrap", rowGap: 16 },
  cell: { width: "50%", flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, paddingEnd: 8 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
});
