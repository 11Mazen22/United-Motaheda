import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, Button, useTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props): React.ReactElement {
  const { theme } = useTheme();
  const pagePad = kit.inset.screen;

  const s = useMemo(() => StyleSheet.create({
    wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: pagePad },
    iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas.surfaceMuted, marginBottom: 16 },
    title: { fontSize: 18, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, textAlign: "center" as const, marginBottom: 8 },
    subtitle: { fontSize: 14, color: theme.colors.text.muted, textAlign: "center" as const, maxWidth: 280, lineHeight: 20 },
    actionWrap: { marginTop: 20 },
  }), [theme, pagePad]);

  return (
    <View style={s.wrap}>
      <View style={s.iconWrap}>
        {icon ?? <Ionicons name="help-outline" size={32} color={theme.colors.text.muted} />}
      </View>
      <UIText variant="h6" color="primary" style={s.title}>{title}</UIText>
      {subtitle ? <UIText variant="body" color="muted" style={s.subtitle}>{subtitle}</UIText> : null}
      {actionLabel && onAction ? (
        <View style={s.actionWrap}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export default EmptyState;
