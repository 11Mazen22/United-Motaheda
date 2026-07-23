import { getSupabaseClient } from "../lib/supabaseClient";

export type PromotionDiscountType = "percentage" | "fixed_amount";
export type PromotionStatus = "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
  status: PromotionStatus;
  productIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromotionInput {
  name: string;
  description?: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  status: PromotionStatus;
  productIds: string[];
}

export type PromotionProductStockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
export type PromotionProductSort = "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";

export interface PromotionProduct {
  id: string;
  code: string;
  barcode: string;
  name: string;
  nameAr: string;
  nameEn: string;
  price: number;
  effectivePrice: number;
  stock: number;
  category: string;
  categoryName: string;
  categoryNameEn: string;
  imageUrl?: string;
  promotionId?: string;
  promotionName?: string;
}

export interface PromotionProductPage {
  products: PromotionProduct[];
  total: number;
}

export interface PromotionConflict {
  productId: string;
  promotionId: string;
  promotionName: string;
  startsAt: string;
  endsAt: string;
  status: PromotionStatus;
}

type PromotionRow = {
  id: string; name: string; description: string | null; discount_type: PromotionDiscountType;
  discount_value: number | string; starts_at: string; ends_at: string; is_enabled: boolean;
  status?: PromotionStatus; created_at: string; updated_at?: string;
  promotion_products?: Array<{ product_id: string }>;
};

type PromotionProductRow = {
  id: string; code: string | null; barcode: string | null; name: string | null;
  name_ar: string | null; name_en: string | null; price: number | string | null;
  effective_price?: number | string | null; stock: number | string | null; category: string | null;
  category_name: string | null; category_name_en: string | null; image_url: string | null;
  promotion_id?: string | null; promotion_name?: string | null; total_count: number | string | null;
};

type PromotionConflictRow = {
  product_id: string; promotion_id: string; promotion_name: string;
  starts_at: string; ends_at: string; status: PromotionStatus;
};

function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id, name: row.name, description: row.description,
    discountType: row.discount_type, discountValue: Number(row.discount_value),
    startsAt: row.starts_at, endsAt: row.ends_at, isEnabled: row.is_enabled,
    status: row.status ?? (row.is_enabled ? "active" : "paused"),
    productIds: row.promotion_products?.map((entry) => entry.product_id) ?? [],
    createdAt: row.created_at, updatedAt: row.updated_at ?? row.created_at,
  };
}

function validate(input: PromotionInput): void {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new Error("Promotion name must be 2–120 characters.");
  if ((input.description?.trim().length ?? 0) > 500) throw new Error("Promotion description cannot exceed 500 characters.");
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) throw new Error("Discount value must be greater than zero.");
  if (input.discountType === "percentage" && input.discountValue > 100) throw new Error("Percentage discounts cannot exceed 100%.");
  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) throw new Error("The promotion must end after it starts.");
  if (input.status === "expired" && endsAt > Date.now()) throw new Error("Expired status requires an end date in the past.");
  if (input.productIds.length === 0) throw new Error("Choose at least one product.");
}

const PROMOTION_SELECT = "id,name,description,discount_type,discount_value,starts_at,ends_at,is_enabled,status,created_at,updated_at,promotion_products(product_id)";
const LEGACY_PROMOTION_SELECT = "id,name,description,discount_type,discount_value,starts_at,ends_at,is_enabled,created_at,promotion_products(product_id)";

function isMissingLifecycleSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code?.toUpperCase();
  const message = error.message?.toLowerCase() ?? "";
  return code === "42703" || code === "42883" || code === "PGRST202"
    || message.includes("does not exist")
    || message.includes("could not find the function")
    || message.includes("function public.admin_detect_promotion_conflicts")
    || message.includes("the conflict-check migration has not been applied");
}

/** The legacy fallback keeps the existing page readable while a deployment is
 * rolling out the lifecycle migration. Writes still require the migration. */
