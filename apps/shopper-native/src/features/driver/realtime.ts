/**
 * Realtime channel subscriptions for the driver section — mirrors
 * features/notifications/realtime.ts's pattern exactly (channel-per-scope,
 * removeChannel on cleanup to avoid stale entries across driverId changes).
 *
 * Two channels because a Supabase realtime `filter` only supports a single
 * column-equality predicate, and assignments/orders are different tables.
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function subscribeToMyAssignments(driverId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`driver-assignments-${driverId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "delivery_assignments", filter: `driver_id=eq.${driverId}` },
      () => onChange(),
    )
    .subscribe();
}

export function subscribeToMyOrders(driverId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`driver-orders-${driverId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `assigned_driver_id=eq.${driverId}` },
      () => onChange(),
    )
    .subscribe();
}
