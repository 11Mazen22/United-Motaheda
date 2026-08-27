/**
 * Derived "does this order need attention, and why" signal.
 *
 * Deliberately NOT a new order_status value — the backend state machine
 * (supabase/migrations/20260716100000_platform_canonical_pricing_and_lifecycle.sql)
 * has no "blocked" status, and adding one would mean an enum migration plus
 * teaching transition_order about it for no real benefit. A prescription
 * block is orthogonal to where an order sits in the payment/preparation
 * pipeline — an order can be "payment_approved" (a real status) AND
 * "waiting on prescription review" (a fact about its linked prescriptions)
 * at the same time. This computes that second, cross-cutting fact from data
 * the order already carries, so the UI can surface it without the backend
 * ever needing to model a fake duplicate state.
 */

import type { PharmacistOrder } from "../api/types";

export type OrderAttentionReason =
  | "prescription_rejected"
  | "prescription_pending"
  | null;

export function getOrderAttentionReason(order: PharmacistOrder): OrderAttentionReason {
  if (order.linkedPrescriptions.some((p) => p.reviewStatus === "rejected")) return "prescription_rejected";
  if (order.linkedPrescriptions.some((p) => p.reviewStatus === "pending_review")) return "prescription_pending";
  return null;
}

export function orderNeedsAttention(order: PharmacistOrder): boolean {
  return getOrderAttentionReason(order) !== null;
}
