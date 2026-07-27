import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import { colors, spacing, radii, typography, shadows } from '@/theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerStyle,
      required,
      style,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);

    return (
      <View style={[s.wrapper, containerStyle]}>
        {label && (
          <Text style={s.label}>
            {label}
            {required && <Text style={s.required}> *</Text>}
          </Text>
        )}

        <View
          style={[
            s.container,
            focused && s.focused,
            !!error && s.errorBorder,
          ]}
        >
          {leftIcon && <View style={s.iconLeft}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[s.input, leftIcon && s.inputWithLeft, rightIcon && s.inputWithRight, style]}
            placeholderTextColor={colors.inkFaint}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
          />

          {rightIcon && <View style={s.iconRight}>{rightIcon}</View>}
        </View>

        {error ? (
          <Text style={s.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={s.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

const s = StyleSheet.create({
  wrapper: { gap: spacing[1] },

  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.inkSoft,
  },
  required: { color: colors.error },

  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    minHeight: 52,
    ...shadows.sm,
  },
  focused: { borderColor: colors.primary },
  errorBorder: { borderColor: colors.error },

  input: {
    flex: 1,
    fontSize: typography.base,
    color: colors.ink,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  inputWithLeft: { paddingLeft: spacing[2] },
  inputWithRight: { paddingRight: spacing[2] },

  iconLeft: { paddingLeft: spacing[4] },
  iconRight: { paddingRight: spacing[4] },

  errorText: {
    fontSize: typography.xs,
    color: colors.error,
    marginTop: 2,
  },
  hint: {
    fontSize: typography.xs,
    color: colors.inkFaint,
    marginTop: 2,
  },
});
