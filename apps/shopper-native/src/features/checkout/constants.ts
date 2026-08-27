import React from "react";
import { Ionicons } from "@expo/vector-icons";
import type { NativeTheme } from "@pharmacy/ui-native";

import type { CheckoutPaymentMethod } from "./types";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Payment method catalogue ─────────────────────────────────────────────────

export interface PaymentMethodConfig {
  id:       CheckoutPaymentMethod;
  titleKey: string;
  descKey:  string;
  icon:     IoniconsName;
  color:    string;
  bg:       string;
}

/** Base config for payment methods — i18n keys resolved at render time.
 *  A function (not a static array) since two of the three colors are
 *  theme-reactive; call from inside a component via
 *  useMemo(() => getPaymentMethodConfigs(theme), [theme]). */
export function getPaymentMethodConfigs(theme: NativeTheme): ReadonlyArray<PaymentMethodConfig> {
  return [
    {
      id:       "cod",
      titleKey: "checkout.methodCodTitle",
      descKey:  "checkout.methodCodDesc",
      icon:     "cash-outline",
      color:    theme.colors.status.success,
      bg:       theme.colors.statusSoft.success.bg,
    },
    {
      id:       "instapay",
      titleKey: "checkout.methodInstapayTitle",
      descKey:  "checkout.methodInstapayDesc",
      icon:     "flash-outline",
      color:    theme.colors.brand.primary,
      bg:       theme.colors.brand.primaryLight,
    },
    {
      id:       "vodafone",
      titleKey: "checkout.methodVodafoneTitle",
      descKey:  "checkout.methodVodafoneDesc",
      icon:     "wallet-outline",
      // Vodafone's brand red, kept distinct from theme.colors.status.error so a
      // selected card doesn't read as an error state.
      color:    "#C11F30",
      bg:       "#FBEAEC",
    },
  ];
}

/** Arabic label for order notes — always Arabic, locale-independent. */
export const PAYMENT_LABEL_AR: Record<CheckoutPaymentMethod, string> = {
  cod:        "الدفع عند الاستلام",
  instapay:   "إنستاباي",
  vodafone:   "فودافون كاش",
  online:     "الدفع الإلكتروني",
  banquemisr: "بنك مصر",
};

export function paymentLabel(id: CheckoutPaymentMethod): string {
  return PAYMENT_LABEL_AR[id] ?? PAYMENT_LABEL_AR.cod;
}

export type { CheckoutPaymentMethod, IoniconsName };
