/**
 * search-intelligence — Supabase Edge Function
 *
 * The orchestration layer for Product Intelligence Stages 2-4 sitting on top
 * of search_effective_products (Arabic-normalized hybrid FTS/trigram/word-
 * similarity ranking + synonym expansion, all in Postgres — see
 * supabase/migrations/20260826090000_product_intelligence_stage1_core.sql).
 *
 * IMPORTANT: this system calls NO external AI API. Not Anthropic, not OpenAI,
 * not OpenRouter, not anything outside Supabase. Every step below runs either
 * as a Postgres RPC on this project's own database, or as local inference
 * inside this Edge Function using Supabase's built-in gte-small embedding
 * model (see ../_shared/embeddings.ts) — nothing here ever makes a network
 * call to a third-party AI provider. "Intelligence" here means: deterministic
 * intent classification + hybrid lexical retrieval + Supabase-native semantic
 * (pgvector) retrieval, all owned end to end by this project.
 *
 * Architecture:
 *   USER QUERY → NORMALIZATION (done in-RPC) → DETERMINISTIC INTENT
 *     → LEXICAL RETRIEVAL (search_effective_products, real DB rows)
 *     → SEMANTIC SUPPLEMENT when lexical is thin (gte-small query embedding
 *       + search_products_semantic, real DB rows, deduped against lexical)
 *     → DETERMINISTIC EXPLANATION (a short template sentence per intent —
 *       not a generated one) → STRUCTURED RESPONSE
 *
 * The database is the source of truth end to end — this function never
 * invents a product; it only retrieves, dedupes, and orders real rows.
 *
 * Request body:
 *   {
 *     query: string,
 *     category?: string,
 *     inStock?: boolean,
 *     limit?: number,          // default 20, max 50
 *     recentQueries?: string[] // last 1-2 queries this session, unused by the
 *                               // deterministic path today but kept in the
 *                               // contract for a future follow-up heuristic
 *   }
 *
 * Response:
 *   {
 *     intent: SearchIntent,
 *     intentSource: "rule",
 *     products: <same row shape as search_effective_products>[],
 *     totalCount: number,
 *     aiExplanation: string | null,      // deterministic template, not model output
 *     aiConfidence: null,                // kept for client type stability, unused
 *     clarificationQuestion: string | null,
 *     provider: "none" | "supabase-embeddings",
 *   }
 *
 * Deploy: supabase functions deploy search-intelligence
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveEmbeddingProvider } from "../_shared/embeddings.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Deterministic intent classification ────────────────────────────────────
// Rule-based, no network call, no model — this is the ONLY intent classifier
// in this system, always on, never a fallback for something fancier.

export type SearchIntent =
  | "exact_product" | "product_family" | "ingredient" | "category"
  | "symptom_need" | "attribute_request" | "alternative_product"
  | "similar_product" | "brand_request" | "price_request"
  | "availability_request" | "broad_discovery" | "recent_product"
  | "unclear_query";

// Confirmed live: this list drifted out of sync with search_synonyms
// (the actual vocabulary table the DB-side expansion uses) — a query like
// "دواء لتخفيف الجراح" (wound-relief medicine) had none of its words here,
// so it fell through to the generic "attribute_request" fallback instead of
// "symptom_need", even after search_synonyms already knew "جراح"/"الجراح"
// meant antiseptic products. Added the wound/burn/heartburn/cough/cold-flu
// words from that same 20260826965000 migration so this classifier
// recognizes the same symptom vocabulary the DB actually expands.
const SYMPTOM_WORDS = [
  "صداع", "حرارة", "برد", "زكام", "كحة", "سعال", "حساسية", "احتقان", "الم", "ألم", "وجع", "نعاس", "دوخة", "غثيان", "اسهال", "إسهال", "امساك",
  "جرح", "جروح", "الجرح", "الجروح", "جراح", "الجراح", "حرق", "حروق", "الحروق", "حرقان", "حموضة", "الحموضة",
  "التهاب حلق", "التهاب الحلق", "نزلة برد", "انفلونزا", "رشح", "ارق", "الارق",
];
const ALTERNATIVE_WORDS = ["بديل", "زي", "شبه", "مثل", "بدل"];
const PRICE_WORDS = ["ارخص", "أرخص", "رخيص", "سعر", "أوفر", "اوفر"];
const AVAILABILITY_WORDS = ["هل عندكم", "متوفر", "موجود", "عندكوا"];
const RECENT_WORDS = ["اللي شوفته", "اللي كنت شايفه", "اللي كنت شايفها", "قبل كده", "من قبل"];
const BROAD_WORDS = ["منتجات", "حاجات", "اي حاجة", "أي حاجة"];

function classifyIntent(query: string): SearchIntent {
  const q = query.trim();
  if (!q) return "unclear_query";
  const lower = q.toLowerCase();

  if (RECENT_WORDS.some((w) => q.includes(w))) return "recent_product";
  if (AVAILABILITY_WORDS.some((w) => q.includes(w))) return "availability_request";
  if (ALTERNATIVE_WORDS.some((w) => q.includes(w))) {
    return PRICE_WORDS.some((w) => q.includes(w)) ? "alternative_product" : "similar_product";
  }
  if (PRICE_WORDS.some((w) => q.includes(w))) return "price_request";
  if (SYMPTOM_WORDS.some((w) => q.includes(w))) return "symptom_need";
  if (BROAD_WORDS.some((w) => q.includes(w))) return "broad_discovery";

  const tokenCount = q.split(/\s+/).length;
  if (tokenCount <= 2) return "exact_product";
  if (/[a-z]/.test(lower) && tokenCount <= 2) return "brand_request";
  return "attribute_request";
}

// ─── Deterministic explanation templates ────────────────────────────────────
// Short, fixed Arabic sentences keyed by intent — NOT model-generated text.
// This is what gives the UI its "hint bar" copy without ever calling a model.

const EXPLANATION_TEMPLATES: Partial<Record<SearchIntent, string>> = {
  symptom_need: "بنعرض لك منتجات قد تساعد في التخفيف من هذا العرض",
  alternative_product: "بنعرض لك بدائل متاحة بأسعار مختلفة",
  similar_product: "بنعرض لك منتجات مشابهة لما بحثت عنه",
  price_request: "تم ترتيب النتائج مع مراعاة السعر",
  availability_request: "دي المنتجات المتوفرة حالياً لدينا",
  broad_discovery: "بنعرض لك تشكيلة واسعة من المنتجات ذات الصلة",
  attribute_request: "بنعرض لك منتجات تطابق ما وصفته",
};

function buildExplanation(intent: SearchIntent, resultCount: number): string | null {
  if (resultCount === 0) return null;
  return EXPLANATION_TEMPLATES[intent] ?? null;
}

function buildClarification(intent: SearchIntent, resultCount: number): string | null {
  if (resultCount > 0) return null;
  if (intent === "unclear_query" || intent === "symptom_need") {
    return "ممكن توضح أكتر إيه اللي بتدور عليه؟ مثلاً اسم الدواء أو العرض اللي حاسس بيه";
  }
  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return json({ error: "query is required" }, 400);

  const category = typeof body.category === "string" ? body.category : null;
  const inStock = typeof body.inStock === "boolean" ? body.inStock : false;
  const limit = Math.max(1, Math.min(typeof body.limit === "number" ? body.limit : 20, 50));

  // ── Lexical retrieval — the real, authoritative database call ──────────────
  const { data: rows, error: rpcError } = await client.rpc("search_effective_products", {
    p_query: query,
    p_category: category,
    p_in_stock: inStock,
    p_min_price: null,
    p_max_price: null,
    p_is_sale: false,
    p_sort: "newest",
    p_limit: limit,
    p_offset: 0,
  });

  if (rpcError) {
    console.error("[search-intelligence] search_effective_products failed:", rpcError.message);
    return json({ error: "Search is temporarily unavailable. Please try again." }, 500);
  }

  let products = (rows ?? []) as Record<string, unknown>[];
  const totalCount = (products[0]?.total_count as number | undefined) ?? products.length;
  const ruleIntent = classifyIntent(query);
  let usedSemantic = false;

  // ── Semantic supplement — only when lexical didn't fill the page ───────────
  // Runs entirely inside Supabase: gte-small embeds the query locally in this
  // Edge Function, then search_products_semantic does the nearest-neighbor
  // lookup in Postgres/pgvector. No external call, no API key. Skipped
  // entirely once lexical retrieval already has enough rows — this is
  // recovery/enrichment, not a replacement for the lexical path.
  if (products.length < limit) {
    const embedding = await resolveEmbeddingProvider().embed(query);
    if (embedding) {
      // Confirmed live: at 0.5, this returned baby bibs/scissors/a pregnancy
      // test for a wound-medicine query — gte-small's Arabic discrimination
      // is markedly weaker than its English discrimination (it's primarily
      // English-trained), so 0.5 cosine similarity carries much less
      // "actually related" signal for Arabic queries than the number
      // suggests. Raised as a defense-in-depth measure now that the lexical
      // path (search_effective_products) has its own OR-based synonym fix,
      // which should already cover most Arabic symptom queries without ever
      // needing this fallback to fire at all.
      const { data: semanticRows, error: semanticError } = await client.rpc("search_products_semantic", {
        p_embedding: embedding,
        p_limit: limit - products.length + 5,
        p_min_similarity: 0.65,
      });

      if (!semanticError && semanticRows) {
        const existingIds = new Set(products.map((p) => String(p.id)));
        const supplement = (semanticRows as Record<string, unknown>[])
          .filter((r) => !existingIds.has(String(r.id)))
          .slice(0, limit - products.length)
          .map((r) => ({
            id: r.id,
            code: null,
            barcode: null,
            name_ar: r.name_ar,
            name_en: r.name_en,
            base_price: r.effective_price,
            effective_price: r.effective_price,
            stock: r.stock,
            category_name: r.category_name,
            category_name_en: r.category_name_en,
            image_url: r.image_url,
            rating_avg: null,
            rating_count: 0,
            is_new: false,
            is_bestseller: false,
            promotion_id: null,
            promotion_name: null,
            promotion_discount_type: null,
            promotion_discount_value: null,
            promotion_ends_at: null,
            has_active_promotion: false,
            discount_amount: 0,
            discount_percent: 0,
            total_count: totalCount,
          }));

        if (supplement.length > 0) {
          products = [...products, ...supplement];
          usedSemantic = true;
        }
      } else if (semanticError) {
        console.warn("[search-intelligence] search_products_semantic failed:", semanticError.message);
      }
    }
  }

  const resultCount = products.length;

  return json({
    intent: ruleIntent,
    intentSource: "rule" as const,
    products,
    totalCount: Math.max(totalCount, resultCount),
    aiExplanation: buildExplanation(ruleIntent, resultCount),
    aiConfidence: null,
    clarificationQuestion: buildClarification(ruleIntent, resultCount),
    provider: usedSemantic ? "supabase-embeddings" : "none",
  });
});
