/**
 * TanStack Query hook for paginated notifications + realtime invalidation.
 *
 * Surface:
 *  - `items`        — flattened notifications across all loaded pages
 *  - `unreadCount`  — derived from items (cheap, no extra query)
 *  - `fetchNextPage` — call from FlatList onEndReached
 *  - `hasNextPage`, `isFetching`, `isFetchingNextPage`, `isError`, `refetch`
 *  - `markRead`, `markAllRead`, `dismiss` — optimistic mutations
 */

import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteNotification,
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api";
import type { AppNotification, NotificationPage } from "../types";

const KEY = (userId: string) => ["notifications", userId] as const;

export function useNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  type NotificationsCache = { pages: NotificationPage[]; pageParams: unknown[] };

  const query = useInfiniteQuery<NotificationPage>({
    queryKey: userId ? KEY(userId) : ["notifications", "anonymous"],
    enabled: !!userId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage(userId!, pageParam as string | null),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });

  // Realtime invalidation is handled globally by useNotificationSync
  // (mounted in the app root). When a new notification arrives that
  // hook invalidates this query, triggering a refetch — no need for
  // a second subscription here.

  const items = useMemo<AppNotification[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const unreadCount = useMemo(
    () => items.filter((n) => !n.isRead).length,
    [items],
  );

  // ─── Optimistic mutations ─────────────────────────────────────────────────

  const updateItem = useCallback(
    (id: string, mutator: (n: AppNotification) => AppNotification) => {
      if (!userId) return;
      qc.setQueryData<{ pages: NotificationPage[]; pageParams: unknown[] }>(
        KEY(userId),
        (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.map((n) => (n.id === id ? mutator(n) : n)),
            })),
          };
        },
      );
    },
    [qc, userId],
  );

  const removeItem = useCallback(
    (id: string) => {
      if (!userId) return;
      qc.setQueryData<{ pages: NotificationPage[]; pageParams: unknown[] }>(
        KEY(userId),
        (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.filter((n) => n.id !== id),
            })),
          };
        },
      );
    },
    [qc, userId],
  );

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, userId!),
    onMutate: (id) => {
      if (!userId) return undefined;
      const previous = qc.getQueryData<NotificationsCache>(KEY(userId));
      updateItem(id, (n) => ({ ...n, isRead: true }));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (userId && context?.previous) {
        qc.setQueryData(KEY(userId), context.previous);
      }
    },
    onSettled: () => {
      if (userId) void qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onMutate: () => {
      if (!userId) return;
      const previous = qc.getQueryData<NotificationsCache>(KEY(userId));
      qc.setQueryData<NotificationsCache>(
        KEY(userId),
        (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.map((n) => ({ ...n, isRead: true })),
            })),
          };
        },
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (userId && context?.previous) {
        qc.setQueryData(KEY(userId), context.previous);
      }
    },
    onSettled: () => {
      if (userId) void qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => deleteNotification(id, userId!),
    onMutate: (id) => {
      if (!userId) return undefined;
      const previous = qc.getQueryData<NotificationsCache>(KEY(userId));
      removeItem(id);
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (userId && context?.previous) {
        qc.setQueryData(KEY(userId), context.previous);
      }
    },
    onSettled: () => {
      if (userId) void qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });

  return {
    items,
    unreadCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    isError: query.isError,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    dismiss: dismiss.mutate,
  };
}
