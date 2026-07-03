import React from "react";
import { StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { usePaymentStore } from "../store";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";

interface Props {
  compact?: boolean;
}

export function PaymentMethodSelector({ compact }: Props) {
  const { t } = useTranslation();
  const methods = usePaymentStore((s) => s.methods);
  const selected = usePaymentStore((s) => s.selected);
  const setSelected = usePaymentStore((s) => s.setSelected);

  return (
    <View style={styles.container}>
      {!compact && (
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark-outline" size={14} color={kit.color.accent} />
          </View>
          <View>
            <UIText style={styles.headerTitle}>{t("payment.paymentMethod")}</UIText>
            <UIText style={styles.headerDesc}>{t("payment.selectMethod")}</UIText>
          </View>
        </View>
      )}

      <View style={styles.list}>
        {methods.filter((m) => m.is_active).map((method, index) => (
          <Animated.View key={method.id} entering={FadeInDown.delay(index * 70).duration(250)}>
            <PaymentMethodCard
              method={method}
              selected={selected === method.type}
              onSelect={() => setSelected(method.type)}
            />
          </Animated.View>
        ))}
      </View>

      {/* Trust footer */}
      {!compact && (
        <Animated.View entering={FadeInDown.delay(250).duration(250)} style={styles.trustRow}>
          <Ionicons name="lock-closed" size={12} color={theme.colors.slate[400]} />
          <UIText style={styles.trustText}>{t("payment.allTransactionsSecure")}</UIText>
          <Ionicons name="shield-checkmark" size={12} color={theme.colors.green[500]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  header: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: kit.color.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: theme.fonts.black,
    color: theme.colors.text.primary,
    textAlign: textAlignStart(isRtl()),
  },
  headerDesc: {
    fontSize: 11,
    fontFamily: theme.fonts.regular,
    color: theme.colors.slate[400],
    textAlign: textAlignStart(isRtl()),
  },
  list: { gap: 10 },
  trustRow: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.slate[50],
  },
  trustText: {
    fontSize: 10,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[400],
  },
});
