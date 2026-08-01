/**
 * StatCard — KPI tile for the pharmacist dashboard.
 * Displays a large metric number, a label, an optional trend, and an icon.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { Text as UIText } from "@/shared/ui";
import { kit }            from "@/shared/kit";
import { theme }          from "@/shared/theme";

interface StatCardProps {
  value:     number | string;
  label:     string;
  icon:      React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  iconBg?:   string;
  accent?:   string;
  onPress?:  () => void;
}

export function StatCard({
  value,
  label,
  icon,
  iconColor = kit.color.accentDeep,
  iconBg    = kit.color.accentTint,
  onPress,
}: StatCardProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        s.card,
        pressed && onPress && s.cardPressed,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={[s.iconWell, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <UIText style={s.value}>{value}</UIText>
      <UIText variant="caption" color="secondary" style={s.label}>{label}</UIText>
    </Wrapper>
  );
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
