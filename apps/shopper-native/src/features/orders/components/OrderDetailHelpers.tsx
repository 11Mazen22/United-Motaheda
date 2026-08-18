/**
 * Order Detail — shared helpers, metadata, and sub-components.
 * Extracted from app/order/[id].tsx to keep the screen under 400 lines.
 */
import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text as UIText } from "@pharmacy/ui-native";

import { kit } from "@pharmacy/ui-native";
import { BACK_CHEVRON, textAlignStart, isRtl, valueTextAlign } from "@/utils/layout";
import type { Order, OrderStatus } from "@/stores/orders";
import { styles } from "./order-detail.styles";

const TEXT_START = textAlignStart(isRtl());

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusVariant = "success" | "warning" | "brand" | "error" | "neutral";

export interface TimelineStep {
  key:      string;
  labelKey: string;
  done:     boolean;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
}

// ─── Status metadata ──────────────────────────────────────────────────────────

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { labelKey: string; variant: StatusVariant; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  pending:          { labelKey: "orders.pending",          variant: "warning", icon: "time-outline"             },
  pending_payment:  { labelKey: "orders.pendingPayment",   variant: "warning", icon: "card-outline"             },
  confirmed:        { labelKey: "orders.pending",          variant: "warning", icon: "checkmark-circle-outline" },
  verification:     { labelKey: "orders.processing",       variant: "brand",   icon: "shield-checkmark-outline" },
  payment_pending:  { labelKey: "orders.pendingPayment",   variant: "warning", icon: "card-outline"             },
  payment_approved: { labelKey: "orders.processing",       variant: "brand",   icon: "checkmark-circle-outline" },
  processing:       { labelKey: "orders.processing",       variant: "brand",   icon: "refresh-outline"          },
  preparing:        { labelKey: "orders.processing",       variant: "brand",   icon: "refresh-outline"          },
  ready:            { labelKey: "orders.shipped",          variant: "brand",   icon: "cube-outline"             },
  driver_assigned:  { labelKey: "orders.shipped",          variant: "brand",   icon: "car-outline"              },
  driver_accepted:  { labelKey: "orders.shipped",          variant: "brand",   icon: "car-outline"              },
  out_for_delivery: { labelKey: "orders.shipped",          variant: "brand",   icon: "car-outline"              },
  shipped:          { labelKey: "orders.shipped",          variant: "brand",   icon: "car-outline"              },
  picked_up:        { labelKey: "orders.shipped",          variant: "brand",   icon: "car-outline"              },
  delivered:        { labelKey: "orders.delivered",        variant: "success", icon: "checkmark-circle-outline" },
  cancelled:        { labelKey: "orders.cancelled",        variant: "error",   icon: "close-circle-outline"     },
  archived:         { labelKey: "orders.delivered",        variant: "neutral", icon: "archive-outline"           },
};

export const PAYMENT_METHOD_META: Record<
  string,
  { labelKey: string; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; bg: string }
> = {
  cod:          { labelKey: "checkout.methodCodTitle",      icon: "cash-outline",   color: kit.color.success,    bg: kit.color.successTint },
  online:       { labelKey: "checkout.methodOnlineTitle",   icon: "card-outline",   color: kit.color.accentDeep,  bg: kit.color.accentTint  },
  vodafone:     { labelKey: "checkout.methodVodafoneTitle", icon: "wallet-outline", color: kit.color.danger,      bg: kit.color.dangerTint  },
  instapay:     { labelKey: "checkout.methodInstapayTitle", icon: "flash-outline",  color: kit.color.accent,      bg: kit.color.accentTint  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPaymentMeta(method: string | null) {
  if (!method) return PAYMENT_METHOD_META.cod;
  return PAYMENT_METHOD_META[method] ?? PAYMENT_METHOD_META.cod;
}

export function getPaymentStatusDisplay(
  status: string,
): { labelKey: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"] } {
  switch (status) {
    case "pending_verification":
      return { labelKey: "orders.paymentStatusPendingVerification", color: kit.color.warn,    icon: "hourglass-outline"    };
    case "verified":
    case "paid":
      return { labelKey: "orders.paymentStatusVerified",            color: kit.color.success, icon: "checkmark-circle"     };
    case "failed":
      return { labelKey: "orders.paymentStatusFailed",              color: kit.color.danger,  icon: "close-circle-outline" };
    case "pending":
    default:
      return { labelKey: "orders.paymentStatusPending",             color: kit.color.inkFaint, icon: "time-outline"        };
  }
}

export function buildTimeline(order: Order): TimelineStep[] {
  const isCod    = !order.paymentMethod || order.paymentMethod === "cod";
  const isManual = !isCod;
  const s        = order.status;
  const ps       = order.paymentStatus;

  const done = (check: boolean) => check;

  const base: TimelineStep[] = [
    { key: "placed", labelKey: "orders.stepPlaced", done: true, icon: "bag-check-outline" },
  ];

  if (isManual) {
    base.push(
      { key: "payment_uploaded", labelKey: "orders.stepPaymentUploaded", done: done(["pending_verification","verified","paid"].includes(ps)), icon: "cloud-upload-outline"     },
      { key: "payment_verified", labelKey: "orders.stepPaymentVerified", done: done(["verified","paid"].includes(ps)),                         icon: "shield-checkmark-outline" },
    );
  }

  base.push(
    { key: "processing", labelKey: "orders.stepProcessing", done: done(["confirmed","verification","payment_pending","payment_approved","processing","preparing","ready","driver_assigned","driver_accepted","out_for_delivery","shipped","picked_up","delivered","archived"].includes(s)), icon: "cube-outline"             },
    { key: "shipped",    labelKey: "orders.stepShipped",    done: done(["driver_assigned","driver_accepted","out_for_delivery","shipped","picked_up","delivered","archived"].includes(s)),                                                                                                               icon: "car-outline"              },
    { key: "delivered",  labelKey: "orders.stepDelivered",  done: done(s === "delivered" || s === "archived"),                                                                                                                 icon: "checkmark-circle-outline" },
  );

  if (s === "cancelled") {
    return base
      .filter((step) => ["placed","cancelled_status"].includes(step.key))
      .concat([
        { key: "cancelled_status", labelKey: "orders.stepCancelled", done: true, icon: "close-circle-outline" },
      ]);
  }

  return base;
}

export function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale === "en" ? "en-US" : "ar-EG", {
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function DetailSection({
  title, icon, delay = 0, children,
}: {
  title:    string;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
  delay?:   number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(360)} style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBox}>
          <Ionicons name={icon} size={14} color={kit.color.accentDeep} />
        </View>
        <UIText variant="card-title" style={[styles.sectionTitle, { textAlign: TEXT_START, flex: 1 }]}>
          {title}
        </UIText>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

export function InfoRow({
  label, value, valueColor,
}: {
  label:       string;
  value:       string;
  valueColor?: string;
}): React.ReactElement {
  return (
    <View style={styles.infoRow}>
      <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }}>{label}</UIText>
      {/* Value cell stays LTR — currency totals read canonically in both langs */}
      <UIText
        variant="body-sm"
        weight="bold"
        style={{ color: valueColor ?? kit.color.ink, textAlign: valueTextAlign }}>
        {value}
      </UIText>
    </View>
  );
}

export function HeaderBackButton({ onPress }: { onPress: () => void }): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={styles.backBtn} hitSlop={8} accessibilityRole="button">
      <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
    </Pressable>
  );
}
