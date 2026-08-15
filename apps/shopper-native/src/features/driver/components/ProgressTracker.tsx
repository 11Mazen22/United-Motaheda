import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

interface Step {
  id: string;
  label: string;
  done: boolean;
}

export default function ProgressTracker({ steps }: { steps: Step[] }) {
  return (
    <View style={s.wrap}>
      {steps.map((step, idx) => (
        <View key={step.id} style={s.step}>
          <View style={[s.dot, step.done && s.dotDone]}>{step.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}</View>
          {idx < steps.length - 1 && <View style={[s.line, step.done && s.lineDone]} />}
          <UIText style={[s.label, step.done && s.labelDone]}>{step.label}</UIText>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: flexRow(IS_RTL), marginHorizontal: kit.inset.screen, marginBottom: 18 },
  step: { flex: 1, alignItems: "center", position: "relative" },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: kit.color.line, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", zIndex: 2 },
  dotDone: { backgroundColor: kit.color.accent, borderColor: kit.color.accent },
  line: { position: "absolute", height: 2, backgroundColor: kit.color.line, top: 12, left: "50%", right: "-50%" },
  lineDone: { backgroundColor: kit.color.accent },
  label: { marginTop: 8, fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, textAlign: "center" },
  labelDone: { color: kit.color.accentDeep },
});
