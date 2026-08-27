/**
 * Single source of truth for "what can a pharmacist do to this order, and
 * what's the ONE thing they should do next." Used by both the order queue
 * card (a short, intent-communicating label) and the order detail screen's
 * action dock (the full set of valid transitions).
 */

import type { PharmacistOrder, PharmacistTransitionTarget } from "../api/types";
import { getOrderAttentionReason } from "./orderAttention";

export function getPharmacistActionTargets(status: PharmacistOrder["status"]): PharmacistTransitionTarget[] {
  switch (status) {
    case "pending":          return ["verification", "cancelled"];
    case "verification":     return ["payment_pending", "payment_approved", "cancelled"];
    case "payment_pending":  return ["payment_approved", "cancelled"];
    case "payment_approved": return ["preparing", "cancelled"];
    case "preparing":        return ["ready", "cancelled"];
    default:                 return [];
  }
}

export type PrimaryActionKind =
  | "review_order"
  | "review_prescription"
  | "resolve_issue"
  | "verify"
  | "request_payment"
  | "start_preparing"
  | "mark_ready"
  | "view_pickup"
  | "view_details";

/**
 * The one headline action a pharmacist should take next, factoring in both
 * the order's real status AND its derived attention reason (a prescription
 * block can matter more than what stage of the payment/prep pipeline the
 * order is otherwise sitting at).
 */
export function getPrimaryAction(order: PharmacistOrder): PrimaryActionKind {
  const attention = getOrderAttentionReason(order);
  if (attention === "prescription_rejected") return "resolve_issue";
  if (attention === "prescription_pending") return "review_prescription";

  switch (order.status) {
    case "pending":          return "review_order";
    case "verification":     return "verify";
    case "payment_pending":  return "request_payment";
    case "payment_approved": return "start_preparing";
    case "preparing":        return "mark_ready";
    case "ready":             return "view_pickup";
    default:                 return "view_details";
  }
}

export function primaryActionLabelKey(kind: PrimaryActionKind): string {
  switch (kind) {
    case "review_order":         return "pharmacist.actionReviewOrder";
    case "review_prescription":  return "pharmacist.actionReviewPrescriptionShort";
    case "resolve_issue":        return "pharmacist.actionResolveIssue";
    case "verify":                return "pharmacist.actionVerify";
    case "request_payment":      return "pharmacist.actionRequestPayment";
    case "start_preparing":      return "pharmacist.actionStartPreparing";
    case "mark_ready":           return "pharmacist.actionMarkReady";
    case "view_pickup":          return "pharmacist.actionViewPickupStatus";
    case "view_details":         return "pharmacist.actionViewDetails";
  }
}
