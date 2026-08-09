import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@pharmacy/ui-native";
import type { CheckoutPaymentMethod } from "./types";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Payment method catalogue ─────────────────────────────────────────────────

/** Base config for payment methods — i18n keys resolved at render time. */
export const PAYMENT_METHOD_CONFIGS: ReadonlyArray<{
  id:       CheckoutPaymentMethod;
  titleKey: string;
  descKey:  string;
  icon:     IoniconsName;
  color:    string;
  bg:       string;
}> = [
  {
    id:       "cod",
    titleKey: "checkout.methodCodTitle",
    descKey:  "checkout.methodCodDesc",
    icon:     "cash-outline",
    color:    kit.color.success,
    bg:       kit.color.successTint,
  },
  {
    id:       "instapay",
    titleKey: "checkout.methodInstapayTitle",
    descKey:  "checkout.methodInstapayDesc",
    icon:     "flash-outline",
    color:    kit.color.accent,
    bg:       kit.color.accentTint,
  },
  {
    id:       "vodafone",
    titleKey: "checkout.methodVodafoneTitle",
    descKey:  "checkout.methodVodafoneDesc",
    icon:     "wallet-outline",
    // Vodafone's brand red, kept distinct from `kit.color.danger` so a
    // selected card doesn't read as an error state.
    color:    "#C11F30",
    bg:       "#FBEAEC",
  },
];

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
