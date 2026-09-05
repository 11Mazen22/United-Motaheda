import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, Card, useTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { WeeklyEarningsChart } from "./WeeklyEarningsChart";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface Props {
  todayEarnings: number;
  completedToday: number;
  acceptanceRate: number | null;
  activeOrders: number;
  weeklyEarnings: Array<{ date: Date; total: number }>;
  onPressEarnings: () => void;
}

export function MetricsGrid({ todayEarnings, completedToday, acceptanceRate, activeOrders, weeklyEarnings, onPressEarnings }: Props): React.ReactElement {
  const { theme } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    card: { backgroundColor: theme.colors.canvas.surface, borderRadius: 20, padding: 16, gap: 14, ...theme.shadows[1] },
    heroRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14 },
    iconWell: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primaryLight, flexShrink: 0 },
    heroLabel: { fontSize: 12, color: theme.colors.text.muted, textAlign: TEXT_START },
    heroValue: { fontSize: 26, lineHeight: 32, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, textAlign: TEXT_START, marginTop: 2 },
    secondaryRow: { flexDirection: flexRow(IS_RTL) },
    statCell: { flex: 1, minWidth: 0, alignItems: "center", gap: 4 },
    divider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginVertical: 2 },
    statValue: { fontSize: 18, lineHeight: 24, fontFamily: legacyTheme.fonts.extrabold, color: theme.colors.text.primary },
    statLabel: { fontSize: 11, lineHeight: 15, color: theme.colors.text.muted, textAlign: "center" as const },
    chartRow: { marginTop: 4, alignItems: "center" as const },
  }), [theme]);

  const acceptanceLabel = acceptanceRate !== null ? `${acceptanceRate}%` : "—";

  return (
    <Card style={s.card}>
      <Pressable onPress={onPressEarnings} accessibilityRole="button">
        <View style={s.heroRow}>
          <View style={s.iconWell}>
            <Ionicons name="cash-outline" size={24} color={theme.colors.brand.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="caption" color="muted" style={s.heroLabel}>Today's earnings</UIText>
            <UIText variant="h4" color="primary" style={s.heroValue}>{formatPrice(todayEarnings)}</UIText>
          </View>
        </View>
      </Pressable>

      <View style={[styles.dividerHorizontal, { backgroundColor: theme.colors.border.default }]} />

      <View style={s.secondaryRow}>
        <View style={s.statCell}>
          <UIText variant="h6" color="primary" style={s.statValue}>{String(completedToday)}</UIText>
          <UIText variant="caption" color="muted" style={s.statLabel}>Delivered</UIText>
        </View>
        <View style={s.divider} />
        <View style={s.statCell}>
          <UIText variant="h6" color="primary" style={s.statValue}>{acceptanceLabel}</UIText>
          <UIText variant="caption" color="muted" style={s.statLabel}>Acceptance</UIText>
        </View>
        <View style={s.divider} />
        <View style={s.statCell}>
          <UIText variant="h6" color="primary" style={s.statValue}>{String(activeOrders)}</UIText>
          <UIText variant="caption" color="muted" style={s.statLabel}>Active</UIText>
        </View>
      </View>

      <View style={s.chartRow}>
        <WeeklyEarningsChart data={weeklyEarnings} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  dividerHorizontal: { height: StyleSheet.hairlineWidth },
});

export default MetricsGrid;
