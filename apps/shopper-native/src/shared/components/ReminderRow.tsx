/**
 * ReminderRow — single medication-reminder line. VIP 2026.
 *
 * Renders check-circle, drug name (strike-through when taken), dose note,
 * scheduled time, and optional "Take" / "Snooze" actions. All copy Arabic.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
import { Button } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

export interface Reminder {
  id:             string;
  prescriptionId: string;
  name:           string;
  doseNote?:      string;
  time:           string;
  due:            "Today" | "Tomorrow" | "Upcoming";
  taken:          boolean;
  takenAt?:       string;
}

export interface ReminderRowProps {
  reminder:    Reminder;
  onToggle?:   (id: string, taken: boolean) => void;
  onSnooze?:   (id: string) => void;
  showAction?: boolean;
}

const IS_RTL = isRtl();

export function ReminderRow({
  reminder: r,
  onToggle,
  onSnooze,
  showAction = true,
}: ReminderRowProps): React.ReactElement {
  const { t }  = useTranslation();
  const toggle = (): void => onToggle?.(r.id, !r.taken);

  return (
    <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>

      {/* Check circle */}
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: r.taken }}
        accessibilityLabel={
          r.taken
            ? t("reminder.accessTaken",    { name: r.name })
            : t("reminder.accessNotTaken", { name: r.name })
        }>
        <View style={[s.circle, r.taken && s.circleChecked]}>
          {r.taken && <Ionicons name="checkmark" size={13} color={theme.colors.text.inverse} />}
        </View>
      </Pressable>

      {/* Text block */}
      <View style={s.textBlock}>
        <Text
          variant="body"
          weight="bold"
          numberOfLines={1}
          align="right"
          style={[
            s.drugName,
            r.taken && s.drugNameTaken,
          ]}>
          {r.name}
        </Text>

        {r.doseNote && (
          <Text
            variant="caption"
            numberOfLines={1}
            align="right"
            style={s.doseNote}>
            {r.doseNote}
          </Text>
        )}

        <Text
          numberOfLines={1}
          align="right"
          style={[s.time, r.taken && { color: theme.colors.text.muted }]}>
          {r.time}
        </Text>
      </View>

      {/* Actions */}
      {showAction && !r.taken && (
        <View style={[s.actions, { flexDirection: flexRow(IS_RTL) }]}>
          {onSnooze && (
            <Button
              size="sm"
              variant="secondary"
              label={t("reminder.snooze")}
              onPress={() => onSnooze(r.id)}
            />
          )}
          <Button
            size="sm"
            variant="primary"
            label={t("reminder.markTaken")}
            onPress={toggle}
          />
        </View>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  row: {
    alignItems:        "center",
    gap:               12,
    paddingVertical:   14,
    paddingHorizontal: 16,
  },

  // Check circle
  circle: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderWidth:     2,
    borderColor:     theme.colors.border.strong,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  circleChecked: {
    backgroundColor: theme.colors.status.success,
    borderColor:     theme.colors.status.success,
  },

  // Text
  textBlock: {
    flex:     1,
    minWidth: 0,
  },
  drugName: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              theme.colors.text.primary,
    includeFontPadding: false,
  },
  drugNameTaken: {
    textDecorationLine: "line-through",
    color:              theme.colors.text.muted,
  },
  doseNote: {
    fontFamily:         legacyTheme.fonts.regular,
    fontSize:           12,
    lineHeight:         17,
    color:              theme.colors.text.secondary,
    marginTop:          2,
    includeFontPadding: false,
  },
  time: {
    fontFamily:         legacyTheme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              theme.colors.brand.primary,
    marginTop:          3,
    letterSpacing:      0.3,
    includeFontPadding: false,
  },

  actions: {
    gap:       6,
    flexShrink: 0,
  },
});
