import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProductById } from "../api/productsApi";
import { productKeys } from "../api/queryKeys";
import type { NativeProduct, ProductPage } from "../types";

interface InfinitePagesShape {
  pages?: ProductPage[];
}

function isInfinitePages(value: unknown): value is InfinitePagesShape {
  return typeof value === "object" && value !== null && Array.isArray((value as InfinitePagesShape).pages);
}

export function useProduct(id: string | undefined) {
  const qc = useQueryClient();

  const placeholder = useMemo<NativeProduct | undefined>(() => {
    if (!id) return undefined;
    const queries = qc.getQueriesData<unknown>({ queryKey: ["products", "list"] });
    for (const [, data] of queries) {
      if (!isInfinitePages(data) || !data.pages) continue;
      for (const page of data.pages) {
        const hit = page.products.find((p) => p.id === id);
        if (hit) return hit;
      }
    }
    return undefined;
  }, [id, qc]);

  return useQuery({
    queryKey: productKeys.detail(id ?? "missing"),
    queryFn: ({ signal }) => fetchProductById(id ?? "", { signal }),
    enabled: Boolean(id),
    placeholderData: placeholder,
    staleTime: 60 * 1000,
  });
}
