/**
 * TrustBadges — three security trust chips shown at the bottom of sign-in.
 * Communicates that data is safe without taking up much space.
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

type BadgeDef = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  labelKey: string;
};

const BADGES: BadgeDef[] = [
  { icon: "shield-checkmark-outline", labelKey: "auth.trustSecure"  },
  { icon: "lock-closed-outline",      labelKey: "auth.trustPrivate" },
  { icon: "heart-circle-outline",     labelKey: "auth.trustCare"    },
];

export function TrustBadges() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  return (
    <View style={s.row}>
      {BADGES.map((b, i) => (
        <React.Fragment key={b.labelKey}>
          <View style={s.badge}>
            <Ionicons name={b.icon} size={13} color={theme.colors.status.success} />
            <UIText style={s.label}>{t(b.labelKey)}</UIText>
          </View>
          {i < BADGES.length - 1 && <View style={s.dot} />}
        </React.Fragment>
      ))}
    </View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    row: {
      flexDirection:  flexRow(IS_RTL),
      alignItems:     "center",
      justifyContent: "center",
      flexWrap:       "wrap",
      gap:            6,
    },
    badge: {
      flexDirection: flexRow(IS_RTL),
      alignItems:    "center",
      gap:           4,
    },
    label: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           11,
      lineHeight:         15,
      color:              theme.colors.text.muted,
      includeFontPadding: false,
    },
    dot: {
      width:           3,
      height:          3,
      borderRadius:    2,
      backgroundColor: theme.colors.border.default,
    },
  });
}
