/**
 * PrescriptionsHeader — shared gradient hero for every prescriptions-flow
 * screen (list, add-entry, manual, transfer, detail, refill).
 *
 * Mirrors the brandPrimary LinearGradient hero treatment already shipped on
 * Home / Orders / Cart / Products / Search — the plain white card header
 * every prescriptions screen used before was the one visibly stale surface
 * left in this flow. Flexible enough to host each screen's own trailing
 * cluster (quick-add pill, edit/delete icons, secure badge) and an optional
 * glass stat band underneath the identity row.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { gradients } from "@pharmacy/design-tokens";
import { Text, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { useTranslation } from "react-i18next";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface PrescriptionsHeaderProps {
  insetsTop:  number;
  icon:       IoniconsName;
  eyebrow:    string;
  title:      string;
  onBack?:    () => void;
  /** Custom trailing cluster (quick-add pill, edit/delete icons, secure badge). */
  trailing?:  React.ReactNode;
  /** Optional glass stat band rendered under the identity row. */
  statsBand?: React.ReactNode;
}

export function PrescriptionsHeader({
  insetsTop, icon, eyebrow, title, onBack, trailing, statsBand,
}: PrescriptionsHeaderProps): React.ReactElement {
  const { theme } = useTheme();
  const h = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();

  return (
    <LinearGradient
      colors={gradients.brandPrimary as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[h.header, { paddingTop: insetsTop + 12, paddingHorizontal: pagePad }]}
    >
      <View style={[h.navRow, { flexDirection: flexRow(IS_RTL) }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={h.backBtnTouchable}>
            {({ pressed }) => (
              <View style={[h.backBtn, pressed && h.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={20} color="#fff" />
              </View>
            )}
          </Pressable>
        ) : (
          <View style={h.backBtn} />
        )}
        <View style={{ flex: 1 }} />
        {trailing}
      </View>

      <View style={[h.identityRow, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={h.heroTile}>
          <Ionicons name={icon} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="bold" style={h.eyebrow}>{eyebrow}</Text>
          <Text weight="black" style={h.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        </View>
      </View>

      {statsBand}
    </LinearGradient>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    header: {
      paddingBottom: 20,
      gap:           16,
      ...theme.shadows[2],
    },
    navRow: {
      alignItems: "center",
      minHeight:  38,
    },
    backBtnTouchable: { borderRadius: 14, flexShrink: 0 },
    backBtn: {
      width:           38,
      height:          38,
      borderRadius:    14,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems:      "center",
      justifyContent:  "center",
    },
    backBtnPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
    identityRow: {
      alignItems: "center",
      gap:        14,
    },
    heroTile: {
      width:           56,
      height:          56,
      borderRadius:    18,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems:      "center",
      justifyContent:  "center",
      flexShrink:      0,
    },
    eyebrow: {
      fontSize:           10,
      lineHeight:         14,
      color:              "rgba(255,255,255,0.8)",
      letterSpacing:      0.6,
      textTransform:      "uppercase",
      textAlign:          TEXT_START,
      includeFontPadding: false,
    },
    title: {
      fontSize:           28,
      lineHeight:         34,
      color:              "#fff",
      letterSpacing:      -0.6,
      textAlign:          TEXT_START,
      includeFontPadding: false,
    },
  });
}
