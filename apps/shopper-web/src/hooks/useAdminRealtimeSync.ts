import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

/**
 * Subscribes to every INSERT/UPDATE/DELETE on public.profiles and calls
 * `onChange` (debounced) whenever one lands, so an admin list/count view
 * updates itself instead of requiring a manual page refresh.
 *
 * profiles_select's RLS policy is `(uid() = id) OR is_manager()` -- an
 * admin/manager's subscription legitimately receives every row's changes
 * here the same way their own .select() already does; a non-admin caller
 * of this hook would only ever see their own row, which is correct and
 * harmless (every current caller is already gated behind an isAdmin check
 * before it ever mounts).
 *
 * Mirrors AuthContext.tsx's own profile-realtime subscription: retry on
 * CHANNEL_ERROR/TIMED_OUT with exponential backoff capped at 30s. That one
 * is scoped to a single row (`filter: id=eq.${userId}`) since it only ever
 * needs to know about the signed-in user; this one deliberately has no
 * filter, since an admin overview needs to know about every row.
 */
export function useAdminRealtimeSync(onChange: () => void, enabled = true): void {
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
    // staff-creation flow's own multi-step writes) into one refetch ~500ms
    // after the last event, instead of refetching once per row.
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
        .channel(`admin-profiles-sync-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => scheduleChange(),
        )
        .subscribe((status, err) => {
          if (stopped) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (import.meta.env.DEV) {
              console.warn(`[useAdminRealtimeSync] channel ${status}, retrying:`, err?.message);
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
  }, [enabled]);
}
