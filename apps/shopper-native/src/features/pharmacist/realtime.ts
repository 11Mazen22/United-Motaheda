/**
 * Pharmacist realtime channel subscriptions.
 *
 * Root-cause fix for "cannot add postgres_changes callbacks for
 * realtime:pharmacist-orders after subscribe()":
 *
 *   Supabase throws that error when .on() is called on a channel that has
 *   already called .subscribe(). This happens when usePharmacistRealtimeSync
 *   is called a second time before the previous channels are fully removed
 *   — e.g. when userId changes (auth state flicker) or React StrictMode
 *   double-invokes the effect in dev.
 *
 *   Fix: use a unique channel name per call (appending a monotonic counter)
 *   so each subscription always gets a fresh channel object, never reusing
 *   an already-subscribed one.  The cleanup in usePharmacistRealtimeSync
 *   already calls supabase.removeChannel() — this just ensures we never
 *   re-enter the same channel name while a previous subscription is
 *   still tearing down.
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

let _seq = 0;
function nextSeq() {
  return ++_seq;
}

/** Listen for any order change that is relevant to the pharmacist queue. */
export function subscribeToPharmacistOrders(
  onChange: () => void,
): RealtimeChannel {
  // Unique channel name prevents the "callbacks after subscribe()" error when
  // the hook is re-mounted (StrictMode double-invoke, userId change, etc.)
  const channelName = `pharmacist-orders-${nextSeq()}`;
  return supabase
    .channel(channelName)
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
  const channelName = `pharmacist-prescriptions-${nextSeq()}`;
  return supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "prescriptions" },
      () => onChange(),
    )
    .subscribe();
}
