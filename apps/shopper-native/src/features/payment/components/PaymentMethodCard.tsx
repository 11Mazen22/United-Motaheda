import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

import type { PaymentMethod } from "../types";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL = isRtl();

interface Props {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}

export function PaymentMethodCard({ method, selected, onSelect }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const TYPE_COLORS: Record<string, { accent: string; bg: string }> = useMemo(() => ({
    cod:           { accent: theme.colors.status.success, bg: `${theme.colors.status.success}1A` },
    instapay:      { accent: "#7c3aed",         bg: "#f5f3ff"             },
    vodafone_cash: { accent: theme.colors.status.error,  bg: `${theme.colors.status.error}1A`  },
  }), [theme]);
  const { t } = useTranslation();
  const colors = TYPE_COLORS[method.type] ?? TYPE_COLORS.cod;
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    scale.value = withSpring(0.97, { damping: 18, stiffness: 400 });
    setTimeout(() => { scale.value = withSpring(1, { damping: 14, stiffness: 300 }); }, 100);
    onSelect();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={t(method.labelKey)}
        style={styles.touchable}>
        {({ pressed }) => (
          <View
            style={[
              styles.card,
              selected && {
                borderColor:      colors.accent,
                borderWidth:      1.5,
                borderStartWidth: 4,
                borderStartColor: colors.accent,
                backgroundColor:  colors.bg,
                ...theme.shadows[1],
              },
              pressed && styles.cardPressed,
            ]}>
            <View style={[styles.row, { flexDirection: flexRow(IS_RTL) }]}>

              {/* Radio circle */}
              <View style={[styles.check, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                {selected && (
                  <Animated.View entering={FadeIn.duration(120)}>
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </Animated.View>
                )}
              </View>

              {/* Icon tile */}
              <View style={[styles.iconWrap, { backgroundColor: selected ? "#fff" : colors.bg }]}>
                <Ionicons name={method.icon as IoniconsName} size={22} color={colors.accent} />
              </View>

              {/* Text */}
              <View style={styles.textWrap}>
                <UIText style={[styles.label, selected && { color: colors.accent }]}>
                  {t(method.labelKey)}
                </UIText>
                <UIText style={styles.desc}>{t(method.descKey)}</UIText>
                {method.phone && (
                  <View style={[styles.phoneRow, { flexDirection: flexRow(IS_RTL) }]}>
                    <Ionicons name="call-outline" size={12} color={colors.accent} />
                    <UIText style={styles.phoneText}>{method.phone}</UIText>
                  </View>
                )}

                {/* Security badge */}
                {selected && (
                  <Animated.View entering={FadeIn.duration(200)} style={[styles.secureBadge, { flexDirection: flexRow(IS_RTL) }]}>
                    <Ionicons name="shield-checkmark" size={10} color={theme.colors.status.success} />
                    <UIText style={styles.secureText}>{t("payment.secure")}</UIText>
                  </Animated.View>
                )}
              </View>
            </View>
          </View>
        )}
      </Pressable>

      {/* Expanded details when selected */}
      {selected && method.detailsKey && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.detailsCard}>
          <View style={[styles.detailRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="information-circle-outline" size={14} color={theme.colors.text.muted} />
            <UIText style={styles.detailText}>{t(method.detailsKey)}</UIText>
          </View>
          {method.phone && (
            <View style={[styles.detailRow, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="call-outline" size={14} color={colors.accent} />
              <UIText style={[styles.detailText, { color: colors.accent, fontFamily: legacyTheme.fonts.bold }]}>
                {method.phone}
              </UIText>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    touchable: {
      borderRadius: 16,
    },
    card: {
      borderRadius:    16,
      borderWidth:     1.5,
      borderColor:     theme.colors.border.default,
      backgroundColor: theme.colors.canvas.surface,
      overflow:        "hidden",
    },
    cardPressed: {
      opacity: 0.92,
    },
    row: {
      alignItems:        "center",
      gap:               14,
      paddingHorizontal: 16,
      paddingVertical:   16,
    },
    // Radio circle — Stripe / Apple Pay style
    check: {
      width:          22,
      height:         22,
      borderRadius:   11,
      borderWidth:    2,
      borderColor:    theme.colors.border.strong,
      alignItems:     "center",
      justifyContent: "center",
      flexShrink:     0,
    },
    iconWrap: {
      width:          48,
      height:         48,
      borderRadius:   16,
      alignItems:     "center",
      justifyContent: "center",
      flexShrink:     0,
    },
    textWrap: {
      flex: 1,
      gap:  2,
    },
    label: {
      fontSize:           14,
      fontFamily:         legacyTheme.fonts.bold,
      color:              theme.colors.text.primary,
      textAlign:          textAlignStart(IS_RTL),
      includeFontPadding: false,
    },
    desc: {
      fontSize:           11,
      fontFamily:         legacyTheme.fonts.regular,
      color:              theme.colors.text.muted,
      textAlign:          textAlignStart(IS_RTL),
      includeFontPadding: false,
    },
    phoneRow: {
      alignItems: "center",
      gap:        6,
      marginTop:  4,
    },
    phoneText: {
      fontSize:           11,
      fontFamily:         legacyTheme.fonts.semibold,
      color:              theme.colors.text.secondary,
      textAlign:          textAlignStart(IS_RTL),
      includeFontPadding: false,
    },
    secureBadge: {
      alignSelf:         "flex-start",
      alignItems:        "center",
      gap:               3,
      marginTop:         4,
      backgroundColor:   `${theme.colors.status.success}1A`,
      paddingHorizontal: 7,
      paddingVertical:   3,
      borderRadius:      999,
    },
    secureText: {
      fontSize:           9,
      fontFamily:         legacyTheme.fonts.bold,
      color:              theme.colors.status.success,
      includeFontPadding: false,
    },
    detailsCard: {
      marginTop:   6,
      marginStart: 62,   // aligns under the icon tile (radio 22 + gap 14 + icon 48 = 84 minus card padding 16 -> visually under text)
      padding:     12,
      borderRadius: 14,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      gap:         8,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    detailRow: {
      alignItems: "center",
      gap:        8,
    },
    detailText: {
      flex:               1,
      fontSize:           11,
      fontFamily:         legacyTheme.fonts.semibold,
      color:              theme.colors.text.secondary,
      textAlign:          textAlignStart(IS_RTL),
      includeFontPadding: false,
    },
  });
}
