/**

 * PharmacistScreenHeader — reusable header for all pharmacist screens.

 * Premium version: proper title size, clean white surface, teal back button.

 */

import React from "react";

import { Pressable, StyleSheet, View } from "react-native";

import { useRouter }      from "expo-router";

import { Ionicons }       from "@expo/vector-icons";

import { Text as UIText } from "@pharmacy/ui-native";

import { kit }            from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";

import { BACK_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



interface PharmacistScreenHeaderProps {

  title:       string;

  subtitle?:   string;

  trailing?:   React.ReactNode;

  onBack?:     () => void;

  hideBack?:   boolean;

}



export function PharmacistScreenHeader({

  title,

  subtitle,

  trailing,

  onBack,

  hideBack = false,

}: PharmacistScreenHeaderProps) {

  const router     = useRouter();

  const handleBack = onBack ?? (() => router.back());



  return (

    <View style={s.root}>

      {!hideBack && (

        <Pressable

          onPress={handleBack}

          style={s.backBtn}

          hitSlop={10}

          accessibilityRole="button"

          accessibilityLabel="Back"

        >

          <Ionicons name={BACK_CHEVRON} size={22} color={theme.colors.text.primary} />

        </Pressable>

      )}



      <View style={[s.titles, hideBack && s.titlesNoBack]}>

        <UIText style={s.title} numberOfLines={1}>{title}</UIText>

        {subtitle ? (

          <UIText style={s.subtitle}>{subtitle}</UIText>

        ) : null}

      </View>



      {trailing ? <View style={s.trailing}>{trailing}</View> : null}

    </View>

  );

}



const s = StyleSheet.create({

  root: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               12,

    paddingHorizontal: kit.inset.screen,

    paddingVertical:   16,

    backgroundColor:   theme.colors.canvas.surface,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: theme.colors.border.default,

  },

  backBtn: {

    width:           40,

    height:          40,

    borderRadius:    20,

    alignItems:      "center",

    justifyContent:  "center",

    flexShrink:      0,

  },

  titles: {

    flex: 1,

    gap:  3,

  },

  titlesNoBack: {

    paddingStart: 4,

  },

  title: {

    fontSize:           20,

    lineHeight:         26,

    fontFamily:         legacyTheme.fonts.black,

    color:              theme.colors.text.primary,

    letterSpacing:      -0.3,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  subtitle: {

    fontSize:           12,

    lineHeight:         16,

    fontFamily:         legacyTheme.fonts.regular,

    color:              theme.colors.text.muted,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  trailing: {

    flexShrink: 0,

  },

});

