/**
 * Pharmacist realtime channel subscriptions.
 *
 * Pattern mirrors features/driver/realtime.ts exactly:
 *   - One channel per table scope
 *   - No retry logic here — retry is handled by the hook that mounts these
 *   - Returns the raw RealtimeChannel for cleanup
 *
 * Subscribed tables:
 *   orders           — any INSERT or UPDATE on PHARMACIST_ACTIVE_STATUSES
 *   prescriptions    — any INSERT or UPDATE (new Rx submissions appear live)
 *
 * RLS on both tables already scopes subscriptions to data the pharmacist
 * is permitted to see — the Supabase realtime broker enforces this.
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** Listen for any order change that is relevant to the pharmacist queue. */
export function subscribeToPharmacistOrders(
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel("pharmacist-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => onChange(),
    )
    .subscribe();
}

/** Listen for new or updated prescription submissions. */
export function subscribeToPharmacistPrescriptions(
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel("pharmacist-prescriptions")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "prescriptions" },
      () => onChange(),
    )
    .subscribe();
}
