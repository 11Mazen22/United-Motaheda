/**
 * Recommendations API.
 *
 * Returns NativeProduct[] so feeds are interchangeable with any other
 * product list (ProductCard accepts NativeProduct directly). The wire
 * shape matches search_products minus the rank/total_count fields; we
 * reuse the products feature's row normaliser.
 */

import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/supabaseRequest";
import { z } from "zod";
import { SearchProductRowSchema, normalizeSearchRow } from "@/features/products/types";
import type { NativeProduct } from "@/features/products/types";

// Recommendation rows are the same shape as search_products but without
// rank/total_count. Reuse the schema via partial+extend.
const RecRowSchema = SearchProductRowSchema
  .pick({
    id: true, code: true, barcode: true,
    name_ar: true, name_en: true,
    price: true, stock: true,
    category_name: true, category_name_en: true,
    image_url: true,
    is_new: true, is_bestseller: true, is_sale: true,
  });
type RecRow = z.infer<typeof RecRowSchema>;

function toNative(r: RecRow): NativeProduct {
  return normalizeSearchRow({ ...r, rank: null, total_count: 0 } as any);
}

export async function fetchRelatedProducts(productId: string, limit = 12, signal?: AbortSignal): Promise<NativeProduct[]> {
  if (!productId) return [];
  const data = await withTimeout(
    (timeoutSignal) =>
      supabase
        .rpc("get_related_products", { p_product_id: productId, p_limit: limit })
        .abortSignal(linkSignals(signal, timeoutSignal)),
    { signal },
  );
  const parsed = RecRowSchema.array().safeParse(data);
  if (!parsed.success) {
    if (__DEV__) console.warn("[recommendations] get_related_products invalid:", parsed.error.issues.slice(0, 3));
    return [];
  }
  return parsed.data.map(toNative);
}

export async function fetchTrendingProducts(category: string | null = null, limit = 12, signal?: AbortSignal): Promise<NativeProduct[]> {
  const data = await withTimeout(
    (timeoutSignal) =>
      supabase
        .rpc("get_trending_products", { p_category: category, p_limit: limit })
        .abortSignal(linkSignals(signal, timeoutSignal)),
    { signal },
  );
  const parsed = RecRowSchema.array().safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.map(toNative);
}

function linkSignals(external: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!external) return timeout;
  if (external.aborted) return external;
  if (timeout.aborted)  return timeout;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort",  onAbort, { once: true });
  return controller.signal;
}
