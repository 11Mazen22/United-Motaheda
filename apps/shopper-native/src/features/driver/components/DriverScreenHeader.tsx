import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface Props {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

/** Shared driver chrome keeps every operational screen visually consistent. */
export function DriverScreenHeader({ title, subtitle, trailing }: Props): React.ReactElement {
  const router = useRouter();
  return (
    <View style={s.wrap}>
      <Pressable onPress={() => router.back()} style={s.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
      </Pressable>
      <View style={s.copy}>
        <UIText style={s.title} numberOfLines={1}>{title}</UIText>
        {subtitle ? <UIText style={s.subtitle} numberOfLines={1}>{subtitle}</UIText> : null}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, paddingHorizontal: kit.inset.screen, paddingTop: 12, paddingBottom: 16 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: kit.color.surface, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", ...kit.shadow.card },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.fonts.black, fontSize: 18, color: kit.color.ink, textAlign: TEXT_START },
  subtitle: { marginTop: 2, fontFamily: theme.fonts.regular, fontSize: 11, color: kit.color.inkSoft, textAlign: TEXT_START },
  trailing: { flexShrink: 0 },
});
