import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchUserOrders, fetchOrderById } from "../api";
import { useOrderStore, type Order } from "../../../stores/orders";

export const ordersQueryKeys = {
  list:   (userId: string)  => ["orders", "list",   userId] as const,
  detail: (orderId: string) => ["orders", "detail", orderId] as const,
};

export function useOrders(userId: string | null | undefined) {
  const query = useQuery<Order[], Error>({
    queryKey:    ordersQueryKeys.list(userId ?? ""),
    queryFn:     () => fetchUserOrders(userId!),
    enabled:     Boolean(userId),
    staleTime:   30_000,
    gcTime:      5 * 60_000,
    retry:       2,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data && userId) {
      useOrderStore.setState({ orders: query.data, isHydrated: true, loading: false });
    }
  }, [query.data, userId]);

  return query;
}

export function useOrderDetail(orderId: string | null | undefined) {
  return useQuery<Order | null, Error>({
    queryKey:  ordersQueryKeys.detail(orderId ?? ""),
    queryFn:   () => fetchOrderById(orderId!),
    enabled:   Boolean(orderId),
    staleTime: 20_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

export function invalidateOrders(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.list(userId) });
}
