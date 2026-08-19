import React, { forwardRef, useState } from 'react';
import { View, TextInput, type TextInputProps, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { useLuxuryTheme } from './useLuxuryTheme';
import { T } from './Typography';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      error,
      helper,
      disabled,
      leftIcon,
      rightIcon,
      style,
      inputStyle,
      multiline,
      ...props
    },
    ref
  ) => {
    const { theme, surface, lx, isRTL, interaction } = useLuxuryTheme();
    const [focused, setFocused] = useState(false);

    let borderColor: string = surface.s3;
    if (focused) borderColor = interaction.focusRingColor;
    if (error) borderColor = theme.colors.status.error;

    return (
      <View style={[{ width: '100%' }, style]}>
        {label && (
          <View style={{ marginBottom: lx.space[1] }}>
            <T scale="label" color="primary">
              {label}
            </T>
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            minHeight: lx.size.inputHeight,
            backgroundColor: surface.s2,
            borderWidth: focused ? interaction.focusRingWidth : 1,
            borderColor,
            borderRadius: lx.radius.input,
            paddingHorizontal: lx.space[3],
            paddingVertical: multiline ? lx.space[3] : 0,
            opacity: disabled ? interaction.disabledOpacity : 1,
          }}
        >
          {leftIcon && <View style={{ marginRight: lx.space[2] }}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            editable={!disabled}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            placeholderTextColor={theme.colors.text.muted}
            multiline={multiline}
            style={[
              {
                flex: 1,
                fontFamily: 'Cairo_400Regular',
                fontSize: lx.type.body.fontSize,
                color: theme.colors.text.primary,
                textAlign: isRTL ? 'right' : 'left',
              },
              inputStyle,
            ]}
            {...props}
          />
          {rightIcon && <View style={{ marginLeft: lx.space[2] }}>{rightIcon}</View>}
        </View>
        {error ? (
          <View style={{ marginTop: lx.space[1] }}>
            <T scale="caption" color="danger">
              {error}
            </T>
          </View>
        ) : helper ? (
          <View style={{ marginTop: lx.space[1] }}>
            <T scale="caption" color="muted">
              {helper}
            </T>
          </View>
        ) : null}
      </View>
    );
  }
);
TextField.displayName = 'TextField';
