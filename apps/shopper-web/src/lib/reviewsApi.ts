/**
 * reviewsApi.ts — Product reviews + ratings service.
 *
 * Backed by Supabase tables created in
 * database/20260623_create_product_reviews.sql.
 *
 * Graceful degradation: when the table does not exist yet (migration not
 * applied), list/stats return empty data instead of throwing. Mutations still
 * throw so the UI surfaces a clear error.
 */

import { getSupabaseClient } from "./supabaseClient";

export type ReviewSort = "helpful" | "recent" | "highest" | "lowest";

export interface ReviewRow {
  id:             string;
  product_id:     string;
  user_id:        string;
  author_name:    string;
  rating:         number;
  title:          string | null;
  body:           string | null;
  photos:         string[];
  helpful_count:  number;
  verified:       boolean;
  reported_count: number;
  created_at:     string;
  updated_at:     string;
}

export interface ReviewStats {
  totalReviews:   number;
  averageRating:  number;       // 0..5
  distribution:   [number, number, number, number, number]; // [1*, 2*, 3*, 4*, 5*] counts
  verifiedCount:  number;
  photoCount:     number;
}

export interface ListReviewsArgs {
  productId:   string;
  sort?:       ReviewSort;
  starFilter?: number;   // 1..5, otherwise undefined for no filter
  verifiedOnly?: boolean;
  withPhotosOnly?: boolean;
  limit?:      number;
  offset?:     number;
}

const EMPTY_STATS: ReviewStats = {
  totalReviews:  0,
  averageRating: 0,
  distribution:  [0, 0, 0, 0, 0],
  verifiedCount: 0,
  photoCount:    0,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // PostgREST: PGRST200 / PGRST205 — relation not found.
  // Postgres: 42P01 — undefined_table.
  return (
    error.code === "PGRST200" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /relation .* does not exist/i.test(error.message ?? "") ||
    /could not find the table/i.test(error.message ?? "")
  );
}

// ─── List reviews ───────────────────────────────────────────────────────────

export async function listReviews(args: ListReviewsArgs): Promise<ReviewRow[]> {
  const {
    productId,
    sort           = "helpful",
    starFilter,
    verifiedOnly   = false,
    withPhotosOnly = false,
    limit          = 50,
    offset         = 0,
  } = args;

  const supabase = getSupabaseClient();
  let q = supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .range(offset, offset + limit - 1);

  if (typeof starFilter === "number") q = q.eq("rating", starFilter);
  if (verifiedOnly)                   q = q.eq("verified", true);
  if (withPhotosOnly)                 q = q.not("photos", "eq", "{}");

  switch (sort) {
    case "recent":  q = q.order("created_at",    { ascending: false }); break;
    case "highest": q = q.order("rating",        { ascending: false }).order("helpful_count", { ascending: false }); break;
    case "lowest":  q = q.order("rating",        { ascending: true  }).order("helpful_count", { ascending: false }); break;
    case "helpful":
    default:        q = q.order("helpful_count", { ascending: false }).order("created_at",   { ascending: false }); break;
  }

  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(`[reviewsApi.listReviews] ${error.message}`);
  }
  return (data ?? []) as ReviewRow[];
}

// ─── Aggregate stats (uses the SQL view) ────────────────────────────────────

export async function getReviewStats(productId: string): Promise<ReviewStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("product_review_stats")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return EMPTY_STATS;
    // Other errors: log but return empty so UI doesn't break.
    console.warn("[reviewsApi.getReviewStats]", error.message);
    return EMPTY_STATS;
  }
  if (!data) return EMPTY_STATS;

  const row = data as Record<string, unknown>;
  return {
    totalReviews:  Number(row.total_reviews) || 0,
    averageRating: Number(row.average_rating) || 0,
    distribution: [
      Number(row.stars_1) || 0,
      Number(row.stars_2) || 0,
      Number(row.stars_3) || 0,
      Number(row.stars_4) || 0,
      Number(row.stars_5) || 0,
    ],
    verifiedCount: Number(row.verified_count) || 0,
    photoCount:    Number(row.photo_count)    || 0,
  };
}

// ─── Get current user's review for a product (if any) ───────────────────────

export async function getMyReview(productId: string, userId: string): Promise<ReviewRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(`[reviewsApi.getMyReview] ${error.message}`);
  }
  return (data ?? null) as ReviewRow | null;
}

// ─── Submit (insert or upsert via unique (product_id, user_id)) ─────────────

export interface SubmitReviewInput {
  productId:   string;
  userId:      string;
  authorName:  string;
  rating:      number;       // 1..5
  title?:      string;
  body?:       string;
  photos?:     string[];
  verified?:   boolean;
}

export async function upsertReview(input: SubmitReviewInput): Promise<ReviewRow> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be 1..5");
  }
  const supabase = getSupabaseClient();
  const payload = {
    product_id:  input.productId,
    user_id:     input.userId,
    author_name: input.authorName,
    rating:      input.rating,
    title:       input.title ?? null,
    body:        input.body  ?? null,
    photos:      input.photos ?? [],
    verified:    input.verified ?? false,
  };
  const { data, error } = await supabase
    .from("product_reviews")
    .upsert(payload, { onConflict: "product_id,user_id" })
    .select()
    .single();
  if (error) throw new Error(`[reviewsApi.upsertReview] ${error.message}`);
  return data as ReviewRow;
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteReview(reviewId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", userId);
  if (error) throw new Error(`[reviewsApi.deleteReview] ${error.message}`);
}

// ─── Helpful toggle (insert or remove vote) ─────────────────────────────────

export async function toggleHelpful(reviewId: string, userId: string): Promise<{ helpful: boolean }> {
  const supabase = getSupabaseClient();
  // Check if vote exists
  const { data: existing, error: selErr } = await supabase
    .from("review_helpful_votes")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr && !isMissingTableError(selErr)) {
    throw new Error(`[reviewsApi.toggleHelpful select] ${selErr.message}`);
  }
  if (existing) {
    const { error } = await supabase
      .from("review_helpful_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);
    if (error) throw new Error(`[reviewsApi.toggleHelpful delete] ${error.message}`);
    return { helpful: false };
  }
  const { error } = await supabase
    .from("review_helpful_votes")
    .insert({ review_id: reviewId, user_id: userId });
  if (error) throw new Error(`[reviewsApi.toggleHelpful insert] ${error.message}`);
  return { helpful: true };
}

// ─── User's helpful-voted review ids for a product ──────────────────────────

export async function listMyHelpfulVotes(productId: string, userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("review_helpful_votes")
    .select("review_id, product_reviews!inner(product_id)")
    .eq("user_id", userId)
    .eq("product_reviews.product_id", productId);
  if (error) {
    if (isMissingTableError(error)) return new Set();
    return new Set();
  }
  return new Set(((data ?? []) as { review_id: string }[]).map((r) => r.review_id));
}
