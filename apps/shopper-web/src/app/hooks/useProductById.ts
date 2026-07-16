/** Canonical effective-price product-detail lookup. */

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { normalizeSupabaseProduct, type CatalogProduct } from "../catalog";

export interface UseProductByIdResult {
  product: CatalogProduct | null;
  isLoading: boolean;
  error: string | null;
}

/** Fetches a public product detail through the canonical pricing API. */
export function useProductById(id: string | undefined): UseProductByIdResult {
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setProduct(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setProduct(null);

    void (async () => {
      try {
        const { data, error: rpcError } = await getSupabaseClient()
          .rpc("get_effective_product", { p_product_id: id });
        if (!mountedRef.current) return;
        if (rpcError) throw new Error(rpcError.message);

        const row = Array.isArray(data) ? data[0] : null;
        const normalized = row
          ? normalizeSupabaseProduct(row as Record<string, unknown>, 0)
          : null;
        if (normalized) setProduct(normalized);
        else setError("Product not found");
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load product");
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    })();
  }, [id]);

  return { product, isLoading, error };
}
