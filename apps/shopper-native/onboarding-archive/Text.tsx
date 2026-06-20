/**
 * Text — typography atom (2026 Creative Refresh on kit V3).
 *
 * Spec: SPEC §2.4 hierarchy, now powered by the unified design system.
 * Colors & sizes come from `kit`; font families still use `theme.fonts`
 * until the V4 kit upgrade.
 *
 * Existing `variant` + `weight` + `color` API preserved exactly.
 * New `scale` prop provides a direct path to the kit‑native type scale.
 *
 *   <Text variant="hero">…</Text>
 *   <Text variant="body" color="secondary">…</Text>
 *   <Text scale="body">…</Text>                 // kit.type.body
 *   <Text scale="heading" color="brand">…</Text>
 */

import React, { useMemo } from "react";
import {
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";

export type TextVariant =
  | "display"       // 36 / black / very tight  — premium splash headlines
  | "hero"          // SPEC §2.4 — 32 / extrabold / tight
  | "screen-title"  // 24 / extrabold / tight
  | "sheet-title"   // 20 / extrabold / tight
  | "section-head"  // 18 / extrabold / normal
  | "card-title"    // 16 / bold / normal
  | "body"          // 15 / regular / normal
  | "body-sm"       // 14 / regular / normal
  | "caption"       // 12 / semibold / wide
  | "eyebrow"       // 11 / bold / widest
  | "badge"         // 11 / bold / widest
  | "metric";       // 28 / black / tight       — large numbers (price, count)

export type TextScale = keyof typeof kit.type; // "display" | "title" | "heading" | "body" | "caption" | "micro"

export type TextWeight =
  | "regular"
  | "medium"     // Cairo has no 500 — collapses to regular
  | "semibold"
  | "bold"
  | "extrabold"
  | "black";

export type TextColor =
  | "primary"
  | "secondary"
  | "muted"
  | "tertiary"
  | "disabled"
  | "inverse"
  | "inverse-muted"
  | "brand"
  | "danger"
  | "warn"
  | "success"
  | "info";

export interface TextProps extends Omit<RNTextProps, "style"> {
  variant?: TextVariant;
  weight?: TextWeight;
  scale?: TextScale;
  color?: TextColor;
  align?: TextStyle["textAlign"];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

// ── Variant specs (sizes preserved from legacy theme) ──────────────────
interface VariantSpec {
  fontSize: number;
  lineHeight: number;
  weight: TextWeight;
  letterSpacing: number;
}

const VARIANTS: Record<TextVariant, VariantSpec> = {
  display:       { fontSize: 36, lineHeight: 40, weight: "black",     letterSpacing: -1.0 },
  hero:          { fontSize: 32, lineHeight: 38, weight: "extrabold", letterSpacing: -0.5 },
  "screen-title":{ fontSize: 24, lineHeight: 30, weight: "extrabold", letterSpacing: -0.5 },
  "sheet-title": { fontSize: 20, lineHeight: 26, weight: "extrabold", letterSpacing: -0.4 },
  "section-head":{ fontSize: 18, lineHeight: 24, weight: "extrabold", letterSpacing: 0    },
  "card-title":  { fontSize: 16, lineHeight: 22, weight: "bold",      letterSpacing: 0    },
  body:          { fontSize: 15, lineHeight: 21, weight: "regular",   letterSpacing: 0    },
  "body-sm":     { fontSize: 14, lineHeight: 20, weight: "regular",   letterSpacing: 0    },
  caption:       { fontSize: 12, lineHeight: 17, weight: "semibold",  letterSpacing: 0.5  },
  eyebrow:       { fontSize: 11, lineHeight: 16, weight: "bold",      letterSpacing: 1.0  },
  badge:         { fontSize: 11, lineHeight: 16, weight: "bold",      letterSpacing: 1.0  },
  metric:        { fontSize: 28, lineHeight: 34, weight: "black",     letterSpacing: -0.5 },
};

// ── Font-family bridge: uses legacy theme.fonts (replace with kit.font once V4 lands) ──
const FONT: Record<TextWeight, string> = {
  regular:   theme.fonts.regular,
  medium:    theme.fonts.medium,
  semibold:  theme.fonts.semibold,
  bold:      theme.fonts.bold,
  extrabold: theme.fonts.extrabold,
  black:     theme.fonts.black,
};

// ── Pre‑computed StyleSheet tables ─────────────────────────────────────

// Variant + default weight combined
const _variantFull: Record<string, TextStyle> = {};
for (const [name, spec] of Object.entries(VARIANTS)) {
  _variantFull[name] = {
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    fontFamily: FONT[spec.weight],
  };
}
const VARIANT_STYLES = StyleSheet.create<Record<TextVariant, TextStyle>>(
  _variantFull as Record<TextVariant, TextStyle>,
);

// Layout‑only (size & spacing) for when weight is manually overridden
const _variantLayout: Record<string, TextStyle> = {};
for (const [name, spec] of Object.entries(VARIANTS)) {
  _variantLayout[name] = {
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
  };
}
const VARIANT_LAYOUT_STYLES = StyleSheet.create<Record<TextVariant, TextStyle>>(
  _variantLayout as Record<TextVariant, TextStyle>,
);

// Kit‑native scale presets (from kit.type)
const _scaleStylesInput: Record<string, TextStyle> = {};
for (const [scale, props] of Object.entries(kit.type)) {
  _scaleStylesInput[scale] = {
    fontSize: props.fontSize,
    lineHeight: props.lineHeight,
    fontFamily: FONT.regular, // sensible default
  };
}
const SCALE_STYLES = StyleSheet.create(_scaleStylesInput);

// Font weight overrides
const _fontInput: Record<TextWeight, TextStyle> = {
  regular:   { fontFamily: FONT.regular },
  medium:    { fontFamily: FONT.medium },
  semibold:  { fontFamily: FONT.semibold },
  bold:      { fontFamily: FONT.bold },
  extrabold: { fontFamily: FONT.bold }, // bold fallback
  black:     { fontFamily: FONT.black },
};
const FONT_STYLES = StyleSheet.create<Record<TextWeight, TextStyle>>(_fontInput);

// Color mapping — uses only tokens that exist in your V3 kit
const _colorInput: Record<TextColor, TextStyle> = {
  primary:         { color: kit.color.ink },
  secondary:       { color: kit.color.inkSoft },
  muted:           { color: kit.color.inkFaint },
  tertiary:        { color: kit.color.inkFaint },
  disabled:        { color: kit.color.inkFaint, opacity: 0.38 },
  inverse:         { color: kit.color.onInk },           // #ffffff
  "inverse-muted": { color: kit.color.onInk, opacity: 0.7 },
  brand:           { color: kit.color.accent },
  danger:          { color: kit.color.danger },
  warn:            { color: kit.color.warn },
  success:         { color: kit.color.success },
  info:            { color: kit.color.accentDeep },
};
const COLOR_STYLES = StyleSheet.create<Record<TextColor, TextStyle>>(_colorInput);

// Alignment presets
const _alignInput: Record<string, TextStyle> = {
  auto:    { textAlign: "auto" },
  left:    { textAlign: "left" },
  right:   { textAlign: "right" },
  center:  { textAlign: "center" },
  justify: { textAlign: "justify" },
};
const ALIGN_STYLES: Record<string, TextStyle> = StyleSheet.create(_alignInput);

const TEXT_BASE = StyleSheet.create({
  fix: {
    includeFontPadding: false,
    textAlignVertical: "center",
  } as TextStyle,
}).fix;

/**
 * Typography atom — use it everywhere.
 *
 * Supports two style systems side‑by‑side:
 * 1. Legacy `variant` prop — matches original theme sizes exactly.
 * 2. New `scale` prop — uses kit.type presets for a consistent modern scale.
 */
export function Text({
  variant,
  scale,
  weight,
  color = "primary",
  align,
  style,
  children,
  ...rest
}: TextProps): React.ReactElement {
  const baseStyle = useMemo<StyleProp<TextStyle>>(() => {
    if (scale) {
      const layoutStyle = SCALE_STYLES[scale] ?? null;
      if (weight) {
        return [layoutStyle, FONT_STYLES[weight] ?? null];
      }
      return layoutStyle;
    }

    const v = variant ?? "body";
    if (weight) {
      return [VARIANT_LAYOUT_STYLES[v], FONT_STYLES[weight] ?? null];
    }
    return VARIANT_STYLES[v];
  }, [scale, variant, weight]);

  const alignStyle = align ? ALIGN_STYLES[align] ?? null : null;

  return (
    <RNText
      {...rest}
      style={[TEXT_BASE, baseStyle, COLOR_STYLES[color], alignStyle, style]}
    >
      {children}
    </RNText>
  );
}