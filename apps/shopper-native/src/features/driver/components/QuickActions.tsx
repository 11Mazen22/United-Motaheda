import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

interface Props {
  onNavigate: () => void;
  onCall: () => void;
  onReportIssue: () => void;
  onViewEarnings: () => void;
  theme: NativeTheme;
}

const ACTIONS = [
  { key: "navigate", icon: "navigate-outline", label: "Navigate", onPress: (_p: Props) => _p.onNavigate },
  { key: "call", icon: "call-outline", label: "Call", onPress: (_p: Props) => _p.onCall },
  { key: "report", icon: "warning-outline", label: "Report Issue", onPress: (_p: Props) => _p.onReportIssue },
  { key: "earnings", icon: "cash-outline", label: "Earnings", onPress: (_p: Props) => _p.onViewEarnings },
] as const;

export function QuickActions({ onNavigate, onCall, onReportIssue, onViewEarnings, theme }: Props): React.ReactElement {
  const pagePad = kit.inset.screen;

  const s = useMemo(() => StyleSheet.create({
    row: { flexDirection: flexRow(IS_RTL), paddingHorizontal: pagePad, gap: 12, marginTop: 16 },
    tile: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: theme.colors.canvas.surface, gap: 8, ...theme.shadows[1] },
    iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primaryLight },
    label: { fontSize: 11, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.secondary, textAlign: "center" as const },
  }), [theme, pagePad]);

  return (
    <View style={s.row}>
      {ACTIONS.map((action) => (
        <Pressable key={action.key} onPress={() => action.onPress({ onNavigate, onCall, onReportIssue, onViewEarnings, theme })} style={s.tile} accessibilityRole="button" accessibilityLabel={action.label}>
          <View style={s.iconWrap}>
            <Ionicons name={action.icon as any} size={20} color={theme.colors.brand.primary} />
          </View>
          <UIText variant="caption" color="secondary" style={s.label}>{action.label}</UIText>
        </Pressable>
      ))}
    </View>
  );
}

export default QuickActions;
