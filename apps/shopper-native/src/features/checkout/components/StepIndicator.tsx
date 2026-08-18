import React from "react";
import { View, StyleSheet } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@pharmacy/ui-native";
import Animated, { Layout, FadeIn } from "react-native-reanimated";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

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
  const circleBg = done ? "transparent" : active ? kit.color.accent : kit.color.well;
  const circleBorder = done ? kit.color.accent : active ? kit.color.accent : kit.color.lineStrong;
  const textColor = done ? kit.color.accent : active ? kit.color.onAccent : kit.color.inkFaint;
  const labelColor = done || active ? kit.color.ink : kit.color.inkFaint;

  return (
    <Animated.View layout={Layout.springify().damping(18)} style={styles.pillContainer}>
      <View style={[styles.circle, { backgroundColor: circleBg, borderColor: circleBorder, borderWidth: done ? 1.5 : 0 }]}>
        {done ? (
          <Ionicons name="checkmark" size={16} color={kit.color.accent} />
        ) : (
          <UIText style={[styles.circleText, { color: textColor }]}>{index}</UIText>
        )}
      </View>
      <UIText style={[styles.label, { color: labelColor }]}>{label}</UIText>
    </Animated.View>
  );
});

export const StepLine = React.memo(function StepLine({ done }: { done: boolean }) {
  return (
    <Animated.View layout={Layout.springify().damping(18)} style={[styles.line, done && styles.lineDone]} />
  );
});

const styles = StyleSheet.create({
  pillContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: 80,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  circleText: {
    fontSize: 14,
    fontFamily: kit.font.bold,
  },
  label: {
    fontSize: 12,
    fontFamily: kit.font.medium,
    textAlign: "center",
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: kit.color.lineStrong,
    marginHorizontal: -20,
    marginTop: -20,
    zIndex: -1,
  },
  lineDone: {
    backgroundColor: kit.color.accent,
  },
});
