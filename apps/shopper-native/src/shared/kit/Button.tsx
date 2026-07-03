/**
 * kit/Button — the 2026 button system. Replaces the legacy gradient CTAs.
 *
 * Variants:
 *   primary    solid ink pill — the single strongest action on a screen
 *   secondary  accent-tinted surface — supportive actions
 *   ghost      text-only — tertiary / dismiss actions
 *   danger     danger-tinted — destructive confirmations
 *
 * Sizes: lg 54 · md 46 · sm 38. All sizes meet the 44pt touch target via
 * hitSlop on sm. Press feedback is a spring scale (reduced-motion aware via
 * PressableScale). Icons sit on the reading-start side; pass `iconEnd` to
 * trail instead.
 *
 * IconButton — 44pt circular hairline control for chrome actions (back,
 * filter, close). Use `tone="ink"` for a filled emphasis variant.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { flexRow, isRtl } from "@/utils/layout";
import { PressableScale } from "@/shared/motion";
import { kit } from "./tokens";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

const IS_RTL = isRtl();

const HEIGHTS: Record<ButtonSize, number> = { lg: 54, md: 46, sm: 38 };
const FONT:    Record<ButtonSize, number> = { lg: 15, md: 14, sm: 12 };
// Generous line-height (~1.5x font size) — Arabic Cairo glyphs at black/bold
// weight carry diacritics and descenders that clip under a tight line-height,
// especially combined with includeFontPadding:false below.
const LINE:    Record<ButtonSize, number> = { lg: 22, md: 21, sm: 18 };
const ICON:    Record<ButtonSize, number> = { lg: 18, md: 16, sm: 14 };
const PAD:     Record<ButtonSize, number> = { lg: 26, md: 20, sm: 14 };

interface ButtonColors { bg: string; fg: string; border?: string }

function colorsFor(variant: ButtonVariant, disabled: boolean): ButtonColors {
  if (disabled) return { bg: kit.color.well, fg: kit.color.inkFaint };
  switch (variant) {
    case "primary":   return { bg: kit.color.ink,        fg: kit.color.onInk };
    case "secondary": return { bg: kit.color.accentTint, fg: kit.color.accentDeep };
    case "danger":    return { bg: kit.color.dangerTint, fg: kit.color.danger };
    case "ghost":     return { bg: "transparent",        fg: kit.color.inkSoft };
  }
}

export interface ButtonProps {
  label:    string;
  onPress:  () => void;
  variant?: ButtonVariant;
  size?:    ButtonSize;
  icon?:    IoniconsName;
  /** Render the icon on the reading-end side instead of the start. */
  iconEnd?:  boolean;
  disabled?: boolean;
  /** Show a spinner and block presses while an async action runs. */
  loading?:  boolean;
  /** Stretch to the parent width. */
  full?:     boolean;
  style?:    StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  disabled,
  loading,
  full,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const off = !!disabled || !!loading;
  const c = colorsFor(variant, off);
  const iconEl = icon ? (
    <Ionicons name={icon} size={ICON[size]} color={c.fg} />
  ) : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      scaleTo={0.97}
      hitSlop={size === "sm" ? 6 : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: !!loading }}
      style={[
        styles.base,
        {
          height:            HEIGHTS[size],
          paddingHorizontal: variant === "ghost" ? 10 : PAD[size],
          backgroundColor:   c.bg,
        },
        variant === "primary" && !off && kit.shadow.raised,
        full && styles.full,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={c.fg} />
      ) : (
        <>
          {!iconEnd && iconEl}
          <UIText
            style={[
              styles.label,
              { fontSize: FONT[size], lineHeight: LINE[size], color: c.fg, fontFamily: theme.fonts.black },
            ]}
            maxFontSizeMultiplier={1.2}>
            {label}
          </UIText>
          {iconEnd && iconEl}
        </>
      )}
    </PressableScale>
  );
}

export interface IconButtonProps {
  icon:     IoniconsName;
  onPress:  () => void;
  /** "surface" = hairline circle on white; "ink" = filled emphasis. */
  tone?:     "surface" | "ink";
  size?:     number;
  disabled?: boolean;
  style?:    StyleProp<ViewStyle>;
  accessibilityLabel: string;
}

export function IconButton({
  icon,
  onPress,
  tone = "surface",
  size = 44,
  disabled,
  style,
  accessibilityLabel,
}: IconButtonProps) {
  const ink = tone === "ink";
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.92}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.iconBtn,
        {
          width:           size,
          height:          size,
          borderRadius:    size / 2,
          backgroundColor: ink ? kit.color.ink : kit.color.surface,
          borderWidth:     ink ? 0 : 1,
          borderColor:     kit.color.line,
        },
        ink && kit.shadow.raised,
        style,
      ]}>
      <Ionicons
        name={icon}
        size={Math.round(size * 0.42)}
        color={disabled ? kit.color.inkFaint : ink ? kit.color.onInk : kit.color.inkSoft}
      />
    </PressableScale>
  );
}

/** Tiny dot separator used between inline meta items. */
export function MetaDot() {
  return <View style={styles.metaDot} />;
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    borderRadius:   kit.radius.pill,
    alignSelf:      "flex-start",
  },
  full:  { alignSelf: "stretch" },
  label: { includeFontPadding: false, textAlignVertical: "center" },
  iconBtn: {
    alignItems:     "center",
    justifyContent: "center",
  },
  metaDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: kit.color.inkFaint,
  },
});
