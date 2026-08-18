import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { PAYMENT_METHOD_CONFIGS } from "../constants";
import type { CheckoutPaymentMethod } from "../constants";

const IS_RTL = isRtl();

interface PaymentOptionsListProps {
  selected:     CheckoutPaymentMethod;
  onChange:     (m: CheckoutPaymentMethod) => void;
  /** Payment method to badge as "recommended" — omit to show no badge. */
  recommended?: CheckoutPaymentMethod | null;
}

/**
 * Single source of truth for the payment-method radio list — shared by the
 * checkout details step and the review step so there's exactly one
 * implementation of this UI to reason about and test.
 */
export const PaymentOptionsList = React.memo(function PaymentOptionsList({
  selected,
  onChange,
  recommended = null,
}: PaymentOptionsListProps) {
  const { t } = useTranslation();

  const methods = PAYMENT_METHOD_CONFIGS.map((cfg) => ({
    ...cfg,
    title:       t(cfg.titleKey),
    description: t(cfg.descKey),
  }));

  return (
    <View style={s.wrap}>
      {methods.map((m) => {
        const active = selected === m.id;
        const isRec  = recommended === m.id && !active;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={m.title}
            style={[
              s.payOption,
              active && {
                borderColor:     m.color,
                borderWidth:     1.5,
                backgroundColor: m.bg,
                ...kit.shadow.card,
              },
            ]}>
            {isRec && (
              <View style={[s.badge, { backgroundColor: m.bg, borderColor: m.color }]}>
                <Ionicons name="star" size={9} color={m.color} />
                <UIText style={[s.badgeText, { color: m.color }]}>
                  {t("checkout.methodRecommended")}
                </UIText>
              </View>
            )}
            <View style={[s.payRow, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={[s.payRadio, active && { borderColor: m.color }]}>
                {active && <View style={[s.payRadioDot, { backgroundColor: m.color }]} />}
              </View>
              <View style={[s.payIcon, { backgroundColor: active ? "#fff" : m.bg }]}>
                <Ionicons name={m.icon} size={18} color={m.color} />
              </View>
              <View style={{ flex: 1 }}>
                <UIText style={[s.payTitle, active && { color: m.color }]}>{m.title}</UIText>
                <UIText style={s.paySub}>{m.description}</UIText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: 10 },

  payOption: {
    borderRadius:    14,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    backgroundColor: "#fff",
  },
  payRow: {
    alignItems:        "center",
    gap:               10,
    padding:           12,
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

  payRadio: {
    width:          18,
    height:         18,
    borderRadius:   9,
    borderWidth:    2,
    borderColor:    kit.color.inkFaint,
    alignItems:     "center",
    justifyContent: "center",
  },
  payRadioDot: { width: 8, height: 8, borderRadius: 4 },
  payIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  payTitle: {
    fontSize:   12,
    fontFamily: theme.fonts.bold,
    color:      kit.color.ink,
    textAlign:  textAlignStart(IS_RTL),
  },
  paySub: {
    fontSize:   10,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(IS_RTL),
  },
});
