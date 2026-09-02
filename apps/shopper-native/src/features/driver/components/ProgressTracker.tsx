import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

interface Step {
  id: string;
  label: string;
  done: boolean;
}

export default function ProgressTracker({ steps, pagePad = kit.inset.screen }: { steps: Step[]; pagePad?: number }) {
  const { theme } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: { flexDirection: flexRow(IS_RTL), marginHorizontal: pagePad, marginBottom: 18 },
    step: { flex: 1, alignItems: "center", position: "relative" },
    dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: theme.colors.border.default, backgroundColor: theme.colors.canvas.surface, alignItems: "center", justifyContent: "center", zIndex: 2 },
    dotDone: { backgroundColor: theme.colors.brand.primary, borderColor: theme.colors.brand.primary },
    line: { position: "absolute", height: 2, backgroundColor: theme.colors.border.default, top: 12, start: "50%", end: "-50%" },
    lineDone: { backgroundColor: theme.colors.brand.primary },
    label: { marginTop: 8, fontFamily: legacyTheme.fonts.semibold, fontSize: 11, color: theme.colors.text.muted, textAlign: "center" },
    labelDone: { color: theme.colors.brand.primary },
  }), [theme, pagePad]);

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
