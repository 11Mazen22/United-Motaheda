import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme, kit } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const { theme } = useTheme();
  const rtl = isRtl();

  return (
    <View style={[s.container, { flexDirection: flexRow(rtl) }]}>
      <View style={s.textContainer}>
        <Text variant="section-head" style={{ color: kit.color.text.primary, textAlign: textAlignStart(rtl) }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="body-sm" style={{ color: kit.color.text.secondary, textAlign: textAlignStart(rtl), marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {action && (
        <TouchableOpacity 
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={s.actionButton}
        >
          <Text variant="label" style={{ color: kit.color.accent }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: kit.sp(2),
  },
  textContainer: {
    flex: 1,
  },
  actionButton: {
    padding: kit.sp(1),
  }
});
