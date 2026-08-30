/**
 * Single source of truth for "where is this delivery, and what does the
 * driver do next" — derived from the same two facts everywhere: the
 * order's canonical backend status, and the accepted assignment's own
 * milestone timestamps (arrived_at_pharmacy/picked_up_at/arrived_at_customer).
 *
 * Before this existed, three places independently re-derived the same
 * thing with slightly different logic: DeliveryExecutionScreen's four
 * separate canX booleans, OrderCardNew's own ad-hoc primaryAction chain,
 * and nothing agreeing on what "the current stage" even means as a single
 * value. Consolidating it here means the manifest list, its cards, and the
 * full execution screen always show the exact same next action for the
 * exact same order — and a new stage only needs to be taught to this one
 * function, not re-implemented three times.
 *
 * The backend (transition_order / mark_delivery_arrival) remains the only
 * authority that actually enforces valid transitions — this module only
 * decides what the UI should show/offer given already-authoritative state.
 */
import type { Order } from "@/stores/orders";

export type DeliveryStage =
  | "to_pharmacy"    // accepted, not yet arrived at the pharmacy
  | "at_pharmacy"    // arrived, pickup not yet confirmed
  | "to_customer"    // picked up, en route, not yet arrived
  | "at_customer"    // arrived at customer, not yet marked delivered
  | "delivered"      // done
  | "unknown";       // any other order status (offer not yet accepted, cancelled, etc.)

export interface AssignmentMilestones {
  assignmentKind?: string;
  arrivedAtPharmacy: string | null;
  pickedUpAt: string | null;
  arrivedAtCustomer: string | null;
}

export function getDeliveryStage(
  orderStatus: Order["status"],
  assignment: AssignmentMilestones | null | undefined,
): DeliveryStage {
  if (assignment?.assignmentKind === "return_pickup") {
    // Return flow: Customer -> Pharmacy
    if (assignment.arrivedAtPharmacy) return "delivered"; // Or 'completed'
    if (assignment.pickedUpAt) return "to_pharmacy"; // Heading back
    if (assignment.arrivedAtCustomer) return "at_customer"; // Arrived at customer, waiting to pick up
    return "to_customer"; // Heading to customer to pick up
  }

  if (orderStatus === "delivered" || orderStatus === "archived") return "delivered";
  if (orderStatus === "out_for_delivery") {
    return assignment?.arrivedAtCustomer ? "at_customer" : "to_customer";
  }
  if (orderStatus === "ready" || orderStatus === "driver_accepted") {
    return assignment?.arrivedAtPharmacy ? "at_pharmacy" : "to_pharmacy";
  }
  return "unknown";
}

export interface StageAction {
  kind: "arrive_pharmacy" | "confirm_pickup" | "arrive_customer" | "complete" | "none";
  labelKey: string;
  fallback: string;
  icon: "location" | "cube-outline" | "checkmark-circle" | "checkmark-done-outline";
}

const STAGE_ACTIONS: Record<DeliveryStage, StageAction> = {
  to_pharmacy: { kind: "arrive_pharmacy", labelKey: "driver.arrivedAtPharmacy", fallback: "Arrived at pharmacy", icon: "location" },
  at_pharmacy: { kind: "confirm_pickup", labelKey: "driver.confirmPickup", fallback: "Confirm pickup", icon: "cube-outline" },
  to_customer: { kind: "arrive_customer", labelKey: "driver.arrivedAtCustomer", fallback: "Arrived at customer", icon: "location" },
  at_customer: { kind: "complete", labelKey: "driver.markDelivered", fallback: "Mark delivered", icon: "checkmark-circle" },
  delivered:   { kind: "none", labelKey: "driver.deliveredTitle", fallback: "Delivered", icon: "checkmark-done-outline" },
  unknown:     { kind: "none", labelKey: "driver.noActionNeeded", fallback: "No action needed right now", icon: "checkmark-done-outline" },
};

const RETURN_STAGE_ACTIONS: Record<DeliveryStage, StageAction> = {
  to_customer: { kind: "arrive_customer", labelKey: "driver.arrivedAtCustomer", fallback: "Arrived at customer", icon: "location" },
  at_customer: { kind: "confirm_pickup", labelKey: "driver.confirmPickup", fallback: "Confirm pickup", icon: "cube-outline" },
  to_pharmacy: { kind: "arrive_pharmacy", labelKey: "driver.arrivedAtPharmacy", fallback: "Arrived at pharmacy", icon: "location" },
  at_pharmacy: { kind: "complete", labelKey: "driver.handoverToPharmacy", fallback: "Handover to pharmacy", icon: "checkmark-circle" },
  delivered:   { kind: "none", labelKey: "driver.completedTitle", fallback: "Completed", icon: "checkmark-done-outline" },
  unknown:     { kind: "none", labelKey: "driver.noActionNeeded", fallback: "No action needed right now", icon: "checkmark-done-outline" },
};

export function getStageAction(stage: DeliveryStage, assignmentKind?: string): StageAction {
  if (assignmentKind === "return_pickup") {
    return RETURN_STAGE_ACTIONS[stage];
  }
  return STAGE_ACTIONS[stage];
}

/** Short "where things stand" label for compact list rows — distinct from
 * the next-action label above (e.g. "Heading to pharmacy" vs. the button
 * text "Arrived at pharmacy"). */
const STAGE_STATUS_LABEL_KEYS: Record<DeliveryStage, { key: string; fallback: string }> = {
  to_pharmacy: { key: "driver.stageToPharmacy", fallback: "Heading to pharmacy" },
  at_pharmacy: { key: "driver.stageAtPharmacy", fallback: "At the pharmacy" },
  to_customer: { key: "driver.stageToCustomer", fallback: "On the way" },
  at_customer: { key: "driver.stageAtCustomer", fallback: "Arrived at destination" },
  delivered:   { key: "driver.deliveredTitle", fallback: "Delivered" },
  unknown:     { key: "driver.noActionNeeded", fallback: "Awaiting update" },
};

const RETURN_STAGE_STATUS_LABEL_KEYS: Record<DeliveryStage, { key: string; fallback: string }> = {
  to_customer: { key: "driver.stageToCustomer", fallback: "Heading to pickup" },
  at_customer: { key: "driver.stageAtCustomer", fallback: "At customer location" },
  to_pharmacy: { key: "driver.stageToPharmacy", fallback: "Returning to pharmacy" },
  at_pharmacy: { key: "driver.stageAtPharmacy", fallback: "At pharmacy" },
  delivered:   { key: "driver.completedTitle", fallback: "Completed" },
  unknown:     { key: "driver.noActionNeeded", fallback: "Awaiting update" },
};

export function getStageStatusLabel(stage: DeliveryStage, assignmentKind?: string): { key: string; fallback: string } {
  if (assignmentKind === "return_pickup") {
    return RETURN_STAGE_STATUS_LABEL_KEYS[stage];
  }
  return STAGE_STATUS_LABEL_KEYS[stage];
}
