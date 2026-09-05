import { getDeliveryStage, getStageAction, type DeliveryStage } from "./deliveryStage";
import type { ManifestOrder } from "../api";
import { getStagePriority } from "./driverMetrics";

export const STAGE_COLORS: Record<DeliveryStage, string> = {
  to_pharmacy: "#3B82F6",
  at_pharmacy: "#F59E0B",
  to_customer: "#8B5CF6",
  at_customer: "#10B981",
  delivered: "#6B7280",
  unknown: "#9CA3AF",
};

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  to_pharmacy: "Heading to pharmacy",
  at_pharmacy: "At the pharmacy",
  to_customer: "On the way",
  at_customer: "Arrived at destination",
  delivered: "Delivered",
  unknown: "Awaiting update",
};

export const STAGE_ICONS: Record<DeliveryStage, string> = {
  to_pharmacy: "navigate",
  at_pharmacy: "cube",
  to_customer: "car",
  at_customer: "location",
  delivered: "checkmark-done",
  unknown: "help",
};

export function isTerminalStage(stage: DeliveryStage): boolean {
  return stage === "delivered";
}

export function getNextAction(stage: DeliveryStage, assignmentKind?: string): {
  stage: DeliveryStage;
  label: string;
  icon: string;
  color: string;
  priority: number;
} {
  const action = getStageAction(stage, assignmentKind);
  return {
    stage,
    label: action.fallback,
    icon: STAGE_ICONS[stage],
    color: STAGE_COLORS[stage],
    priority: getStagePriority(stage),
  };
}

export function sortByUrgency(orders: ManifestOrder[]): ManifestOrder[] {
  return [...orders].sort((a, b) => {
    const stageA = getDeliveryStage(a.status, {
      assignmentKind: a.assignmentKind,
      arrivedAtPharmacy: a.arrivedAtPharmacy,
      pickedUpAt: a.pickedUpAt,
      arrivedAtCustomer: a.arrivedAtCustomer,
    });
    const stageB = getDeliveryStage(b.status, {
      assignmentKind: b.assignmentKind,
      arrivedAtPharmacy: b.arrivedAtPharmacy,
      pickedUpAt: b.pickedUpAt,
      arrivedAtCustomer: b.arrivedAtCustomer,
    });
    return getStagePriority(stageA) - getStagePriority(stageB);
  });
}
