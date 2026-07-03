import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { isRtl, textAlignStart } from "@/utils/layout";
import { theme } from "@/shared/theme";
import type { PaymentMethod } from "../types";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}

const TYPE_COLORS: Record<string, { accent: string; bg: string; ring: string }> = {
  cod:           { accent: theme.colors.green[600],  bg: theme.colors.green[50],  ring: theme.colors.green[200] },
  instapay:      { accent: theme.colors.purple[600], bg: theme.colors.purple[50], ring: theme.colors.purple[200] },
  vodafone_cash: { accent: theme.colors.red[500],    bg: theme.colors.red[50],    ring: theme.colors.red[200] },
};

export function PaymentMethodCard({ method, selected, onSelect }: Props) {
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
        style={[
          styles.card,
          selected && {
            borderColor:     colors.ring,
            borderWidth:     2,
            backgroundColor: colors.bg + "50",
          },
        ]}>
        {/* Checkmark indicator — solid circle, Stripe / Apple Pay aesthetic */}
        <View style={[
          styles.checkCircle,
          selected
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { backgroundColor: "transparent", borderColor: theme.colors.slate[300] },
        ]}>
          {selected && (
            <Animated.View entering={FadeIn.duration(120)}>
              <Ionicons name="checkmark" size={13} color="#fff" />
            </Animated.View>
          )}
        </View>

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.bg }]}>
          <Ionicons name={method.icon as IoniconsName} size={20} color={colors.accent} />
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <UIText style={[styles.label, selected && { color: theme.colors.text.primary, fontFamily: theme.fonts.black }]}>
            {t(method.labelKey)}
          </UIText>
          <UIText style={styles.desc}>{t(method.descKey)}</UIText>
          {method.phone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={12} color={colors.accent} />
              <UIText style={styles.phoneText}>{method.phone}</UIText>
            </View>
          )}

          {/* Security badge */}
          {selected && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.secureBadge}>
              <Ionicons name="shield-checkmark" size={10} color={theme.colors.green[600]} />
              <UIText style={styles.secureText}>{t("payment.secure")}</UIText>
            </Animated.View>
          )}
        </View>
      </Pressable>

      {/* Expanded details when selected */}
      {selected && method.detailsKey && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Ionicons name="information-circle-outline" size={14} color={theme.colors.slate[400]} />
            <UIText style={styles.detailText}>{t(method.detailsKey)}</UIText>
          </View>
          {method.phone && (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={14} color={colors.accent} />
              <UIText style={[styles.detailText, { color: colors.accent, fontFamily: theme.fonts.bold }]}>
                {method.phone}
              </UIText>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",      // RTL system auto-mirrors
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: theme.colors.border.hairline,
    ...theme.shadow.sm,
  },
  // Solid checkmark circle — Stripe / Apple Pay style
  checkCircle: {
    width:          22,
    height:         22,
    borderRadius:   11,
    borderWidth:    2,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[700],
    textAlign: textAlignStart(isRtl()),
  },
  desc: {
    fontSize: 11,
    fontFamily: theme.fonts.regular,
    color: theme.colors.slate[400],
    textAlign: textAlignStart(isRtl()),
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[600],
    textAlign: textAlignStart(isRtl()),
  },
  secureBadge: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    backgroundColor: theme.colors.green[50],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  secureText: {
    fontSize: 9,
    fontFamily: theme.fonts.bold,
    color: theme.colors.green[700],
  },
  detailsCard: {
    marginTop: 6,
    marginEnd: 32,   // RTL-aware: logical "end" margin instead of physical right
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.slate[50],
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  detailRow: {
    flexDirection: "row",    // RTL system handles reversal; no need for row-reverse
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[500],
    textAlign: textAlignStart(isRtl()),
  },
});
