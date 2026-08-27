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
 *   an already-subscribed one.
 *
 * Retry-on-error: also ported the fix already applied to
 * features/notifications/realtime.ts and features/auth/context.tsx's profile
 * channel — supabase-js does not retry a channel that fails to join
 * (CHANNEL_ERROR/TIMED_OUT), and without a status callback the app has no way
 * to even notice, so one flaky connection attempt could silently break
 * realtime order/prescription/inventory sync for the rest of the pharmacist's
 * session. This was the one remaining realtime consumer in the app still
 * using the bare, no-retry `.subscribe()` pattern.
 *
 *   Returns a stable handle rather than the raw channel: a retry swaps in a
 *   new underlying RealtimeChannel object, so a caller holding onto the first
 *   channel reference for cleanup would unsubscribe the wrong (already
 *   replaced) channel and leak the retried one past unmount.
 */

import { supabase } from "@/lib/supabase";

let _seq = 0;
function nextSeq() {
  return ++_seq;
}

export interface PharmacistRealtimeSubscription {
  unsubscribe: () => void;
}

function subscribeWithRetry(
  channelPrefix: string,
  table: string,
  onChange: () => void,
): PharmacistRealtimeSubscription {
  let current: ReturnType<typeof supabase.channel> | null = null;
  let stopped = false;

  const join = (attempt: number) => {
    if (stopped) return;
    const channel = supabase
      .channel(`${channelPrefix}-${nextSeq()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onChange(),
      )
      .subscribe((status, err) => {
        if (stopped) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (__DEV__) console.warn(`[pharmacist/realtime] ${table} channel ${status}, retrying:`, err?.message);
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

/** Listen for any order change that is relevant to the pharmacist queue. */
export function subscribeToPharmacistOrders(
  onChange: () => void,
): PharmacistRealtimeSubscription {
  return subscribeWithRetry("pharmacist-orders", "orders", onChange);
}

/** Listen for new or updated prescription submissions. */
export function subscribeToPharmacistPrescriptions(
  onChange: () => void,
): PharmacistRealtimeSubscription {
  return subscribeWithRetry("pharmacist-prescriptions", "prescriptions", onChange);
}

/** Listen for authoritative inventory_state changes so low-stock views stay
 * current after reservations, commits, releases, and manual adjustments. */
export function subscribeToPharmacistInventory(
  onChange: () => void,
): PharmacistRealtimeSubscription {
  return subscribeWithRetry("pharmacist-inventory", "inventory_state", onChange);
}
