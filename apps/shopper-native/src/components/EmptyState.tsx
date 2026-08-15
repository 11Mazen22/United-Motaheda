import React from "react";
import { View, StyleSheet } from "react-native";
import { Text as UIText, Button } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";

export default function EmptyState({ icon = "checkmark-circle-outline", title, subtitle, actionLabel, onAction, compact = false }: { icon?: string; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void; compact?: boolean }) {
  return (
    <View style={s.wrap}>
      <Ionicons name={icon as any} size={compact ? 36 : 44} color={kit.color.inkFaint} />
      <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>{title}</UIText>
      {subtitle ? <UIText color="secondary" style={{ marginTop: compact ? 6 : 8, textAlign: "center" }}>{subtitle}</UIText> : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: 12 }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24 },
});
