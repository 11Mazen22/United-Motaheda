import { useQuery } from "@tanstack/react-query";
import { getLoyaltyBalance } from "../api/loyaltyApi";
import { loyaltyKeys } from "../api/queryKeys";

export function useLoyaltyBalance(enabled = true) {
  return useQuery({
    queryKey: loyaltyKeys.balance(),
    queryFn:  ({ signal }) => getLoyaltyBalance(signal),
    enabled,
    staleTime: 30 * 1000,
    // One retry max — each attempt already has a 12s hard deadline via
    // withTimeout(). Default retry:3 would hold isLoading:true for ~55s.
    retry: 1,
  });
}
