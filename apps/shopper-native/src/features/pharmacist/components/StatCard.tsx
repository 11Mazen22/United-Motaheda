import React from "react";

import { Pressable, StyleSheet, View, type StyleProp, type  } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { kit }            from "@pharmacy/ui-native";

import { theme }          from "@pharmacy/design-tokens";



interface StatCardProps {

  value:     number | string;

  label:     string;

  icon?:     string;

  iconColor?: string;

  iconBg?:   string;

  accent?:   string;

  trend?:    number;

  onPress?:  () => void;

  style?:    StyleProp<any>;

}



export function StatCard({

  value,

  label,

  accent,

  onPress,

  style,

}: StatCardProps) {

  const inner = (

    <View style={s.content}>

      <UIText style={[s.value, accent ? { color: accent } : undefined]}>{value}</UIText>

      <UIText variant="caption" color="secondary" style={s.label} numberOfLines={1}>{label}</UIText>

    </View>

  );



  if (onPress) {

    return (

      <Pressable

        onPress={onPress}

        style={({ pressed }) => [s.card, pressed && s.cardPressed, style]}

        accessibilityRole="button"

      >

        {inner}

      </Pressable>

    );

  }



  return <View style={[s.card, style]}>{inner}</View>;

}



const s = StyleSheet.create({

  card: {

    flex:              1,

    backgroundColor:   kit.color.surface,

    borderRadius:      kit.radius.md,

    paddingVertical:   10,

    paddingHorizontal: 8,

    borderWidth:       1,

    borderColor:       kit.color.line,

  },

  cardPressed: {

    opacity: 0.7,

  },

  content: {

    alignItems: "center",

    justifyContent: "center",

    gap: 2,

  },

  value: {

    fontSize:   20,

    fontFamily: theme.fonts.bold,

    color:      kit.color.ink,

    lineHeight: 24,

  },

  label: {

    textAlign: "center",

  },

});

