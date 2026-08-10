/**
 * usePharmacistRealtimeSync — mount once in (pharmacist)/_layout.tsx.
 *
 * Subscribes to order and prescription changes for the duration of the
 * pharmacist session. On any change it invalidates the relevant query keys
 * so all mounted screens refresh automatically.
 *
 * Mirrors useDriverRealtimeSync exactly — one hook, mounted at the layout
 * level, not per-screen.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  subscribeToPharmacistOrders,
  subscribeToPharmacistPrescriptions,
  subscribeToPharmacistInventory,
} from "../realtime";
import { pharmacistQueryKeys } from "./queryKeys";

export function usePharmacistRealtimeSync(userId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidateOrders = () => {
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() });
      void queryClient.invalidateQueries({ queryKey: ["pharmacist", "orders"] });
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() });
    };

    const invalidateRx = () => {
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.prescriptionQueue() });
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() });
    };

    const invalidateInventory = () => {
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.lowStock() });
      void queryClient.invalidateQueries({ queryKey: ["pharmacist", "products"] });
    };

    const ordersChannel = subscribeToPharmacistOrders(invalidateOrders);
    const rxChannel     = subscribeToPharmacistPrescriptions(invalidateRx);
    const inventoryChannel = subscribeToPharmacistInventory(invalidateInventory);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(rxChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, [userId, queryClient]);
}
