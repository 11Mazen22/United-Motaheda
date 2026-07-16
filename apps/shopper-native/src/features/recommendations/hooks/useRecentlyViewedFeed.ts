/**
 * useRecentlyViewedFeed — derived shape suitable for any product carousel.
 *
 * Reads from the MMKV-backed recentlyViewedStore (slice 2) and shapes each
 * entry into a NativeProduct-ish object so it can drop straight into a
 * ProductCard / ProductGrid without a separate component path.
 *
 * Missing fields (stock, category, code, etc.) are filled with safe
 * defaults — the card treats them as "unknown / available". For the full
 * product detail, callers navigate to /product/[id] which fetches the
 * authoritative row via useProduct.
 */

import { useMemo } from "react";
import { useRecentlyViewedStore } from "@/features/products";
import type { NativeProduct } from "@/features/products";

export function useRecentlyViewedFeed(): NativeProduct[] {
  const items = useRecentlyViewedStore((s) => s.items);

  return useMemo<NativeProduct[]>(
    () =>
      items.map((i) => ({
        id:             i.id,
        code:           "",
        barcode:        "",
        name:           i.name,
        nameAr:         i.name,
        nameEn:         i.name,
        price:          i.price,
        basePrice:      i.price,
        hasActivePromotion: false,
        stock:          0,
        inStock:        true,
        category:       "",
        categoryName:   "",
        categoryNameEn: "",
        imageUrl:       i.imageUrl,
      })),
    [items],
  );
}
