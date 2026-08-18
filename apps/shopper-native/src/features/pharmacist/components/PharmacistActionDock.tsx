import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export function PharmacistActionDock({
  actions,
  loading,
  onAction,
}: {
  actions: { key: string; label: string; variant?: "primary" | "ghost" }[];
  loading?: boolean;
  onAction: (key: string) => void;
}) {
  if (!actions || actions.length === 0) return null;
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents={loading ? "none" : "auto"}>
      <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>
        {actions.map((a, i) => (
          <Button
            key={a.key}
            label={a.label}
            variant={a.variant === "ghost" ? "ghost" : i === 0 ? "primary" : "outline"}
            onPress={() => onAction(a.key)}
            style={i < actions.length - 1 ? s.buttonGap : undefined}
            loading={loading}
            full
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: "transparent",
  },
  row: {
    gap: 10,
  },
  buttonGap: {
    marginEnd: 8,
  },
});
