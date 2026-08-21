import React, { useState } from "react";

import {

  TextInput,

  View,

  type StyleProp,

  type TextInputProps,

  type ViewStyle,

} from "react-native";

import { useTranslation } from "react-i18next";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";



const _isRtl = isRtl();

import { Text as UIText } from "@pharmacy/ui-native";

import Animated, {

  useAnimatedStyle,

  useSharedValue,

  withTiming,

  interpolateColor,

} from "react-native-reanimated";

import { theme } from "@pharmacy/design-tokens";

import { kit } from "@pharmacy/ui-native";



interface InputProps extends TextInputProps {

  label?:       string;

  error?:       string;

  hint?:        string;

  leftIcon?:    React.ReactNode;

  rightIcon?:   React.ReactNode;

  containerStyle?: StyleProp<ViewStyle>;

  optional?:    boolean;

}



const AnimView = Animated.createAnimatedComponent(View);



export function Input({

  label,

  error,

  hint,

  leftIcon,

  rightIcon,

  containerStyle,

  optional,

  onFocus,

  onBlur,

  multiline,

  numberOfLines,

  ...rest

}: InputProps) {

  const { t }                 = useTranslation();

  const [focused, setFocused] = useState(false);

  const progress              = useSharedValue(0);



  // Single-line layout uses a fixed inputHeight and vertically-centered

  // content. Multi-line needs a min-height proportional to numberOfLines,

  // top-aligned text on Android (textAlignVertical), and real vertical

  // padding so the placeholder/cursor don't float in the middle.

  const lineCount   = numberOfLines ?? 1;

  const lineHeight  = 22; // matches theme.typography.size.lg line height

  const verticalPad = 12;

  const minHeight   = multiline

    ? lineHeight * lineCount + verticalPad * 2

    : theme.layout.inputHeight;



  // Premium focus state: idle uses a hairline `line` border on a `well`

  // background; focused promotes to a 2pt accent ring on `surface` with

  // the brand glow shadow. Error overrides both with a flat danger border.

  const borderAnim = useAnimatedStyle(() => ({

    borderColor: interpolateColor(

      progress.value,

      [0, 1],

      [

        error ? kit.color.danger : kit.color.line,

        error ? kit.color.danger : kit.color.accentDeep,

      ],

    ),

    borderWidth: withTiming(focused ? 2 : 1, { duration: 150 }),

  }));



  const handleFocus: TextInputProps["onFocus"] = (e) => {

    setFocused(true);

    progress.value = withTiming(1, { duration: 200 });

    onFocus?.(e);

  };



  const handleBlur: TextInputProps["onBlur"] = (e) => {

    setFocused(false);

    progress.value = withTiming(0, { duration: 200 });

    onBlur?.(e);

  };



  return (

    <View style={[{ gap: 6 }, containerStyle]}>

      {/* Label row — focused state recolors the label to accentDeep so the

          eye lands on the active field even when scanning a long form. */}

      {label && (

        <View style={{ flexDirection: flexRow(_isRtl), alignItems: "center", justifyContent: "space-between" }}>

          <UIText style={{

            fontSize:           theme.fontSize.sm,

            fontFamily:         theme.fonts.bold,

            color:              error

              ? kit.color.danger

              : focused

              ? kit.color.accentDeep

              : kit.color.inkSoft,

            textAlign:          textAlignStart(_isRtl),

            letterSpacing:      0.2,

            includeFontPadding: false,

          }}>

            {label}

          </UIText>

          {optional && (

            <UIText style={{

              fontSize:           theme.fontSize.xs,

              fontFamily:         theme.fonts.regular,

              color:              kit.color.inkFaint,

              includeFontPadding: false,

            }}>

              {t("common.optional")}

            </UIText>

          )}

        </View>

      )}



      {/* Input box — soft brand glow when focused gives the "trust" UX

          signal without being loud. Error state overrides with no glow. */}

      <AnimView

        style={[

          {

            flexDirection:     flexRow(_isRtl),

            alignItems:        multiline ? "flex-start" : "center",

            minHeight,

            borderRadius:      kit.radius.control,

            backgroundColor:   focused ? kit.color.surface : kit.color.well,

            paddingHorizontal: 14,

            paddingVertical:   multiline ? verticalPad : 0,

            gap:               10,

            ...(focused && !error ? theme.shadow.brandGlow : theme.shadow.xs),

          },

          borderAnim,

        ]}>

        {/* Right icon (RTL: left side) */}

        {leftIcon && (

          <View style={{ opacity: focused ? 1 : 0.55, marginTop: multiline ? 2 : 0 }}>

            {leftIcon}

          </View>

        )}



        <TextInput

          style={{

            flex:           1,

            fontSize:       theme.fontSize.md,

            fontFamily:     theme.fonts.regular,

            color:          kit.color.ink,

            textAlign:      textAlignStart(_isRtl),

            // Android: pin cursor + text to the top of the textarea.

            // iOS ignores this prop (already top-aligns by default).

            textAlignVertical: multiline ? "top" : "center",

            // Set lineHeight + paddingVertical:0 so the textarea height

            // exactly matches our minHeight calculation above (no double

            // padding from the platform default).

            lineHeight:     multiline ? lineHeight : undefined,

            paddingVertical: 0,

          }}

          multiline={multiline}

          numberOfLines={numberOfLines}

          placeholderTextColor={kit.color.inkFaint}

          onFocus={handleFocus}

          onBlur={handleBlur}

          {...rest}

        />



        {/* Left icon (RTL: right side) */}

        {rightIcon && (

          <View style={{ opacity: focused ? 1 : 0.55 }}>

            {rightIcon}

          </View>

        )}

      </AnimView>



      {/* Error / Hint */}

      {(error || hint) && (

        <UIText style={{

          fontSize:  theme.fontSize.xs,

          fontFamily: theme.fonts.regular,

          color:     error ? kit.color.danger : kit.color.inkFaint,

          textAlign: textAlignStart(_isRtl),

          marginTop: 2,

        }}>

          {error ?? hint}

        </UIText>

      )}

    </View>

  );

}

