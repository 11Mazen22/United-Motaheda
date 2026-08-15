import React from "react";
import { View, StyleSheet } from "react-native";
import { Text as UIText, Button, kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";

export default function ConfirmationSheet({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel }: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={s.wrap}>
      <UIText variant="card-title" style={s.title}>{title}</UIText>
      {body ? <UIText color="secondary" style={{ marginTop: 8 }}>{body}</UIText> : null}
      <View style={s.actions}>
        <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
        <Button label={confirmLabel} onPress={onConfirm} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 18, borderTopLeftRadius: kit.radius.xl, borderTopRightRadius: kit.radius.xl, backgroundColor: kit.color.canvas },
  title: { fontFamily: theme.fonts.semibold, fontSize: 16 },
  actions: { marginTop: 14, flexDirection: "row", gap: 10, justifyContent: "flex-end" },
});
