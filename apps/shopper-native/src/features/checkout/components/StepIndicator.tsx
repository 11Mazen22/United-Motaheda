import React from "react";
import { View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@pharmacy/ui-native";
import { stepBarStyles as s } from "./checkout.styles";

interface StepPillProps {
  index:  number;
  label:  string;
  active: boolean;
  done:   boolean;
}

export const StepPill = React.memo(function StepPill({
  index,
  label,
  active,
  done,
}: StepPillProps) {
  const numBg       = done ? kit.color.success : active ? kit.color.ink : kit.color.lineStrong;
  const pillBg      = done ? kit.color.successTint : active ? kit.color.well : "transparent";
  const pillBorder  = done ? kit.color.success : active ? kit.color.ink : kit.color.line;
  const labelColor  = done ? kit.color.success : active ? kit.color.ink : kit.color.inkFaint;

  return (
    <View
      style={[
        s.pill,
        { backgroundColor: pillBg, borderColor: pillBorder },
        (active || done) && s.pillActive,
      ]}>
      <View style={[s.num, { backgroundColor: numBg }]}>
        {done ? (
          <Ionicons name="checkmark" size={12} color="#fff" />
        ) : (
          <UIText style={s.numText}>{index}</UIText>
        )}
      </View>
      <UIText style={[s.label, { color: labelColor }]}>{label}</UIText>
    </View>
  );
});

export const StepLine = React.memo(function StepLine({ done }: { done: boolean }) {
  return (
    <View style={[s.line, done && { backgroundColor: kit.color.accent }]} />
  );
});
