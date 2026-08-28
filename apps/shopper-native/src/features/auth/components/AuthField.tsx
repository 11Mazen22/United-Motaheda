/**
 * AuthField — the shared input for every auth screen (login, register,
 * forgot/reset password).
 *
 * Replaces the old FloatingInput pattern (label absolutely positioned
 * *inside* the bordered box, animating between a placeholder position and a
 * floated-up position). That pattern is fragile by construction: the label
 * and the value share the same coordinate space with nothing but a
 * translateY/scale animation keeping them apart, so it's one small styling
 * change away from the label and value visually colliding -- confirmed live
 * exactly that way, with the entered value reading as jammed to one side of
 * the box instead of cleanly filling it.
 *
 * This is the boring, robust alternative every mainstream auth form
 * actually uses: a small label *above* the box, a real icon well *inside*
 * it, and `gap` for spacing instead of manual margins (the same class of
 * RTL spacing bug fixed today in CustomerUI.Button and SocialButtons lived
 * here too before this rewrite). Nothing to misalign because nothing
 * overlaps.
 */
import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View, StyleSheet, type KeyboardTypeOptions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface AuthFieldProps {
  label: string;
  icon: IoniconsName;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
  error?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  returnKeyType?: React.ComponentProps<typeof TextInput>["returnKeyType"];
  onSubmitEditing?: () => void;
}

export function AuthField({
  label, icon, value, onChangeText, secure = false, error = false,
  autoCapitalize = "none", keyboardType = "default", autoComplete, returnKeyType, onSubmitEditing,
}: AuthFieldProps): React.ReactElement {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  const glow = useSharedValue(0);
  const handleFocus = () => { setFocused(true); glow.value = withTiming(1, { duration: 160 }); };
  const handleBlur = () => { setFocused(false); glow.value = withTiming(0, { duration: 160 }); };
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const tone = error ? theme.colors.status.error : focused ? theme.colors.brand.primary : theme.colors.border.default;

  return (
    <View style={s.wrap}>
      <UIText weight="bold" style={[s.label, { textAlign: TEXT_START, color: focused ? theme.colors.brand.primary : theme.colors.text.secondary }]}>
        {label}
      </UIText>

      <View style={s.boxOuter}>
        <Animated.View pointerEvents="none" style={[s.focusGlow, { backgroundColor: theme.colors.brand.primary }, glowStyle]} />
        <View style={[s.box, { flexDirection: flexRow(IS_RTL), borderColor: tone, backgroundColor: theme.colors.canvas.surface }, focused && s.boxFocused, error && s.boxError]}>
          <View style={[s.iconWell, { backgroundColor: focused ? theme.colors.brand.primaryLight : theme.colors.canvas.surfaceMuted }]}>
            <Ionicons name={icon} size={17} color={focused ? theme.colors.brand.primary : theme.colors.text.muted} />
          </View>

          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={hidden}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            autoComplete={autoComplete}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            placeholderTextColor={theme.colors.text.disabled}
            style={[s.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", writingDirection: IS_RTL ? "rtl" : "ltr" }]}
          />

          {secure && (
            <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? "Show password" : "Hide password"}>
              <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={19} color={theme.colors.text.muted} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    label: { fontSize: 13, letterSpacing: 0.1 },
    boxOuter: { position: "relative" },
    focusGlow: {
      position: "absolute", start: -2, end: -2, top: -2, bottom: -2,
      borderRadius: 18, opacity: 0.14,
    },
    box: {
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      paddingHorizontal: 12,
      ...theme.shadows[1],
    },
    boxFocused: { ...theme.shadows[2] },
    boxError: {},
    iconWell: {
      width: 34, height: 34, borderRadius: 11,
      alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    },
    input: {
      flex: 1,
      height: "100%",
      fontFamily: legacyTheme.fonts.bold,
      fontSize: 15.5,
      paddingVertical: 0,
    },
  });
}
