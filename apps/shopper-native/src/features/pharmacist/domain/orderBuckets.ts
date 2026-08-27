/**
 * Single bucketing rule shared by WorkbenchScreen (triage snapshot) and
 * OrdersWorkspaceScreen (full searchable workspace) — both screens must
 * agree on what "needs attention" means, or a pharmacist would see an order
 * classified two different ways depending on which screen they're on.
 *
 * An order's bucket is a function of its real status PLUS its derived
 * attention reason (see orderAttention.ts) — a "preparing" order with a
 * still-pending prescription belongs in Needs Attention even though
 * "preparing" is normally an In Progress status.
 */

import type { PharmacistOrder } from "../api/types";
import { orderNeedsAttention } from "./orderAttention";

const ATTENTION_STATUSES: PharmacistOrder["status"][] = ["pending", "verification", "payment_pending"];
const IN_PROGRESS_STATUSES: PharmacistOrder["status"][] = ["payment_approved", "preparing"];

export interface OrderBuckets {
  attention:  PharmacistOrder[];
  inProgress: PharmacistOrder[];
  ready:      PharmacistOrder[];
}

export function bucketOrders(orders: PharmacistOrder[]): OrderBuckets {
  const attention: PharmacistOrder[] = [];
  const inProgress: PharmacistOrder[] = [];
  const ready: PharmacistOrder[] = [];

  for (const order of orders) {
    if (ATTENTION_STATUSES.includes(order.status) || orderNeedsAttention(order)) {
      attention.push(order);
    } else if (IN_PROGRESS_STATUSES.includes(order.status)) {
      inProgress.push(order);
    } else if (order.status === "ready") {
      ready.push(order);
    }
  }

  return { attention, inProgress, ready };
}
