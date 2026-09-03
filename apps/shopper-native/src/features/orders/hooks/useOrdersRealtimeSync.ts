/**
 * useCustomerOrdersRealtimeSync — mount once at the app root (in
 * app/_layout.tsx, next to NotificationSync). Any change to one of my own
 * orders (pharmacist confirms it, gets assigned a driver, status moves to
 * out_for_delivery/delivered, etc.) invalidates my orders list and that
 * order's own detail query, so the Orders screen and Order Details screen
 * update live instead of relying on staleTime + manual pull-to-refresh.
 *
 * Gated only on userId (not role) — mirrors NotificationSync's pattern —
 * since RLS (`orders_select_own`, user_id = auth.uid()) naturally scopes
 * this to whatever orders the signed-in account owns regardless of role.
 */

import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { ordersQueryKeys } from "./useOrders";
import type { QueryKey } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type OrderIdRow = {
  id?: string;
};

export function useCustomerOrdersRealtimeSync(userId: string | undefined): void {
  useRealtimeInvalidate<OrderIdRow>({
    enabled: Boolean(userId),
    channelName: `customer-orders-${userId}`,
    table: "orders",
    filter: `user_id=eq.${userId}`,
    queryKeys: (payload: RealtimePostgresChangesPayload<OrderIdRow>): QueryKey[] => {
      const orderId = (payload.new as OrderIdRow | null)?.id ?? (payload.old as OrderIdRow | null)?.id;
      return [
        ordersQueryKeys.list(userId!),
        ...(orderId ? [ordersQueryKeys.detail(orderId)] : []),
      ];
    },
  });
}
