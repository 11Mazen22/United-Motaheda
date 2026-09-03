/**
 * usePharmacistRealtimeSync — mount once in (pharmacist)/_layout.tsx.
 *
 * Subscribes to order, prescription, and inventory changes for the duration
 * of the pharmacist session. On any change it invalidates the relevant query
 * keys so all mounted screens refresh automatically.
 *
 * Built on the shared useRealtimeInvalidate — see shared/hooks for the
 * channel+retry mechanics this used to duplicate per-feature.
 */

import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { pharmacistQueryKeys } from "./queryKeys";

export function usePharmacistRealtimeSync(userId: string | undefined): void {
  useRealtimeInvalidate({
    enabled: Boolean(userId),
    channelName: "pharmacist-orders",
    table: "orders",
    queryKeys: [
      pharmacistQueryKeys.orderQueue(),
      ["pharmacist", "orders"],
      pharmacistQueryKeys.dashboard(),
      pharmacistQueryKeys.recentlyCompleted(),
    ],
  });

  useRealtimeInvalidate({
    enabled: Boolean(userId),
    channelName: "pharmacist-prescriptions",
    table: "prescriptions",
    queryKeys: [pharmacistQueryKeys.prescriptionQueue(), pharmacistQueryKeys.dashboard()],
  });

  useRealtimeInvalidate({
    enabled: Boolean(userId),
    channelName: "pharmacist-inventory",
    table: "inventory_state",
    queryKeys: [pharmacistQueryKeys.lowStock(), ["pharmacist", "products"]],
  });
}
