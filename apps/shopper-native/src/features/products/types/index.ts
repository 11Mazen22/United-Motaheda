/** Product types and canonical effective-pricing normalizers. */

import { z } from "zod";

export const PRODUCT_SORT_OPTIONS = ["newest", "price_asc", "price_desc", "name_asc", "relevance"] as const;
export type ProductSortMode = typeof PRODUCT_SORT_OPTIONS[number];

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: ProductSortMode;
  /** Restrict results to products with an active canonical promotion. */
  isSale?: boolean;
  page?: number;
  pageSize?: number;
}

/** Row returned by search_effective_products and get_effective_product. */
export const EffectiveProductRowSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  barcode: z.string().nullable(),
  name_ar: z.string().nullable(),
  name_en: z.string().nullable(),
  base_price: z.coerce.number(),
  effective_price: z.coerce.number(),
  stock: z.coerce.number(),
  category_name: z.string().nullable(),
  category_name_en: z.string().nullable(),
  image_url: z.string().nullable(),
  rating_avg: z.coerce.number().nullable().optional(),
  rating_count: z.coerce.number().int().nullable().optional(),
  is_new: z.boolean().optional().default(false),
  is_bestseller: z.boolean().optional().default(false),
  promotion_id: z.string().nullable().optional(),
  promotion_name: z.string().nullable().optional(),
  promotion_discount_type: z.string().nullable().optional(),
  promotion_discount_value: z.coerce.number().nullable().optional(),
  promotion_ends_at: z.string().nullable().optional(),
  has_active_promotion: z.boolean().optional().default(false),
  discount_amount: z.coerce.number().nullable().optional(),
  discount_percent: z.coerce.number().nullable().optional(),
  total_count: z.coerce.number().optional(),
});
export type EffectiveProductRow = z.infer<typeof EffectiveProductRowSchema>;

/** @deprecated Compatibility alias for callers that imported the old name. */
export const SearchProductRowSchema = EffectiveProductRowSchema;
export type SearchProductRow = EffectiveProductRow;

export interface NativeProduct {
  id: string;
  code: string;
  barcode: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  /** Canonical effective price, including any active promotion. */
  price: number;
  /** Canonical product price before the active promotion. */
  basePrice: number;
  stock: number;
  inStock: boolean;
  category: string;
  categoryName: string;
  categoryNameEn: string;
  imageUrl?: string;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  discountPercent?: number | null;
  promotionId?: string | null;
  promotionName?: string | null;
  promotionEndsAt?: string | null;
  hasActivePromotion: boolean;
  isNew?: boolean;
  isBestseller?: boolean;
}

export interface NativeCategory {
  id: string;
  name: string;
  nameEn: string;
  count: number;
}

export interface ProductPage {
  products: NativeProduct[];
  totalCount: number;
  hasNextPage: boolean;
  currentPage: number;
}

export function normalizeEffectiveProduct(row: EffectiveProductRow): NativeProduct {
  const stock = Number(row.stock ?? 0);
  const price = Number(row.effective_price ?? 0);
  const basePrice = Number(row.base_price ?? price);
  const hasActivePromotion = Boolean(row.has_active_promotion) && basePrice > price;
  const discountPercent = row.discount_percent != null
    ? Number(row.discount_percent)
    : hasActivePromotion && basePrice > 0
      ? Math.round(((basePrice - price) / basePrice) * 100)
      : null;

  return {
    id: row.id,
    code: row.code ?? "",
    barcode: row.barcode ?? "",
    name: row.name_ar ?? row.name_en ?? "",
    nameAr: row.name_ar ?? undefined,
    nameEn: row.name_en ?? undefined,
    price,
    basePrice,
    stock,
    inStock: stock > 0,
    category: row.category_name ?? "",
    categoryName: row.category_name ?? "",
    categoryNameEn: row.category_name_en ?? "",
    imageUrl: row.image_url ?? undefined,
    ratingAvg: row.rating_avg ?? null,
    ratingCount: row.rating_count ?? null,
    discountPercent,
    promotionId: row.promotion_id ?? null,
    promotionName: row.promotion_name ?? null,
    promotionEndsAt: row.promotion_ends_at ?? null,
    hasActivePromotion,
    isNew: row.is_new ?? false,
    isBestseller: row.is_bestseller ?? false,
  };
}

/** @deprecated Compatibility alias. */
export const normalizeSearchRow = normalizeEffectiveProduct;
