import { useQuery } from "@tanstack/react-query";
import { listGiftCatalog } from "../api/loyaltyApi";
import { loyaltyKeys } from "../api/queryKeys";

export function useGiftCatalog(enabled = true) {
  return useQuery({
    queryKey: loyaltyKeys.giftCatalog(),
    queryFn:  ({ signal }) => listGiftCatalog(signal),
    enabled,
    staleTime: 60 * 1000,
    retry: 1,
  });
}
