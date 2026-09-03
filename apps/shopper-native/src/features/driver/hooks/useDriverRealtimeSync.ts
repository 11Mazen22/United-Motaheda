/**
 * useDriverRealtimeSync — mount once for the whole driver section (in
 * (driver)/_layout.tsx). Any change to my assignments, my assigned orders,
 * or my own driver profile (approval/online status, changed by an admin)
 * invalidates the relevant query cache, so the manifest/offers/profile
 * screens update live instead of waiting for a manual pull-to-refresh —
 * including that specific order's own detail/assignment queries, so a
 * driver sitting on DeliveryExecutionScreen for order X sees it update live
 * too, not just the list screens.
 *
 * Built on the shared useRealtimeInvalidate — see shared/hooks for the
 * channel+retry mechanics this used to duplicate per-feature.
 */

import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { driverQueryKeys } from "./useDriverManifest";
import { driverProfileQueryKeys } from "./useDriverProfile";
import type { QueryKey } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

function manifestKeys(driverId: string, orderId: string | undefined): QueryKey[] {
  return [
    driverQueryKeys.manifest(driverId),
    driverQueryKeys.offers(driverId),
    ...(orderId ? [driverQueryKeys.order(orderId), driverQueryKeys.assignmentForOrder(orderId)] : []),
  ];
}

export function useDriverRealtimeSync(driverId: string | undefined): void {
  useRealtimeInvalidate<{ order_id?: string }>({
    enabled: Boolean(driverId),
    channelName: `driver-assignments-${driverId}`,
    table: "delivery_assignments",
    filter: `driver_id=eq.${driverId}`,
    queryKeys: (payload: RealtimePostgresChangesPayload<{ order_id?: string }>) =>
      manifestKeys(driverId!, (payload.new as { order_id?: string } | null)?.order_id ?? (payload.old as { order_id?: string } | null)?.order_id),
  });

  useRealtimeInvalidate<{ id?: string }>({
    enabled: Boolean(driverId),
    channelName: `driver-orders-${driverId}`,
    table: "orders",
    filter: `assigned_driver_id=eq.${driverId}`,
    queryKeys: (payload: RealtimePostgresChangesPayload<{ id?: string }>) =>
      manifestKeys(driverId!, (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id),
  });

  useRealtimeInvalidate({
    enabled: Boolean(driverId),
    channelName: `driver-profile-${driverId}`,
    table: "DriverProfile",
    event: "UPDATE",
    filter: `userId=eq.${driverId}`,
    queryKeys: [driverProfileQueryKeys.mine(driverId ?? "")],
  });
}
