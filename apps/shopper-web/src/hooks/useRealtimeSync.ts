import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

/**
 * Subscribes to INSERT/UPDATE/DELETE on the given public.<table> and calls
 * `onChange` (debounced) whenever one lands, so a list/count view updates
 * itself instead of requiring a manual page refresh. Shared by every admin
 * manager page (orders, prescriptions, products, promotions, staff/users)
 * and the customer-facing pages that need the same thing for their own
 * data (their own orders) -- one retry/debounce implementation instead of
 * each page reinventing it or, more commonly, having no live updates at
 * all.
 *
 * Retry on CHANNEL_ERROR/TIMED_OUT with exponential backoff capped at 30s,
 * mirroring AuthContext.tsx's own profile-realtime subscription. No filter
 * by default, since an admin overview needs to know about every row --
 * pass `filter` to scope it to a subset (e.g. `user_id=eq.${id}` for a
 * customer's own orders, matching this table's RLS so the subscription
 * only ever receives rows the caller could already SELECT).
 */
export function useRealtimeSync(
  table: string,
  onChange: () => void,
  options?: { enabled?: boolean; event?: "INSERT" | "UPDATE" | "DELETE" | "*"; filter?: string },
): void {
  const enabled = options?.enabled ?? true;
  const event = options?.event ?? "*";
  const filter = options?.filter;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseClient();
    let current: RealtimeChannel | null = null;
    let stopped = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Coalesces a burst of changes (a bulk action touching many rows, or a
    // multi-step write flow) into one refetch ~500ms after the last event,
    // instead of refetching once per row.
    const scheduleChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        onChangeRef.current();
      }, 500);
    };

    const join = (attempt: number) => {
      if (stopped) return;
      const channel = supabase
        .channel(`realtime-sync-${table}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event, schema: "public", table, ...(filter ? { filter } : {}) },
          () => scheduleChange(),
        )
        .subscribe((status, err) => {
          if (stopped) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (import.meta.env.DEV) {
              console.warn(`[useRealtimeSync:${table}] channel ${status}, retrying:`, err?.message);
            }
            supabase.removeChannel(channel);
            const delay = Math.min(30_000, 1_000 * 2 ** attempt);
            setTimeout(() => join(attempt + 1), delay);
          }
        });
      current = channel;
    };

    join(0);

    return () => {
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (current) supabase.removeChannel(current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table, event, filter]);
}
