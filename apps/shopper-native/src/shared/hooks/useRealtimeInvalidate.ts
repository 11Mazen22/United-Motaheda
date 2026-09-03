/**
 * useRealtimeInvalidate — subscribes to a Postgres table via
 * subscribeToTable() for the lifetime of the component and, on every change,
 * invalidates a set of React Query keys (and/or runs an arbitrary side
 * effect). This is the shared building block every per-feature realtime
 * sync hook (driver, pharmacist, notifications, orders) is built on, so
 * "subscribe to table X, refresh screens that depend on it" is written once
 * instead of once per role.
 *
 * `queryKeys`/`onEvent` are read through a ref updated every render, so
 * passing fresh inline closures each render does not resubscribe the
 * channel — only channelName/table/schema/event/filter/enabled do.
 */

import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { subscribeToTable, type RealtimeEvent } from "../lib/subscribeToTable";

export interface UseRealtimeInvalidateOptions<T extends Record<string, unknown>> {
  channelName: string;
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
  queryKeys?: QueryKey[] | ((payload: RealtimePostgresChangesPayload<T>) => QueryKey[]);
  /** Escape hatch for non-invalidation side effects (e.g. pushing a banner toast). */
  onEvent?: (payload: RealtimePostgresChangesPayload<T>, queryClient: QueryClient) => void;
  /** Default true. Set false to skip subscribing (e.g. no user id yet). */
  enabled?: boolean;
}

export function useRealtimeInvalidate<T extends Record<string, unknown> = Record<string, unknown>>(
  options: UseRealtimeInvalidateOptions<T>,
): void {
  const queryClient = useQueryClient();
  const { channelName, table, schema, event, filter, enabled = true } = options;

  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!enabled) return;

    const sub = subscribeToTable<T>({ channelName, table, schema, event, filter }, (payload) => {
      latest.current.onEvent?.(payload, queryClient);

      const keysOption = latest.current.queryKeys;
      const keys = typeof keysOption === "function" ? keysOption(payload) : keysOption;
      keys?.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
    });

    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, schema, event, filter, enabled, queryClient]);
}
