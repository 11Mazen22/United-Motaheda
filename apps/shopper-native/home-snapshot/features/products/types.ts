import { z } from "zod";

// ─── Sort + filter primitives ───────────────────────────────────────────────

export const PRODUCT_SORT_OPTIONS = ["newest", "price_asc", "price_desc", "name_asc", "relevance"] as const;
export type ProductSortMode = typeof PRODUCT_SORT_OPTIONS[number];

export interface ProductFilters {
  search?:     string;
  categoryId?: string;
  inStock?:    boolean;
  minPrice?:   number;
  maxPrice?:   number;
  sortBy?:     ProductSortMode | "newest" | "price_asc" | "price_desc" | "name_asc";
  page?:       number;
  pageSize?:   number;
  isSale?:     boolean;
}

export const SearchProductRowSchema = z.object({
  id:                z.string(),
  code:              z.string().nullable(),
  barcode:           z.string().nullable(),
  name_ar:           z.string().nullable(),
  name_en:           z.string().nullable(),
  price:             z.coerce.number(),
  stock:             z.coerce.number(),
  category_name:     z.string().nullable(),
  category_name_en:  z.string().nullable(),
  image_url:         z.string().nullable(),
  rank:              z.coerce.number().nullable().optional(),
  total_count:       z.coerce.number(),
  rating_avg:        z.coerce.number().nullable().optional(),
  rating_count:      z.coerce.number().int().nullable().optional(),
  discount_percent:  z.coerce.number().nullable().optional(),
  is_new:            z.boolean().optional().default(false),
  is_bestseller:     z.boolean().optional().default(false),
  is_sale:           z.boolean().optional().default(false),
});
export type SearchProductRow = z.infer<typeof SearchProductRowSchema>;

export const RawProductRowSchema = z.object({
  id:                 z.union([z.string(), z.number()]).transform(String),
  Code:               z.string().nullable().optional(),
  Barcode:            z.string().nullable().optional(),
  Name_Ar:            z.string().nullable().optional(),
  Name_En:            z.string().nullable().optional(),
  Price:              z.coerce.number().nullable().optional(),
  Stock:              z.coerce.number().nullable().optional(),
  Category_Name:      z.string().nullable().optional(),
  Category_Name_En:   z.string().nullable().optional(),
  is_active:          z.boolean().nullable().optional(),
  image_url:          z.string().nullable().optional(),
  rating_avg:         z.coerce.number().nullable().optional(),
  rating_count:       z.coerce.number().int().nullable().optional(),
  discount_percent:   z.coerce.number().nullable().optional(),
  is_new:             z.boolean().optional().default(false),
  is_bestseller:      z.boolean().optional().default(false),
  is_sale:            z.boolean().optional().default(false),
});
export type RawProductRow = z.infer<typeof RawProductRowSchema>;

export interface NativeProduct {
  id:              string;
  code:            string;
  barcode:         string;
  name:            string;
  nameAr?:         string;
  nameEn?:         string;
  price:           number;
  stock:           number;
  inStock:         boolean;
  category:        string;
  categoryName:    string;
  categoryNameEn:  string;
  imageUrl?:       string;
  ratingAvg?:       number | null;
  ratingCount?:     number | null;
  discountPercent?: number | null;
  isNew?:           boolean;
  isBestseller?:    boolean;
  isSale?:          boolean;
}

export interface NativeCategory {
  id:      string;
  name:    string;
  nameEn:  string;
  count:   number;
}

export interface ProductPage {
  products:    NativeProduct[];
  totalCount:  number;
  hasNextPage: boolean;
  currentPage: number;
}

export function normalizeSearchRow(row: SearchProductRow): NativeProduct {
  const stock = Number(row.stock ?? 0);
  return {
    id:              row.id,
    code:            row.code ?? "",
    barcode:         row.barcode ?? "",
    name:            row.name_ar ?? row.name_en ?? "",
    nameAr:          row.name_ar ?? undefined,
    nameEn:          row.name_en ?? undefined,
    price:           Number(row.price ?? 0),
    stock,
    inStock:         stock > 0,
    category:        row.category_name ?? "",
    categoryName:    row.category_name ?? "",
    categoryNameEn:  row.category_name_en ?? "",
    imageUrl:        row.image_url ?? undefined,
    ratingAvg:       row.rating_avg ?? null,
    ratingCount:     row.rating_count ?? null,
    discountPercent: row.discount_percent ?? null,
    isNew:           row.is_new ?? false,
    isBestseller:    row.is_bestseller ?? false,
    isSale:          row.is_sale ?? false,
  };
}

export function normalizeRawRow(row: RawProductRow): NativeProduct {
  const stock = Number(row.Stock ?? 0);
  return {
    id:              row.id,
    code:            row.Code ?? "",
    barcode:         row.Barcode ?? "",
    name:            row.Name_Ar ?? row.Name_En ?? "",
    nameAr:          row.Name_Ar ?? undefined,
    nameEn:          row.Name_En ?? undefined,
    price:           Number(row.Price ?? 0),
    stock,
    inStock:         Boolean(row.is_active) && stock > 0,
    category:        row.Category_Name ?? "",
    categoryName:    row.Category_Name ?? "",
    categoryNameEn:  row.Category_Name_En ?? "",
    imageUrl:        row.image_url ?? undefined,
    ratingAvg:       row.rating_avg ?? null,
    ratingCount:     row.rating_count ?? null,
    discountPercent: row.discount_percent ?? null,
    isNew:           row.is_new ?? false,
    isBestseller:    row.is_bestseller ?? false,
    isSale:          row.is_sale ?? false,
  };
}
