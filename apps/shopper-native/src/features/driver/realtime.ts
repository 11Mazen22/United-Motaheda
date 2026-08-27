/**
 * Realtime channel subscriptions for the driver section.
 *
 * Two channels because a Supabase realtime `filter` only supports a single
 * column-equality predicate, and assignments/orders are different tables.
 *
 * Both now retry the channel join on CHANNEL_ERROR/TIMED_OUT — mirrors
 * features/notifications/realtime.ts's pattern exactly. Before this fix,
 * both channels called .subscribe() with no status callback at all, so a
 * single flaky connection attempt silently killed live updates for the rest
 * of the driver's session with no error anywhere — the exact bug already
 * found and fixed once in notifications/realtime.ts and auth/context.tsx's
 * profile-role channel, but never ported here.
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface DriverRealtimeSubscription {
  unsubscribe: () => void;
}

function joinWithRetry<T extends { [key: string]: unknown }>(
  channelName: string,
  table: string,
  filter: string,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
): DriverRealtimeSubscription {
  let current: RealtimeChannel | null = null;
  let stopped = false;

  const join = (attempt: number) => {
    if (stopped) return;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload) => onChange(payload as RealtimePostgresChangesPayload<T>),
      )
      .subscribe((status, err) => {
        if (stopped) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (__DEV__) console.warn(`[driver/realtime] ${channelName} ${status}, retrying:`, err?.message);
          supabase.removeChannel(channel);
          const delay = Math.min(30_000, 1_000 * 2 ** attempt);
          setTimeout(() => join(attempt + 1), delay);
        }
      });
    current = channel;
  };

  join(0);

  return {
    unsubscribe: () => {
      stopped = true;
      if (current) supabase.removeChannel(current);
    },
  };
}

export function subscribeToMyAssignments(
  driverId: string,
  onChange: (orderId: string | undefined) => void,
): DriverRealtimeSubscription {
  return joinWithRetry<{ order_id?: string }>(
    `driver-assignments-${driverId}`,
    "delivery_assignments",
    `driver_id=eq.${driverId}`,
    (payload) => onChange((payload.new as { order_id?: string } | null)?.order_id ?? (payload.old as { order_id?: string } | null)?.order_id),
  );
}

export function subscribeToMyOrders(
  driverId: string,
  onChange: (orderId: string | undefined) => void,
): DriverRealtimeSubscription {
  return joinWithRetry<{ id?: string }>(
    `driver-orders-${driverId}`,
    "orders",
    `assigned_driver_id=eq.${driverId}`,
    (payload) => onChange((payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id),
  );
}
