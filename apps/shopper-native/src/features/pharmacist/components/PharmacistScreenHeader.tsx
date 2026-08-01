/**
 * PharmacistScreenHeader — reusable header for all pharmacist screens.
 * Mirrors DriverScreenHeader exactly so the two experiences are visually
 * consistent where they share UX patterns (back navigation, title, badge).
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter }      from "expo-router";
import { Ionicons }       from "@expo/vector-icons";
import { Text as UIText } from "@/shared/ui";
import { kit }            from "@/shared/kit";
import { BACK_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface PharmacistScreenHeaderProps {
  title:       string;
  subtitle?:   string;
  trailing?:   React.ReactNode;
  onBack?:     () => void;
  hideBack?:   boolean;
}

export function PharmacistScreenHeader({
  title,
  subtitle,
  trailing,
  onBack,
  hideBack = false,
}: PharmacistScreenHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={s.root}>
      {!hideBack && (
        <Pressable
          onPress={handleBack}
          style={s.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>
      )}
      <View style={[s.titles, hideBack && s.titlesNoBack]}>
        <UIText variant="card-title" style={{ textAlign: TEXT_START }} numberOfLines={1}>
          {title}
        </UIText>
        {subtitle ? (
          <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
            {subtitle}
          </UIText>
        ) : null}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: kit.inset.screen,
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    flexShrink:      0,
  },
  titles: {
    flex: 1,
    gap:  2,
  },
  titlesNoBack: {
    paddingStart: 4,
  },
  trailing: {
    flexShrink: 0,
  },
});
