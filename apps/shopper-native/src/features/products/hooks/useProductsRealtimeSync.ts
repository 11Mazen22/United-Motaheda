/**
 * useProductsRealtimeSync — mount once at the app root (in app/_layout.tsx,
 * next to CustomerOrdersSync/NotificationSync). A stock change, price
 * update, or new product added from the admin panel or a CSV bulk import
 * invalidates every products query (browse lists, search, detail, featured/
 * flash-sale rails) so the storefront reflects it live instead of only
 * after the 90s browse / 30s search staleTime lapses.
 *
 * Unlike orders/notifications this is never user-scoped -- products are
 * public catalog data (products_select_all / "products public read" both
 * have an unconditional `true` RLS qual), so it's always enabled, even for
 * a signed-out guest browsing the storefront.
 *
 * Invalidates productKeys.all (the ["products"] prefix) rather than trying
 * to target the one changed row's specific query keys: an insert/delete
 * can shift totalCount and page boundaries for every filter/sort
 * combination currently mounted, not just the exact list a naive per-row
 * invalidation would guess at.
 */
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { productKeys } from "../api/queryKeys";

export function useProductsRealtimeSync(): void {
  useRealtimeInvalidate({
    channelName: "products-catalog",
    table: "products",
    queryKeys: [productKeys.all],
  });
}
