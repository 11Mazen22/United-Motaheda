import React from "react";

import { View, StyleSheet, TouchableOpacity } from "react-native";

import { Text, useTheme, kit } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import { isRtl, flexRow, BACK_CHEVRON } from "@/utils/layout";



export interface ScreenHeaderProps {

  title: string;

  subtitle?: string;

  onBack?: () => void;

  rightAction?: { icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void; badge?: number };

  transparent?: boolean;

}



export default function ScreenHeader({ title, subtitle, onBack, rightAction, transparent }: ScreenHeaderProps) {

  const {} = useTheme();

  const rtl = isRtl();



  return (

    <View 

      style={[

        s.container,

        { flexDirection: flexRow(rtl) },

        !transparent && { backgroundColor: kit.color.canvas.surface, borderBottomWidth: 1, borderBottomColor: kit.color.border.default }

      ]}

    >

      <View style={[s.sideContainer, { alignItems: rtl ? "flex-end" : "flex-start" }]}>

        {onBack && (

          <TouchableOpacity

            accessibilityRole="button"

            accessibilityLabel="Go back"

            onPress={onBack}

            style={s.iconButton}

          >

            <Ionicons name={BACK_CHEVRON} size={24} color={kit.color.text.primary} />

          </TouchableOpacity>

        )}

      </View>



      <View style={s.centerContainer}>

        <Text variant="screen-title" align="center" style={{ color: kit.color.text.primary }} numberOfLines={1}>

          {title}

        </Text>

        {subtitle && (

          <Text variant="caption" align="center" style={{ color: kit.color.text.secondary }} numberOfLines={1}>

            {subtitle}

          </Text>

        )}

      </View>



      <View style={[s.sideContainer, { alignItems: rtl ? "flex-start" : "flex-end" }]}>

        {rightAction && (

          <TouchableOpacity

            accessibilityRole="button"

            accessibilityLabel="Action"

            onPress={rightAction.onPress}

            style={s.iconButton}

          >

            <Ionicons name={rightAction.icon} size={24} color={kit.color.text.primary} />

            {rightAction.badge !== undefined && rightAction.badge > 0 && (

              <View style={[s.badge, { backgroundColor: kit.color.danger }]}>

                <Text variant="badge" style={{ color: kit.color.white, fontSize: 10 }}>

                  {rightAction.badge > 99 ? '99+' : rightAction.badge}

                </Text>

              </View>

            )}

          </TouchableOpacity>

        )}

      </View>

    </View>

  );

}



const s = StyleSheet.create({

  container: {

    height: 56,

    alignItems: "center",

    justifyContent: "space-between",

    paddingHorizontal: kit.sp(2),

  },

  sideContainer: {

    width: 48,

    justifyContent: "center",

  },

  centerContainer: {

    flex: 1,

    justifyContent: "center",

    paddingHorizontal: kit.sp(2),

  },

  iconButton: {

    padding: kit.sp(2),

  },

  badge: {

    position: "absolute",

    top: 4,

    end: 4,

    minWidth: 16,

    height: 16,

    borderRadius: 8,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 4,

  }

});

