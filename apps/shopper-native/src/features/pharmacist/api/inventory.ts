/**
 * Pharmacist Inventory API — product catalogue with live stock levels.
 *
 * Uses the product_effective_prices view (created in
 * 20260716100000_platform_canonical_pricing_and_lifecycle.sql) which already
 * joins promotions, and the inventory table which tracks on_hand / reserved.
 *
 * The search_effective_products() RPC is used for full-text / barcode search.
 * For barcode lookup, p_query is the raw barcode string — the RPC already
 * matches against products.Barcode with ILIKE.
 */

import { supabase } from "@/lib/supabase";
import type { PharmacistProduct } from "./types";

// ─── Raw row shapes ─────────────────────────────────────────────────────────────

interface RawProductRow {
  id:                        string;
  code:                      string | null;
  barcode:                   string | null;
  name_ar:                   string | null;
  name_en:                   string | null;
  base_price:                number | string;
  effective_price:           number | string;
  stock:                     number | string;
  category_name:             string | null;
  image_url:                 string | null;
  is_active:                 boolean;
  has_active_promotion:      boolean;
}

interface RawInventoryRow {
  product_id: string;
  on_hand:    number | null;
  reserved:   number | null;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function mapProduct(
  row:  RawProductRow,
  inv?: RawInventoryRow,
): PharmacistProduct {
  const onHand   = inv ? num(inv.on_hand)   : num(row.stock);
  const reserved = inv ? num(inv.reserved)  : 0;
  return {
    id:             row.id,
    code:           row.code ?? null,
    barcode:        row.barcode ?? null,
    nameAr:         row.name_ar ?? null,
    nameEn:         row.name_en ?? null,
    name:           row.name_ar ?? row.name_en ?? row.id,
    price:          num(row.base_price),
    effectivePrice: num(row.effective_price),
    stock:          num(row.stock),
    onHand,
    reserved,
    available:      Math.max(0, onHand - reserved),
    categoryName:   row.category_name ?? null,
    imageUrl:       row.image_url ?? null,
    isActive:       row.is_active ?? true,
    hasPromotion:   row.has_active_promotion ?? false,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Full-text / barcode search using the search_effective_products() RPC.
 * Returns up to `limit` results. Pass a barcode string for exact lookup.
 */
export async function searchProducts(
  query:      string,
  options?: {
    inStockOnly?: boolean;
    limit?:       number;
    offset?:      number;
  },
): Promise<PharmacistProduct[]> {
  const { data, error } = await supabase.rpc("search_effective_products", {
    p_query:    query.trim(),
    p_category: null,
    p_in_stock: options?.inStockOnly ?? false,
    p_min_price: null,
    p_max_price: null,
    p_is_sale:   false,
    p_sort:      "name_asc",
    p_limit:     options?.limit  ?? 30,
    p_offset:    options?.offset ?? 0,
  });

  if (error) throw error;
  return ((data ?? []) as unknown as RawProductRow[]).map((r) => mapProduct(r));
}

/**
 * Look up a single product by barcode — used by the barcode scanner screen.
 * Returns null if no active product matches.
 */
export async function getProductByBarcode(
  barcode: string,
): Promise<PharmacistProduct | null> {
  const results = await searchProducts(barcode, { limit: 1 });
  // Prefer exact barcode match; the RPC uses ILIKE which may return broad hits
  const exact = results.find(
    (p) => p.barcode?.toLowerCase() === barcode.toLowerCase(),
  );
  return exact ?? results[0] ?? null;
}

/**
 * Low-stock products — stock <= threshold (default 5).
 * Used for the dashboard alert widget and inventory screen filter.
 */
export async function getLowStockProducts(
  threshold = 5,
  limit     = 50,
): Promise<PharmacistProduct[]> {
  // Fetch from product_effective_prices view filtered by low stock.
  // The view exposes `stock` which mirrors products."Stock".
  const { data, error } = await supabase
    .from("product_effective_prices")
    .select(
      "id, code, barcode, name_ar, name_en, base_price, effective_price, " +
      "stock, category_name, image_url, is_active, has_active_promotion",
    )
    .eq("is_active", true)
    .lte("stock", threshold)
    .gt("stock", 0)
    .order("stock", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as unknown as RawProductRow[]).map((r) => mapProduct(r));
}

/**
 * Count of low-stock products — dashboard widget.
 */
export async function countLowStockProducts(threshold = 5): Promise<number> {
  const { count, error } = await supabase
    .from("product_effective_prices")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .lte("stock", threshold)
    .gt("stock", 0);

  if (error) throw error;
  return count ?? 0;
}
