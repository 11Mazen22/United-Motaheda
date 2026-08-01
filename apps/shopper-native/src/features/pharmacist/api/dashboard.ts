/**
 * Pharmacist Dashboard API — aggregates stats in parallel.
 *
 * All queries run concurrently via Promise.allSettled so a single
 * slow/failed sub-query doesn't block the entire dashboard. Each
 * failure is silently zeroed — the UI shows a stale "0" rather than
 * an error screen for a minor counter.
 */

import {
  listPharmacistOrderQueue,
  getOrderCountsByDate,
} from "./orders";
import { countPendingPrescriptions } from "./prescriptions";
import { countLowStockProducts }     from "./inventory";
import type { PharmacistDashboardStats } from "./types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch all dashboard stats in one call. Returns zeroes for any
 * sub-query that fails rather than propagating an error.
 */
export async function fetchDashboardStats(): Promise<PharmacistDashboardStats> {
  const [queueResult, rxResult, lowStockResult, todayResult] =
    await Promise.allSettled([
      listPharmacistOrderQueue(),
      countPendingPrescriptions(),
      countLowStockProducts(5),
      getOrderCountsByDate(todayISO()),
    ]);

  const queue = queueResult.status === "fulfilled" ? queueResult.value : [];
  const rx    = rxResult.status    === "fulfilled" ? rxResult.value    : 0;
  const low   = lowStockResult.status === "fulfilled" ? lowStockResult.value : 0;
  const today = todayResult.status === "fulfilled"
    ? todayResult.value
    : { delivered: 0, cancelled: 0 };

  return {
    activeOrders:         queue.length,
    pendingPayment:       queue.filter((o) => o.status === "payment_pending").length,
    preparing:            queue.filter((o) => o.status === "preparing").length,
    ready:                queue.filter((o) => o.status === "ready").length,
    pendingPrescriptions: rx,
    lowStockCount:        low,
    deliveredToday:       today.delivered,
    cancelledToday:       today.cancelled,
  };
}
