/**
 * statusMap — Order Status → Display Token Mapper (V3)
 *
 * Resolves an order status string into a display-ready object containing:
 *   label  — localised human-readable string (via i18n TFunction)
 *   tone   — semantic colour role consumed by TodayCare and order screens
 *   icon   — Ionicons icon name reflecting the order lifecycle stage
 *
 * Why a separate mapper (not inline in the component)?
 * ─────────────────────────────────────────────────────
 * Keeps the component layer free of status logic.  New statuses only need
 * a single entry here; the UI automatically inherits the right colour + icon.
 *
 * TFunction overload:
 *   mapOrderStatus(status, t)   — localised label (primary usage)
 *   mapOrderStatus(status)      — English fallback label (legacy / tests)
 */

import type { TFunction } from "i18next";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderTone =
  | "neutral"
  | "info"
  | "brand"
  | "success"
  | "warning"
  | "error";

type IoniconsName =
  | "checkmark-circle"
  | "checkmark-circle-outline"
  | "bicycle"
  | "cube-outline"
  | "hourglass-outline"
  | "time-outline"
  | "close-circle"
  | "alert-circle"
  | "refresh-circle"
  | "bag-check-outline"
  | "receipt-outline";

export interface OrderStatusView {
  label: string;
  tone:  OrderTone;
  icon:  IoniconsName;
}

// ─── Status definitions ───────────────────────────────────────────────────────

const STATUS_MAP: Record<
  string,
  { fallback: string; tone: OrderTone; icon: IoniconsName }
> = {
  delivered: {
    fallback: "Delivered",
    tone:     "success",
    icon:     "checkmark-circle",
  },
  completed: {
    fallback: "Completed",
    tone:     "success",
    icon:     "bag-check-outline",
  },
  out_for_delivery: {
    fallback: "Out for Delivery",
    tone:     "brand",
    icon:     "bicycle",
  },
  driver_assigned: {
    fallback: "Driver Assigned",
    tone:     "brand",
    icon:     "bicycle",
  },
  driver_accepted: {
    fallback: "Driver Accepted",
    tone:     "brand",
    icon:     "bicycle",
  },
  on_the_way: {
    fallback: "On the Way",
    tone:     "brand",
    icon:     "bicycle",
  },
  shipped: {
    fallback: "Shipped",
    tone:     "info",
    icon:     "bicycle",
  },
  processing: {
    fallback: "Processing",
    tone:     "info",
    icon:     "hourglass-outline",
  },
  confirmed: {
    fallback: "Confirmed",
    tone:     "info",
    icon:     "cube-outline",
  },
  verification: {
    fallback: "Verification",
    tone:     "warning",
    icon:     "hourglass-outline",
  },
  payment_approved: {
    fallback: "Payment Approved",
    tone:     "success",
    icon:     "checkmark-circle",
  },
  preparing: {
    fallback: "Preparing",
    tone:     "info",
    icon:     "hourglass-outline",
  },
  packed: {
    fallback: "Packed",
    tone:     "info",
    icon:     "cube-outline",
  },
  ready: {
    fallback: "Ready for Pickup",
    tone:     "brand",
    icon:     "bag-check-outline",
  },
  ready_for_pickup: {
    fallback: "Ready for Pickup",
    tone:     "brand",
    icon:     "bag-check-outline",
  },
  picked_up: {
    fallback: "Out for Delivery",
    tone:     "brand",
    icon:     "bicycle",
  },
  pending: {
    fallback: "Pending",
    tone:     "warning",
    icon:     "time-outline",
  },
  pending_payment: {
    fallback: "Payment Pending",
    tone:     "warning",
    icon:     "time-outline",
  },
  payment_pending: {
    fallback: "Payment Pending",
    tone:     "warning",
    icon:     "time-outline",
  },
  cancelled: {
    fallback: "Cancelled",
    tone:     "error",
    icon:     "close-circle",
  },
  failed: {
    fallback: "Failed",
    tone:     "error",
    icon:     "alert-circle",
  },
  refunded: {
    fallback: "Refunded",
    tone:     "neutral",
    icon:     "refresh-circle",
  },
  archived: {
    fallback: "Archived",
    tone:     "neutral",
    icon:     "receipt-outline",
  },
};

const UNKNOWN_VIEW = {
  tone: "neutral" as OrderTone,
  icon: "receipt-outline" as IoniconsName,
};

const STATUS_I18N_KEY: Record<string, string> = {
  delivered:         "orders.statusDelivered",
  completed:         "orders.statusCompleted",
  out_for_delivery:  "orders.statusOutForDelivery",
  driver_assigned:   "orders.statusOutForDelivery",
  driver_accepted:   "orders.statusOutForDelivery",
  on_the_way:        "orders.statusOnTheWay",
  shipped:           "orders.statusShipped",
  processing:        "orders.statusProcessing",
  preparing:         "orders.statusProcessing",
  confirmed:         "orders.statusConfirmed",
  verification:      "orders.statusProcessing",
  payment_approved:  "orders.statusConfirmed",
  packed:            "orders.statusPacked",
  ready:             "orders.statusReadyForPickup",
  ready_for_pickup:  "orders.statusReadyForPickup",
  picked_up:         "orders.statusOutForDelivery",
  pending:           "orders.statusPending",
  pending_payment:   "orders.statusPaymentPending",
  payment_pending:   "orders.statusPaymentPending",
  cancelled:         "orders.statusCancelled",
  failed:            "orders.statusFailed",
  refunded:          "orders.statusRefunded",
  archived:          "orders.statusDelivered",
};

export function mapOrderStatus(
  status: string,
  t?: TFunction,
): OrderStatusView {
  const norm = (status ?? "").toLowerCase().replace(/\s+/g, "_");
  const def  = STATUS_MAP[norm];

  if (!def) {
    return {
      label: t ? t("orders.statusUnknown", { defaultValue: status }) : status,
      ...UNKNOWN_VIEW,
    };
  }

  const i18nKey = STATUS_I18N_KEY[norm];
  const label =
    t && i18nKey
      ? t(i18nKey, { defaultValue: def.fallback })
      : def.fallback;

  return {
    label,
    tone: def.tone,
    icon: def.icon,
  };
}
