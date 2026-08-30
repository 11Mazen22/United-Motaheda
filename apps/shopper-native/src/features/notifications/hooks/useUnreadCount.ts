/**
 * useUnreadCount — TanStack-backed unread count for tab badges + headers.
 *
 * Subscribes to the same queryKey that `useNotifications` invalidates,
 * so any realtime push automatically refreshes the count without an
 * extra subscription.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchUnreadCount } from "../api";

export const unreadCountKey = (userId: string) => ["notification-unread-count", userId] as const;
const KEY = unreadCountKey;

export function useUnreadCount(userId: string | undefined): number {
  const { data } = useQuery({
    queryKey: userId ? KEY(userId) : ["notification-unread-count", "anonymous"],
    queryFn: () => fetchUnreadCount(userId!),
    enabled: !!userId,
    initialData: 0,
    staleTime: 30_000,
  });
  return data ?? 0;
}