export async function fetchPromotions(opts?: { signal?: AbortSignal }): Promise<Promotion[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from("promotions").select(PROMOTION_SELECT).order("starts_at", { ascending: false });
  if (opts?.signal) query = query.abortSignal(opts.signal) as typeof query;
  const current = await query;
  if (!current.error) return (current.data as PromotionRow[] ?? []).map(toPromotion);
  if (!isMissingLifecycleSchema(current.error)) throw new Error(`Could not load promotions: ${current.error.message}`);
  let legacyQuery = supabase.from("promotions").select(LEGACY_PROMOTION_SELECT).order("starts_at", { ascending: false });
  if (opts?.signal) legacyQuery = legacyQuery.abortSignal(opts.signal) as typeof legacyQuery;
  const legacy = await legacyQuery;
  if (legacy.error) throw new Error(`Could not load promotions: ${legacy.error.message}`);
  return (legacy.data as PromotionRow[] ?? []).map(toPromotion);
}

async function fetchPromotion(id: string): Promise<Promotion> {
  const supabase = getSupabaseClient();
  let { data, error } = await supabase.from("promotions").select(PROMOTION_SELECT).eq("id", id).single();
  if (error && isMissingLifecycleSchema(error)) {
    ({ data, error } = await supabase.from("promotions").select(LEGACY_PROMOTION_SELECT).eq("id", id).single());
  }
  if (error || !data) throw new Error(`Promotion saved but could not be reloaded: ${error?.message ?? "not found"}`);
  return toPromotion(data as PromotionRow);
}

export async function savePromotion(input: PromotionInput, id?: string): Promise<Promotion> {
  validate(input);
  const supabase = getSupabaseClient();
  const payload = {
    p_id: id ?? null, p_name: input.name.trim(), p_description: input.description?.trim() || "",
    p_discount_type: input.discountType, p_discount_value: input.discountValue,
    p_starts_at: input.startsAt, p_ends_at: input.endsAt,
    p_is_enabled: input.status === "scheduled" || input.status === "active",
    p_product_ids: [...new Set(input.productIds)], p_status: input.status,
  };
  const { data: promotionId, error } = await supabase.rpc("admin_save_promotion", payload);
  if (error || !promotionId) {
    const detail = isMissingLifecycleSchema(error)
      ? "The promotion lifecycle migration has not been applied."
      : error?.message ?? "no promotion returned";
    throw new Error(`Could not save promotion: ${detail}`);
  }
  return fetchPromotion(promotionId);
}

export async function setPromotionStatus(id: string, status: PromotionStatus): Promise<Promotion> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_set_promotion_status", { p_promotion_id: id, p_status: status });
  if (!error) return fetchPromotion(id);
  const detail = isMissingLifecycleSchema(error)
    ? "The promotion lifecycle migration has not been applied."
    : error.message;
  throw new Error(`Could not update promotion: ${detail}`);
}

/** Backward-compatible convenience for the enable/disable actions. */
export function setPromotionEnabled(id: string, isEnabled: boolean): Promise<Promotion> {
  return setPromotionStatus(id, isEnabled ? "active" : "paused");
}

