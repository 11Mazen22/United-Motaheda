/**
 * Realtime subscriptions for customer-facing order tracking.
 *
 * subscribeToOrderTracking() subscribes to INSERT events on
 * public.driver_locations filtered by order_id, so the TrackOrderScreen
 * invalidates its TanStack Query cache entry immediately when the driver
 * posts a new location ping — without waiting for the 20 s polling interval.
 *
 * Architecture mirrors notifications/realtime.ts exactly:
 *   - One channel per order_id (channel name includes the id to avoid
 *     cross-order event leakage and to allow multiple concurrent subscriptions
 *     from different screens without collision).
 *   - Exponential-backoff retry on CHANNEL_ERROR / TIMED_OUT.
 *   - `stopped` flag guards against a retry's setTimeout firing after the
 *     caller has already unsubscribed (same race condition fixed in
 *     notifications/realtime.ts, 2026-07-08).
 *   - Returns a stable handle (not the raw RealtimeChannel) so a retry that
 *     swaps in a new channel object does not leave the caller holding a
 *     stale reference.
 *
 * RLS note:
 *   The migration (20260727120000_driver_locations.sql) adds driver_locations
 *   to the supabase_realtime publication and creates the policy
 *   "driver_locations: customer select own order" which allows
 *   `user_id = auth.uid()` via the orders join. Supabase Realtime
 *   evaluates RLS on postgres_changes events, so only the customer whose
 *   order matches the filter will receive the event — no client-side
 *   filtering is needed.
 *
 * Usage (from TrackOrderScreen):
 *   const sub = subscribeToOrderTracking(orderId, () => {
 *     void queryClient.invalidateQueries({ queryKey: [...] });
 *   });
 *   // on unmount:
 *   sub.unsubscribe();
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderTrackingSubscription {
  unsubscribe: () => void;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Subscribe to INSERT events on driver_locations for a single order.
 * Calls `onNewPing` each time the driver posts a location update.
 * Retries the channel join with exponential backoff on failure.
 */
export function subscribeToOrderTracking(
  orderId:    string,
  onNewPing:  () => void,
): OrderTrackingSubscription {
  let current: RealtimeChannel | null = null;
  let stopped = false;

  const join = (attempt: number) => {
    if (stopped) return;

    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "driver_locations",
          filter: `order_id=eq.${orderId}`,
        },
        () => onNewPing(),
      )
      .subscribe((status, err) => {
        if (stopped) return;

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (__DEV__) {
            console.warn(
              `[orders/realtime] driver_locations channel ${status} for order ${orderId}, retrying:`,
              err?.message,
            );
          }
          // Remove the failed channel before creating a new one so Supabase
          // does not accumulate stale subscriptions — same pattern used in
          // notifications/realtime.ts.
          supabase.removeChannel(channel);
          const delay = Math.min(30_000, 1_000 * 2 ** attempt);
          setTimeout(() => join(attempt + 1), delay);
        } else if (status === "SUBSCRIBED" && __DEV__) {
          console.log(
            `[orders/realtime] subscribed to driver_locations for order ${orderId}`,
          );
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
