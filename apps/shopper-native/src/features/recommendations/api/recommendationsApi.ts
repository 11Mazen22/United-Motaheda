/**
 * Recommendations API.
 *
 * Recommendation RPCs only rank product identifiers. Each recommended product
 * is then rehydrated through get_effective_product so prices and promotions are
 * always sourced from the canonical pricing authority.
 */

import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/supabaseRequest";
import { z } from "zod";
import { EffectiveProductRowSchema, normalizeEffectiveProduct } from "@/features/products/types";
import type { NativeProduct } from "@/features/products/types";

const RecommendationIdSchema = z.object({ id: z.string() });

async function hydrateEffectiveProducts(rows: unknown, signal?: AbortSignal): Promise<NativeProduct[]> {
  const parsed = RecommendationIdSchema.array().safeParse(rows);
  if (!parsed.success) return [];

  const products = await Promise.all(parsed.data.map(async ({ id }) => {
    const effectiveRows = await withTimeout(
      (timeoutSignal) => supabase
        .rpc("get_effective_product", { p_product_id: id })
        .abortSignal(linkSignals(signal, timeoutSignal)),
      { signal },
    );
    const effective = EffectiveProductRowSchema.array().safeParse(effectiveRows);
    return effective.success && effective.data[0]
      ? normalizeEffectiveProduct(effective.data[0])
      : null;
  }));

  return products.filter((product): product is NativeProduct => product !== null);
}

export async function fetchRelatedProducts(productId: string, limit = 12, signal?: AbortSignal): Promise<NativeProduct[]> {
  if (!productId) return [];
  const data = await withTimeout(
    (timeoutSignal) => supabase
      .rpc("get_related_products", { p_product_id: productId, p_limit: limit })
      .abortSignal(linkSignals(signal, timeoutSignal)),
    { signal },
  );
  return hydrateEffectiveProducts(data, signal);
}

export async function fetchTrendingProducts(category: string | null = null, limit = 12, signal?: AbortSignal): Promise<NativeProduct[]> {
  const data = await withTimeout(
    (timeoutSignal) => supabase
      .rpc("get_trending_products", { p_category: category, p_limit: limit })
      .abortSignal(linkSignals(signal, timeoutSignal)),
    { signal },
  );
  return hydrateEffectiveProducts(data, signal);
}

function linkSignals(external: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!external) return timeout;
  if (external.aborted) return external;
  if (timeout.aborted) return timeout;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}