export async function searchPromotionProducts(params: {
  query?: string;
  category?: string;
  stockStatus?: PromotionProductStockFilter;
  sort?: PromotionProductSort;
  locale?: "ar" | "en";
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<PromotionProductPage> {
  const {
    query = "", category = "", stockStatus = "all", sort = "name_asc", locale = "en",
    page = 1, pageSize = 24, signal,
  } = params;
  let request = getSupabaseClient().rpc("admin_search_promotion_products_v2", {
    p_query: query.trim() || null,
    p_category: category || null,
    p_stock_status: stockStatus,
    p_sort: sort,
    p_locale: locale,
    p_page: page,
    p_page_size: pageSize,
  });
  if (signal) request = request.abortSignal(signal) as typeof request;
  const { data, error } = await request;

  if (error && isMissingLifecycleSchema(error)) {
    let fallback = getSupabaseClient()
      .from("products")
      .select("id,Code,Barcode,Name,Name_Ar,Name_En,Price,Stock,Category,Category_Name,Category_Name_En,image_url", { count: "exact" })
      .eq("is_active", true);
    const trimmedQuery = query.trim().replace(/[,%()]/g, " ").trim();
    if (trimmedQuery) fallback = fallback.or(`Name.ilike.%${trimmedQuery}%,Name_Ar.ilike.%${trimmedQuery}%,Name_En.ilike.%${trimmedQuery}%,Code.ilike.%${trimmedQuery}%,Barcode.ilike.%${trimmedQuery}%`);
    if (category) fallback = fallback.eq("Category", category);
    if (stockStatus === "in_stock") fallback = fallback.gt("Stock", 0);
    if (stockStatus === "low_stock") fallback = fallback.gt("Stock", 0).lt("Stock", 10);
    if (stockStatus === "out_of_stock") fallback = fallback.lte("Stock", 0);
    const sortColumn = sort.startsWith("price") ? "Price" : sort.startsWith("stock") ? "Stock" : locale === "ar" ? "Name_Ar" : "Name_En";
    fallback = fallback
      .order(sortColumn, { ascending: sort.endsWith("asc") })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (signal) fallback = fallback.abortSignal(signal) as typeof fallback;
    const legacy = await fallback;
    if (legacy.error) throw new Error(`Could not load eligible products: ${legacy.error.message}`);
    return {
      products: (legacy.data ?? []).map((row: Record<string, unknown>) => {
        const price = Number(row.Price ?? 0);
        return {
          id: String(row.id), code: String(row.Code ?? ""), barcode: String(row.Barcode ?? ""),
          name: String(row.Name_En ?? row.Name_Ar ?? row.Name ?? ""), nameAr: String(row.Name_Ar ?? ""),
          nameEn: String(row.Name_En ?? ""), price, effectivePrice: price, stock: Number(row.Stock ?? 0),
          category: String(row.Category ?? ""), categoryName: String(row.Category_Name ?? ""),
          categoryNameEn: String(row.Category_Name_En ?? ""), imageUrl: typeof row.image_url === "string" ? row.image_url : undefined,
        };
      }),
      total: legacy.count ?? 0,
    };
  }
  if (error) throw new Error(`Could not load eligible products: ${error.message}`);
  const rows = (data ?? []) as PromotionProductRow[];
  return {
    products: rows.map((row) => ({
      id: row.id, code: row.code ?? "", barcode: row.barcode ?? "", name: row.name ?? row.name_en ?? row.name_ar ?? "",
      nameAr: row.name_ar ?? "", nameEn: row.name_en ?? "", price: Number(row.price ?? 0),
      effectivePrice: Number(row.effective_price ?? row.price ?? 0), stock: Number(row.stock ?? 0),
      category: row.category ?? "", categoryName: row.category_name ?? "", categoryNameEn: row.category_name_en ?? "",
      imageUrl: row.image_url ?? undefined, promotionId: row.promotion_id ?? undefined, promotionName: row.promotion_name ?? undefined,
    })),
    total: Number(rows[0]?.total_count ?? 0),
  };
}

export async function detectPromotionConflicts(params: {
  productIds: string[];
  startsAt: string;
  endsAt: string;
  excludePromotionId?: string;
  signal?: AbortSignal;
}): Promise<PromotionConflict[]> {
  if (params.productIds.length === 0 || !params.startsAt || !params.endsAt) return [];
  let request = getSupabaseClient().rpc("admin_detect_promotion_conflicts", {
    p_product_ids: [...new Set(params.productIds)],
    p_starts_at: params.startsAt,
    p_ends_at: params.endsAt,
    p_exclude_promotion_id: params.excludePromotionId ?? null,
  });
  if (params.signal) request = request.abortSignal(params.signal) as typeof request;
  const { data, error } = await request;
  if (error) {
    if (isMissingLifecycleSchema(error)) {
      return [];
    }
    throw new Error(`Could not check promotion conflicts: ${error.message}`);
  }
  return ((data ?? []) as PromotionConflictRow[]).map((row) => ({
    productId: row.product_id,
    promotionId: row.promotion_id,
    promotionName: row.promotion_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  }));
}

export async function deletePromotion(id: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("admin_delete_promotion", { promotion_id: id });
  if (error) throw new Error(`Could not delete promotion: ${error.message}`);
}

export async function bulkEnablePromotions(ids: string[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc("admin_bulk_enable_promotions", { promotion_ids: ids });
  if (error) throw new Error(`Could not bulk enable: ${error.message}`);
}
export async function bulkDisablePromotions(ids: string[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc("admin_bulk_disable_promotions", { promotion_ids: ids });
  if (error) throw new Error(`Could not bulk disable: ${error.message}`);
}
export async function bulkDeletePromotions(ids: string[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc("admin_bulk_delete_promotions", { promotion_ids: ids });
  if (error) throw new Error(`Could not bulk delete: ${error.message}`);
}
