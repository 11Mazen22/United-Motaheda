/**
 * orderStatus.ts — canonical order lifecycle, single source of truth.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LIFECYCLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   pending ──────────┬──────────────► confirmed ──► preparing ──► ready ──► picked_up ──► delivered
 *   pending_payment ──┘                    │              │           │            │
 *                                          └──────────────┴───────────┴────────────┴──► cancelled
 *
 * Stage meanings:
 *   pending          Order placed, COD or no payment step required yet.
 *   pending_payment  Order placed with a manual wallet (Vodafone Cash /
 *                    InstaPay); awaiting staff verification of the proof.
 *   confirmed        Payment verified (or COD accepted) — order enters the
 *                    fulfillment queue.
 *   preparing        Pharmacy staff is picking/packing the order.
 *   ready            Packed and staged for dispatch — awaiting a driver.
 *   picked_up        A driver has collected the order and it's en route.
 *   delivered        Terminal — customer received the order.
 *   cancelled        Terminal — reachable from any non-terminal state.
 *
 * Who triggers what (enforced by RLS role checks in the DB, not just UI):
 *   pending → confirmed / preparing   admin, manager (OrdersManager, Ops Hub)
 *   confirmed → preparing             admin, manager, pharmacist
 *   preparing → ready / picked_up     admin, manager, pharmacist
 *   ready → picked_up                 admin, manager, driver (dispatch board)
 *   picked_up → delivered             driver (via scan/manifest completion)
 *   * → cancelled                     admin, manager
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The live Postgres `order_status` enum (public.orders.status) has
 * accumulated 10 labels, because two independent admin surfaces evolved the
 * status vocabulary separately over time:
 *
 *   - OrdersManager.tsx (apps/shopper-web) historically wrote:
 *       pending | processing | shipped | delivered | cancelled
 *   - Operations Hub / logistics board historically wrote the "canonical"
 *     7-value set below via mapLegacyToCanonicalOrderStatus():
 *       pending | confirmed | preparing | ready | picked_up | delivered | cancelled
 *   - The create-order Edge Function additionally writes `pending_payment`
 *     for manual-wallet orders awaiting proof verification.
 *
 * Both "processing"/"preparing" and "shipped"/"picked_up" describe the same
 * real-world state, just spelled differently depending which admin screen
 * produced the write. This file is the ONE place that fact is recorded, so
 * every reader (admin panel, native app, notifications) treats them as
 * equivalent, and every writer converges on the 8 canonical spellings above.
 *
 * "processing" and "shipped" are kept in ORDER_STATUS_VALUES as read-only
 * legacy synonyms — historical rows already use them, and the DB enum still
 * accepts them, but no code should WRITE them going forward.
 */

export const CANONICAL_ORDER_STATUSES = [
  "pending",
  "pending_payment",
  "confirmed",
  "preparing",
  "ready",
  "picked_up",
  "delivered",
  "cancelled",
] as const;

export type CanonicalOrderStatus = (typeof CANONICAL_ORDER_STATUSES)[number];

/** Every label the live DB enum accepts, including legacy write-once synonyms. */
export const ORDER_STATUS_VALUES = [
  ...CANONICAL_ORDER_STATUSES,
  "processing",
  "shipped",
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

const LEGACY_SYNONYMS: Record<string, CanonicalOrderStatus> = {
  processing: "preparing",
  shipped: "picked_up",
  verified: "preparing",
  packed: "ready",
  ready_for_dispatch: "ready",
  out_for_delivery: "picked_up",
  outfordelivery: "picked_up",
  canceled: "cancelled",
  returned: "cancelled",
  failed_delivery: "delivered",
  faileddelivery: "delivered",
};

/** Normalizes any raw status string (current or historical spelling) to one
 * of the 8 canonical values. Unknown/empty input defaults to "pending" —
 * never throws, since this runs on data from an external source. */
export function normalizeOrderStatus(value: string | null | undefined): CanonicalOrderStatus {
  const v = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if ((CANONICAL_ORDER_STATUSES as readonly string[]).includes(v)) {
    return v as CanonicalOrderStatus;
  }
  return LEGACY_SYNONYMS[v] ?? "pending";
}

export const ORDER_STATUS_LABELS: Record<CanonicalOrderStatus, { ar: string; en: string }> = {
  pending: { ar: "في الانتظار", en: "Pending" },
  pending_payment: { ar: "بانتظار تأكيد الدفع", en: "Awaiting payment" },
  confirmed: { ar: "تم التأكيد", en: "Confirmed" },
  preparing: { ar: "قيد التجهيز", en: "Preparing" },
  ready: { ar: "جاهز للتسليم", en: "Ready for pickup" },
  picked_up: { ar: "خارج للتسليم", en: "Out for delivery" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

export function getOrderStatusLabel(status: CanonicalOrderStatus, lang: "ar" | "en"): string {
  return ORDER_STATUS_LABELS[status][lang];
}

/**
 * Single allowed-transition graph. Every admin surface that changes an
 * order's status must consult this before writing — no screen should
 * invent its own rules, and no two screens should disagree about what's
 * legal. Terminal states (delivered, cancelled) have no outgoing edges.
 */
export const ORDER_STATUS_TRANSITIONS: Record<CanonicalOrderStatus, CanonicalOrderStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "picked_up", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function isOrderStatusTransitionAllowed(
  from: CanonicalOrderStatus,
  to: CanonicalOrderStatus,
): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** True once an order can no longer change state. */
export function isOrderStatusTerminal(status: CanonicalOrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}
