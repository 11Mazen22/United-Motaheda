/**
 * HoldToConfirmButton — a deliberate-friction control for the one truly
 * irreversible driver action (marking an order delivered, ending the whole
 * workflow with no undo). A plain tap is too easy to trigger by accident
 * while walking up to a door or handing off a phone; holding for a full
 * beat, with a visible fill and a completion haptic, matches the kind of
 * confirmation a production delivery app uses for its point-of-no-return
 * action instead of a disposable "are you sure?" dialog.
 */
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();
const HOLD_MS = 900;

export interface HoldToConfirmButtonProps {
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onConfirm: () => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function HoldToConfirmButton({ label, hint, icon, onConfirm, loading, style }: HoldToConfirmButtonProps): React.ReactElement {
  const { theme } = useTheme();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const firedRef = useRef(false);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const start = () => {
    if (loading) return;
    firedRef.current = false;
    setHolding(true);
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished && !firedRef.current) {
        firedRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConfirm();
      }
    });
  };

  const cancel = () => {
    setHolding(false);
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 180 });
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Hold to confirm"
      style={[s.wrap, { backgroundColor: theme.colors.brand.primary, opacity: loading ? 0.7 : 1 }, style]}
    >
      <Animated.View style={[s.fill, fillStyle, { backgroundColor: "rgba(255,255,255,0.28)" }]} />
      <View style={s.content}>
        <Ionicons name={icon} size={18} color="#fff" />
        <View>
          <UIText variant="label" style={{ color: "#fff" }}>{label}</UIText>
          <UIText variant="caption" style={{ color: "rgba(255,255,255,0.75)" }}>{holding ? "…" : hint}</UIText>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { minHeight: 56, borderRadius: 14, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  fill: { position: "absolute", top: 0, bottom: 0, start: 0 },
  content: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
});

export default HoldToConfirmButton;
