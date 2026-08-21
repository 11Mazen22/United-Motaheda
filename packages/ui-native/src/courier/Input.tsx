import { View, type StyleProp, type ViewStyle } from "react-native";
import { useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useCourierTheme } from "./useCourierTheme";
import { Typography } from "./Typography";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  required?: boolean;
}

export const Input = function Input({ label, error, hint, containerStyle, required, onFocus, onBlur, onChangeText, value, style, accessibilityLabel, ...props }: InputProps) {
  const { theme, courier: courierTokens } = useCourierTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Typography scale="caption" color="secondary">{label}</Typography>
          {required ? <Typography scale="caption" color="danger">*</Typography> : null}
        </View>
      ) : null}
      <View
        style={[
          {
            borderWidth: 1,
            alignItems: "center",
            paddingHorizontal: 12,
            borderColor: error ? theme.colors.status.error : focused ? theme.colors.border.focus : theme.colors.border.default,
            backgroundColor: theme.colors.canvas.surface,
            borderRadius: courierTokens.radius.input,
            minHeight: courierTokens.size.inputHeight,
          },
        ]}
      >
        <TextInput
          {...props}
          value={value}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          onChangeText={onChangeText}
          placeholderTextColor={theme.colors.text.disabled}
          style={[
            {
              flex: 1,
              minHeight: 48,
              color: theme.colors.text.primary,
              fontFamily: "Cairo_400Regular",
              fontSize: courierTokens.type.body.fontSize,
              lineHeight: courierTokens.type.body.lineHeight,
              paddingVertical: 0,
            },
            style,
          ]}
          accessibilityLabel={accessibilityLabel || label}
          accessibilityHint={error || hint}
        />
      </View>
      {error || hint ? (
        <Typography scale="caption" color={error ? "danger" : "muted"}>{error ?? hint}</Typography>
      ) : null}
    </View>
  );
};
