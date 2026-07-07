/**
 * useDriverRealtimeSync — mount once for the whole driver section (in
 * (driver)/_layout.tsx), mirrors useNotificationSync's "one channel for the
 * lifetime of the session" shape. Any change to my assignments or my
 * assigned orders invalidates the manifest/offers query cache, so the task
 * list and offer screens update live instead of waiting for a manual pull-
 * to-refresh.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { subscribeToMyAssignments, subscribeToMyOrders } from "../realtime";
import { invalidateDriverLists } from "./useDriverManifest";

export function useDriverRealtimeSync(driverId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!driverId) return;

    const onChange = () => invalidateDriverLists(queryClient, driverId);
    const assignmentsChannel = subscribeToMyAssignments(driverId, onChange);
    const ordersChannel = subscribeToMyOrders(driverId, onChange);

    return () => {
      supabase.removeChannel(assignmentsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [driverId, queryClient]);
}
