import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { PAYMENT_METHOD_CONFIGS } from "../constants";
import type { CheckoutPaymentMethod } from "../constants";

const IS_RTL = isRtl();

interface PaymentMethodCardsProps {
  selected:  CheckoutPaymentMethod;
  subtotal:  number;
  onChange:  (m: CheckoutPaymentMethod) => void;
}

export const PaymentMethodCards = React.memo(function PaymentMethodCards({
  selected,
  subtotal,
  onChange,
}: PaymentMethodCardsProps) {
  const { t } = useTranslation();
  const recommended: CheckoutPaymentMethod = subtotal >= 500 ? "instapay" : "cod";

  const methods = PAYMENT_METHOD_CONFIGS.map((cfg) => ({
    ...cfg,
    title:       t(cfg.titleKey),
    description: t(cfg.descKey),
  }));

  return (
    <Animated.View entering={FadeIn.duration(220)} style={s.wrapper}>
      {methods.map((m) => {
        const active = selected === m.id;
        const isRec  = m.id === recommended && !active;

        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            style={[
              s.card,
              active && {
                borderColor:      m.color,
                borderWidth:      1.5,
                borderStartWidth: 4,
                borderStartColor: m.color,
                backgroundColor:  m.bg + "22",
              },
            ]}>

            {/* Recommended badge */}
            {isRec && (
              <View style={[s.badge, { backgroundColor: m.bg, borderColor: m.color + "50" }]}>
                <Ionicons name="star" size={9} color={m.color} />
                <UIText style={[s.badgeText, { color: m.color }]}>
                  {t("checkout.methodRecommended")}
                </UIText>
              </View>
            )}

            {/* Main row */}
            <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>

              {/* Radio circle */}
              <View style={[s.check, active && { backgroundColor: m.color, borderColor: m.color }]}>
                {active && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>

              {/* Brand icon tile */}
              <View style={[s.iconBox, { backgroundColor: m.bg }]}>
                <Ionicons name={m.icon} size={24} color={m.color} />
              </View>

              {/* Label block */}
              <View style={s.textBlock}>
                <UIText style={[s.title, active && { color: m.color }]}>{m.title}</UIText>
                <UIText style={s.sub}>{m.description}</UIText>
              </View>

              {/* Active check pill */}
              {active && (
                <View style={[s.activePill, { backgroundColor: m.bg, borderColor: m.color + "50" }]}>
                  <Ionicons name="checkmark-circle" size={14} color={m.color} />
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
});

const s = StyleSheet.create({
  wrapper: { gap: 10 },

  card: {
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    backgroundColor: kit.color.surface,
    overflow:        "hidden",
  },

  badge: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderBottomWidth: 1,
  },
  badgeText: {
    fontSize:           9,
    fontFamily:         theme.fonts.black,
    letterSpacing:      0.5,
    textAlign:          textAlignStart(IS_RTL),
    includeFontPadding: false,
  },

  row: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 14,
    paddingVertical:   16,
  },

  iconBox: {
    width:          52,
    height:         52,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  textBlock: { flex: 1, gap: 3 },

  title: {
    fontSize:           13,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.ink,
    textAlign:          textAlignStart(IS_RTL),
    includeFontPadding: false,
  },
  sub: {
    fontSize:           11,
    fontFamily:         theme.fonts.regular,
    color:              kit.color.inkFaint,
    textAlign:          textAlignStart(IS_RTL),
    lineHeight:         16,
    includeFontPadding: false,
  },

  check: {
    width:          24,
    height:         24,
    borderRadius:   12,
    borderWidth:    2,
    borderColor:    kit.color.lineStrong,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  activePill: {
    width:          28,
    height:         28,
    borderRadius:   14,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
});
