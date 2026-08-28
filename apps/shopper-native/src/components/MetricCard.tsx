import React, { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Text as UIText, Card, useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export default function MetricCard({ label, value, icon, compact, inverse, accent, style }: { label: string; value: React.ReactNode; icon?: React.ReactNode; compact?: boolean; inverse?: boolean; accent?: string; style?: Record<string, unknown> }) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const wrapStyle: StyleProp<ViewStyle> = [s.wrap, compact && s.compact, inverse && s.inverse, style];
  const valueStyle: StyleProp<TextStyle> = [s.value, accent ? { color: accent } : undefined, inverse && { color: '#fff' }];
  return (
    <Card style={wrapStyle} elevation="sm">
      <View style={s.inner}>
        <View style={[s.icon, compact && s.iconCompact]}>{icon}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UIText variant="caption" numberOfLines={1} style={inverse ? { color: "rgba(255,255,255,0.72)" } : undefined} color={inverse ? undefined : "secondary"}>{label}</UIText>
          <UIText variant="card-title" numberOfLines={1} style={valueStyle}>{value}</UIText>
        </View>
      </View>
    </Card>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    wrap: { padding: 12, borderRadius: 12, backgroundColor: theme.colors.canvas.surface },
    compact: { padding: 8 },
    inverse: { backgroundColor: theme.colors.pharmacy.navy },
    inner: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
    icon: { width: 44, height: 44, borderRadius: 10, backgroundColor: theme.colors.canvas.surfaceMuted, alignItems: "center", justifyContent: "center" },
    iconCompact: { width: 32, height: 32, borderRadius: 8 },
    value: { marginTop: 4, fontFamily: legacyTheme.fonts.black },
  });
}
