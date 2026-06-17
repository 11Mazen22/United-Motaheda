import { useMemo } from "react";
import { useRecentlyViewedStore } from "../../../stores/recentlyViewedStore";
import type { NativeProduct } from "../../products/types";

export function useRecentlyViewedFeed(): NativeProduct[] {
  const items = useRecentlyViewedStore((s) => s.items);

  return useMemo<NativeProduct[]>(() => items.map((i) => ({
    id: i.id,
    name: i.name,
    nameAr: i.name,
    nameEn: i.name,
    price: i.price,
    stock: 0,
    inStock: true,
    categoryName: "",
    imageUrl: i.imageUrl,
  })), [items]);
}
