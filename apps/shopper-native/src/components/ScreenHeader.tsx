import React from "react";
import { View, StyleSheet } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export default function ScreenHeader({ eyebrow, title, trailing }: { eyebrow?: string; title: string; trailing?: React.ReactNode }) {
  return (
    <View style={s.wrap}>
      <View style={s.left}>
        {eyebrow ? <UIText variant="caption" color="brand">{eyebrow}</UIText> : null}
        <UIText variant="screen-title" style={s.title}>{title}</UIText>
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: kit.inset.screen, paddingTop: 12, paddingBottom: 6 },
  left: { flex: 1, minWidth: 0 },
  title: { marginTop: 4 },
  trailing: { marginLeft: 12 },
});
