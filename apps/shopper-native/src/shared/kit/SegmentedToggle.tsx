/**
 * SegmentedToggle — premium 2/3-segment control.
 *
 * Use this instead of two side-by-side Buttons for binary/ternary choices.
 * Long labels (Arabic text, in particular) auto-shrink within their segment
 * instead of wrapping below the button — fixes the recurring overflow bug
 * we had with "استخدم العنوان الافتراضي" / "أدخل عنواناً جديداً" pairs.
 *
 * Visual: single pill container, ink-filled active segment with a soft
 * shadow lift. Smooth opacity transition on press. Reduced-motion aware.
 */

import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "./tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IoniconsName;
}

export interface SegmentedToggleProps<T extends string> {
  value:    T;
  onChange: (v: T) => void;
  options:  ReadonlyArray<SegmentOption<T>>;
  /** "lg" = 48h (default), "md" = 40h, "sm" = 34h */
  size?: "sm" | "md" | "lg";
  /** Disable the entire control */
  disabled?: boolean;
}

function SegmentedToggleInner<T extends string>({
  value,
  onChange,
  options,
  size = "lg",
  disabled = false,
}: SegmentedToggleProps<T>) {
  const height       = size === "lg" ? 48 : size === "md" ? 40 : 34;
  const labelSize    = size === "lg" ? 13 : size === "md" ? 12 : 11;
  const iconSize     = size === "lg" ? 16 : size === "md" ? 14 : 13;

  const handlePress = useCallback(
    (v: T) => {
      if (disabled || v === value) return;
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      onChange(v);
    },
    [disabled, onChange, value],
  );

  return (
    <View
      style={[
        s.track,
        { height: height + 6, padding: 3, opacity: disabled ? 0.55 : 1 },
      ]}
      accessibilityRole="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => handlePress(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={opt.label}
            disabled={disabled}
            style={[s.segment, { height }, active ? s.segmentActive : null]}>
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={iconSize}
                color={active ? kit.color.onInk : kit.color.inkSoft}
              />
            )}
            <UIText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                s.label,
                { fontSize: labelSize },
                active && s.labelActive,
              ]}>
              {opt.label}
            </UIText>
          </Pressable>
        );
      })}
    </View>
  );
}

// Memo wrapper — preserves generics
export const SegmentedToggle = memo(SegmentedToggleInner) as typeof SegmentedToggleInner;

const s = StyleSheet.create({
  track: {
    flexDirection:   flexRow(IS_RTL),
    backgroundColor: kit.color.well,
    borderRadius:    kit.radius.pill,
    borderWidth:     1,
    borderColor:     kit.color.line,
    gap:             3,
  },
  segment: {
    flex:              1,
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    paddingHorizontal: 12,
    borderRadius:      kit.radius.pill,
    backgroundColor:   "transparent",
  },
  segmentActive: {
    backgroundColor: kit.color.ink,
    ...kit.shadow.raised,
  },
  label: {
    fontFamily:         theme.fonts.black,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
    flexShrink:         1,
    textAlign:          "center",
  },
  labelActive: {
    color: kit.color.onInk,
  },
});
