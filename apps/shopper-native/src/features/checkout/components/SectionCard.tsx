import React from "react";
import { View, Pressable } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { sectionStyles as s } from "./checkout.styles";
import { FORWARD_CHEVRON, textAlignStart, isRtl } from "@/utils/layout";
import type { IoniconsName } from "../constants";

const TEXT_START = textAlignStart(isRtl());

interface SectionCardProps {
  title:    string;
  icon:     IoniconsName;
  delay:    number;
  action?:  { label: string; onPress: () => void };
  children: React.ReactNode;
}

export const SectionCard = React.memo(function SectionCard({
  title,
  icon,
  delay: _delay,
  action,
  children,
}: SectionCardProps) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={s.card}>
      <View style={s.head}>
        <View style={s.titleWrap}>
          <View style={s.icon}>
            <Ionicons name={icon} size={15} color={kit.color.accentDeep} />
          </View>
          <UIText variant="card-title" align={TEXT_START}>
            {title}
          </UIText>
        </View>
        {action && (
          <Pressable
            onPress={action.onPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [s.actionWrap, pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] }]}>
            <UIText variant="eyebrow" weight="bold" style={{ color: kit.color.accentDeep }}>
              {action.label}
            </UIText>
            <Ionicons name={FORWARD_CHEVRON} size={11} color={kit.color.accentDeep} />
          </Pressable>
        )}
      </View>
      <View style={s.body}>{children}</View>
    </Animated.View>
  );
});
