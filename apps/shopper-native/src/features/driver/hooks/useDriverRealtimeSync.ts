/**
 * useDriverRealtimeSync — mount once for the whole driver section (in
 * (driver)/_layout.tsx), mirrors useNotificationSync's "one channel for the
 * lifetime of the session" shape. Any change to my assignments or my
 * assigned orders invalidates the manifest/offers query cache, so the task
 * list and offer screens update live instead of waiting for a manual pull-
 * to-refresh — and now also invalidates that specific order's own detail/
 * assignment queries, so a driver sitting on DeliveryExecutionScreen for
 * order X sees it update live too, not just the list screens.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToMyAssignments, subscribeToMyOrders } from "../realtime";
import { driverQueryKeys, invalidateDriverLists } from "./useDriverManifest";

export function useDriverRealtimeSync(driverId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!driverId) return;

    const onChange = (orderId: string | undefined) => {
      invalidateDriverLists(queryClient, driverId);
      if (orderId) {
        void queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(orderId) });
        void queryClient.invalidateQueries({ queryKey: driverQueryKeys.assignmentForOrder(orderId) });
      }
    };
    const assignmentsSub = subscribeToMyAssignments(driverId, onChange);
    const ordersSub = subscribeToMyOrders(driverId, onChange);

    return () => {
      assignmentsSub.unsubscribe();
      ordersSub.unsubscribe();
    };
  }, [driverId, queryClient]);
}
