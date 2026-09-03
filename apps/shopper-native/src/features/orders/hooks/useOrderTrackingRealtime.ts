/**
 * useOrderTrackingRealtime — mount inside TrackOrderScreen for one order.
 *
 * Two subscriptions, both invalidating the same tracking snapshot query:
 *   - driver_locations INSERT for this order — a new GPS ping.
 *   - orders UPDATE for this order — a status transition (confirmed →
 *     preparing → out_for_delivery → delivered), which the 20s poll in
 *     useOrderTracking would otherwise be the only thing to catch.
 *
 * RLS already scopes both: driver_locations' "customer select own order"
 * policy and orders' orders_select_own both key off the authenticated
 * customer's own order, so no client-side filtering beyond the order id is
 * needed. driver_locations was already added to the supabase_realtime
 * publication in 20260727120000_driver_locations.sql; orders is in it too.
 */

import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { trackingQueryKeys } from "./useOrderTracking";

export function useOrderTrackingRealtime(orderId: string | null | undefined): void {
  useRealtimeInvalidate({
    enabled: Boolean(orderId),
    channelName: `order-tracking-location-${orderId}`,
    table: "driver_locations",
    event: "INSERT",
    filter: `order_id=eq.${orderId}`,
    queryKeys: [trackingQueryKeys.snapshot(orderId ?? "")],
  });

  useRealtimeInvalidate({
    enabled: Boolean(orderId),
    channelName: `order-tracking-status-${orderId}`,
    table: "orders",
    event: "UPDATE",
    filter: `id=eq.${orderId}`,
    queryKeys: [trackingQueryKeys.snapshot(orderId ?? "")],
  });
}
