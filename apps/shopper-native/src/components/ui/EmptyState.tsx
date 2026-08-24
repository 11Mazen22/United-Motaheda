import { defaultTheme as theme } from "@pharmacy/ui-native";
import React from "react";

import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";

import { Text, Button, kit } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import Animated, { FadeInDown } from "react-native-reanimated";




export interface EmptyStateProps {

  icon?: React.ComponentProps<typeof Ionicons>["name"];

  title: string;

  subtitle?: string;

  description?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;

  action?: { label: string; onPress: () => void };

  style?: StyleProp<ViewStyle>;

}



export function EmptyState({ icon = "cube-outline", title, subtitle, description, message, action, actionLabel, onAction, style }: EmptyStateProps) {


  

  const displaySubtitle = subtitle || description || message;
  const resolvedAction = action || (actionLabel && onAction ? { label: actionLabel, onPress: onAction } : undefined);



  return (

    <Animated.View

      entering={FadeInDown.duration(350).delay(80)}
      style={[
        s.container,

        { backgroundColor: theme.colors.canvas.background },

        style

      ]}

    >

      <View

        style={[

          s.iconWrap,

          {

            backgroundColor: `${theme.colors.brand.primary}15`,

            borderColor: theme.colors.border.default,

          }

        ]}

      >

        <Ionicons name={icon} size={36} color={theme.colors.brand.primary} />

      </View>

      <Text variant="h3" align="center" style={{ color: kit.color.text.primary, marginTop: 16 }}>

        {title}

      </Text>

      {displaySubtitle ? (

        <Text variant="body" align="center" style={{ color: kit.color.text.secondary, marginTop: 8 }}>

          {displaySubtitle}

        </Text>

      ) : null}

      {resolvedAction ? (

        <View style={{ marginTop: 24 }}>

          <Button label={resolvedAction.label} onPress={resolvedAction.onPress} />

        </View>

      ) : null}

    </Animated.View>

  );

}



const s = StyleSheet.create({

  container: {

    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 32,

    paddingVertical: 48,

  },

  iconWrap: {

    width: 80,

    height: 80,

    borderRadius: 40,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 1,

  },

});

