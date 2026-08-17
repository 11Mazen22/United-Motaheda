/**
 * StatCard — KPI tile for the pharmacist dashboard.
 * Displays a large metric number, a label, an optional trend, and an icon.
 */
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit }            from "@pharmacy/ui-native";
import { theme }          from "@pharmacy/design-tokens";

interface StatCardProps {
  value:     number | string;
  label:     string;
  icon:      React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  iconBg?:   string;
  accent?:   string;
  trend?:    number; // positive -> up, negative -> down
  onPress?:  () => void;
  style?:    StyleProp<ViewStyle>;
}

export function StatCard({
  value,
  label,
  icon,
  iconColor = kit.color.accentDeep,
  iconBg    = kit.color.accentTint,
  accent,
  trend,
  onPress,
  style,
}: StatCardProps) {
  const inner = (
    <>
      <View style={[s.iconWell, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <UIText style={[s.value, accent ? { color: accent } : undefined]}>{value}</UIText>
      {typeof trend === "number" && (
        <View style={s.trendRow}>
          <Ionicons
            name={trend >= 0 ? "caret-up" : "caret-down"}
            size={12}
            color={trend >= 0 ? kit.color.success : kit.color.danger}
          />
          <UIText style={[s.trendText, { color: trend >= 0 ? kit.color.success : kit.color.danger }]}>
            {" "}{Math.abs(trend)}%
          </UIText>
        </View>
      )}
      <UIText variant="caption" color="secondary" style={s.label}>{label}</UIText>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.card, pressed && s.cardPressed, style]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={[s.card, style]}>{inner}</View>;
}
const s = StyleSheet.create({
  card: {
    flex:              1,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.xl,
    padding:           14,
    gap:               6,
    ...kit.shadow.card,
    borderWidth:       1,
    borderColor:       kit.color.line,
    minWidth:          100,
  },
  cardPressed: {
    opacity:   0.85,
    transform: [{ scale: 0.98 }],
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendText: {
    fontSize: 12,
    fontFamily: theme.fonts.bold,
  },
  iconWell: {
    width:           36,
    height:          36,
    borderRadius:    12,
    alignItems:      "center",
    justifyContent:  "center",
  },
  value: {
    fontSize:   22,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
    lineHeight: 28,
  },
  label: {
    lineHeight: 16,
  },
});
