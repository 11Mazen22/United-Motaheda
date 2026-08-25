import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Text as UIText, Button, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

export default function ConfirmationSheet({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel }: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
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

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    wrap: { padding: 18, borderTopStartRadius: 16, borderTopEndRadius: 16, backgroundColor: theme.colors.canvas.background },
    title: { fontFamily: legacyTheme.fonts.semibold, fontSize: 16 },
    actions: { marginTop: 14, flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  });
}
