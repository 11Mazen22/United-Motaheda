/**
 * subscribeToTable — the one canonical Supabase Realtime channel+retry
 * implementation for the whole app.
 *
 * Consolidates 5 independently-evolved copies of the same logic (pharmacist,
 * driver, orders, notifications realtime files, plus one inlined in
 * auth/context.tsx) that had each accumulated their own subset of the same
 * two bug fixes:
 *
 *   - Sequence-suffixing every channel name. Supabase throws "cannot add
 *     postgres_changes callbacks for <channel> after subscribe()" when
 *     `.on()` is called on a channel that already called `.subscribe()` —
 *     this happens when a hook re-runs before the previous channel is fully
 *     removed (React StrictMode double-invoke, or an auth-state flicker
 *     remounting the effect). A fixed channel name risks reusing an
 *     already-subscribed one; appending a monotonic counter guarantees a
 *     fresh channel object every time.
 *
 *   - Exponential-backoff retry on CHANNEL_ERROR/TIMED_OUT. supabase-js does
 *     not retry a channel that fails to join, and without a status callback
 *     the app has no way to even notice — one flaky connection attempt would
 *     otherwise silently break realtime for the rest of the session. Returns
 *     a stable handle (not the raw channel) since a retry swaps in a new
 *     underlying RealtimeChannel object; a caller holding the first
 *     reference would unsubscribe the wrong (already-replaced) channel and
 *     leak the retried one past unmount. `stopped` guards against a retry's
 *     setTimeout firing after the caller already unsubscribed.
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface SubscribeToTableParams {
  /** Need not be globally unique — a sequence number is always appended. */
  channelName: string;
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  /** e.g. "user_id=eq.<id>". Omit to receive every row (staff-wide channels). */
  filter?: string;
}

export interface TableSubscription {
  unsubscribe: () => void;
}

let _seq = 0;

export function subscribeToTable<T extends Record<string, unknown> = Record<string, unknown>>(
  params: SubscribeToTableParams,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
): TableSubscription {
  const { channelName, table, schema = "public", event = "*", filter } = params;

  let current: RealtimeChannel | null = null;
  let stopped = false;

  const join = (attempt: number) => {
    if (stopped) return;
    const channel = supabase
      .channel(`${channelName}-${++_seq}`)
      .on(
        "postgres_changes",
        { event, schema, table, filter },
        (payload) => onChange(payload as RealtimePostgresChangesPayload<T>),
      )
      .subscribe((status, err) => {
        if (stopped) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (__DEV__) console.warn(`[realtime] ${channelName} (${table}) ${status}, retrying:`, err?.message);
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
