import React from "react";
import { View, StyleSheet } from "react-native";
import { Text as UIText, Card } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export default function MetricCard({ label, value, icon, compact, inverse, accent, style }: { label: string; value: React.ReactNode; icon?: React.ReactNode; compact?: boolean; inverse?: boolean; accent?: string; style?: any }) {
  const wrapStyle: any = [s.wrap, compact && s.compact, inverse && s.inverse, style];
  const valueStyle: any = [s.value, accent ? { color: accent } : undefined, inverse && { color: '#fff' }];
  return (
    <Card style={wrapStyle} elevation="sm">
      <View style={s.inner}>
        <View style={[s.icon, compact && s.iconCompact]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <UIText variant="caption" color={inverse ? undefined : "secondary"}>{label}</UIText>
          <UIText variant="card-title" style={valueStyle}>{value}</UIText>
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 12, borderRadius: 12, backgroundColor: kit.color.surface },
  compact: { padding: 8 },
  inverse: { backgroundColor: kit.color.ink },
  inner: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 10, backgroundColor: kit.color.well, alignItems: "center", justifyContent: "center" },
  iconCompact: { width: 32, height: 32, borderRadius: 8 },
  value: { marginTop: 4, fontFamily: theme.fonts.black },
});
