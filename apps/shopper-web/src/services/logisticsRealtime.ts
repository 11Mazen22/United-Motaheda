/**
 * logisticsRealtime.ts — live sync for the Operations Hub.
 *
 * This is the first realtime subscription this app has ever had on the
 * `orders` table (see database/20260708_delivery_assignments_and_issues.sql,
 * which explicitly adds `orders` to the supabase_realtime publication for
 * exactly this reason). Modeled on the broad, unfiltered table-wide pattern
 * already used by specialOrdersApi.ts's subscribeToSpecialOrderRequests
 * (staff need to see every change, not just their own), rather than the
 * narrow per-user pattern used by the customer/driver notification channels.
 *
 * Kept in its own file, separate from logisticsApi.ts's data-fetch
 * functions, since that file is already large — realtime wiring is a
 * distinct concern (subscribe/unsubscribe lifecycle vs. one-shot fetches).
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

export function subscribeToOrdersBoard(onChange: () => void): RealtimeChannel {
  return getSupabaseClient()
    .channel("ops-orders-board")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => onChange())
    .subscribe();
}

export function subscribeToAssignmentsBoard(onChange: () => void): RealtimeChannel {
  return getSupabaseClient()
    .channel("ops-delivery-assignments")
    .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments" }, () => onChange())
    .subscribe();
}

export function subscribeToIssuesBoard(onChange: () => void): RealtimeChannel {
  return getSupabaseClient()
    .channel("ops-delivery-issues")
    .on("postgres_changes", { event: "*", schema: "public", table: "delivery_issues" }, () => onChange())
    .subscribe();
}

/** Subscribes to all three at once and returns a single teardown function —
 * the shape OperationsHub actually wants (one effect, one cleanup). */
export function subscribeToOperationsBoard(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const channels: RealtimeChannel[] = [
    subscribeToOrdersBoard(onChange),
    subscribeToAssignmentsBoard(onChange),
    subscribeToIssuesBoard(onChange),
  ];
  return () => {
    for (const channel of channels) {
      void supabase.removeChannel(channel);
    }
  };
}
