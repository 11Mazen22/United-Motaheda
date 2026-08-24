/**
 * EarningsCard — replaces the orphaned EarningsSummary.tsx. Same 3-tile
 * layout (earnings / completed / acceptance rate), but sourcing real data:
 * earnings from DriverEarning (not order.total, which was the customer's
 * full order price), acceptance rate from real accept/decline counts, i18n
 * throughout.
 */
import React, { useEffect, useMemo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { formatPrice } from "@/utils/format";
import type { DriverEarningRecord } from "../api";

interface Props {
  earnings: DriverEarningRecord[];
  completedCount: number;
  acceptanceRate: number | undefined;
}

export default function EarningsCard({ earnings, completedCount, acceptanceRate }: Props): React.ReactElement {
  const { t } = useTranslation();
  const totalEarnings = useMemo(() => earnings.reduce((sum, e) => sum + e.totalAmount, 0), [earnings]);

  const scale = useMemo(() => new Animated.Value(0.95), []);
  useEffect(() => { Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 10 }).start(); }, [scale, totalEarnings]);

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale }] }]}>
      <View style={s.tile}>
        <UIText style={s.value}>{formatPrice(totalEarnings)}</UIText>
        <UIText style={s.label}>{t("driver.todayEarnings")}</UIText>
      </View>
      <View style={s.tile}>
        <UIText style={s.value}>{completedCount}</UIText>
        <UIText style={s.label}>{t("driver.completed")}</UIText>
      </View>
      <View style={s.tile}>
        <UIText style={s.value}>{acceptanceRate ?? "—"}{typeof acceptanceRate === "number" ? "%" : ""}</UIText>
        <UIText style={s.label}>{t("driver.acceptanceRate")}</UIText>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 12, alignItems: "center" },
  tile: { alignItems: "center", flex: 1 },
  value: { fontSize: 16, color: "#fff", fontFamily: "Cairo_900Black" },
  label: { fontSize: 11, color: "rgba(255,255,255,0.9)", marginTop: 2 },
});
