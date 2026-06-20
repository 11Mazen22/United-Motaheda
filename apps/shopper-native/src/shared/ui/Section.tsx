/**
 * Section — labelled content block with optional icon and trailing action.
 *
 * Replaces the recurring header-row + body pattern:
 *
 *   <View>
 *     <View style={sectionHead}>
 *       <View style={sectionIcon}><Ionicons name={icon} /></View>
 *       <UIText style={sectionTitle}>{title}</UIText>
 *       <Pressable onPress={action}>...</Pressable>
 *     </View>
 *     <View style={sectionBody}>{children}</View>
 *   </View>
 *
 * found in checkout, notifications, preferences screens.
 */

import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text as UIText } from "./Text";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/shared/theme";
import { flexRow, isRtl } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface SectionProps {
  title: string;
  icon?: IoniconsName;
  children: React.ReactNode;
  /** Trailing action (e.g. an "Edit" button). */
  action?: { label: string; onPress: () => void };
  /** Style for the outer wrapper. */
  style?: StyleProp<ViewStyle>;
  /** Tint the section title icon. */
  iconColor?: string;
  /** Tint the section icon background. */
  iconBg?: string;
}

export function Section({
  title,
  icon,
  children,
  action,
  style,
  iconColor = theme.colors.brand[600],
  iconBg = theme.colors.brand[50],
}: SectionProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <View style={styles.titleWrap}>
          {icon && (
            <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={13} color={iconColor} />
            </View>
          )}
          <UIText style={styles.title}>{title}</UIText>
        </View>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={6}>
            <UIText style={styles.action}>{action.label}</UIText>
          </Pressable>
        )}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 8 },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: theme.fonts.black,
    color: theme.colors.text.primary,
  },
  action: {
    fontSize: 11,
    fontFamily: theme.fonts.bold,
    color: theme.colors.brand[600],
  },
  body: { gap: 10 },
});
