import { useQueryClient } from "@tanstack/react-query";
import { fetchProductsPage } from "../api/productsApi";
import { productKeys } from "../api/queryKeys";

export function usePrefetchCategory() {
  const qc = useQueryClient();

  return (categoryId: string) => {
    if (!categoryId) return;
    void qc.prefetchInfiniteQuery({
      queryKey: productKeys.list({ categoryId, sortBy: "newest" }),
      initialPageParam: 1,
      queryFn: ({ pageParam, signal }) =>
        fetchProductsPage({
          categoryId,
          page: pageParam as number,
          pageSize: 24,
          sortBy: "newest",
          signal,
        }),
    });
  };
}
