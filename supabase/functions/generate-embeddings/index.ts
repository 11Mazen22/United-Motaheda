/**
 * generate-embeddings — Supabase Edge Function (Product Intelligence Stage 4
 * worker half; the SQL half is supabase/migrations/20260826093000_product_
 * intelligence_stage4_embeddings.sql).
 *
 * Polls public.products_pending_embedding() for rows whose embedding is NULL
 * (never embedded yet, or invalidated by the products_invalidate_embedding
 * trigger after a name/category edit), embeds each one's search_document
 * locally via gte-small (see ../_shared/embeddings.ts — runs inside the
 * Supabase Edge Runtime, no external AI API, no key), and writes the vector
 * back via set_product_embedding — or bumps embedding_failed_attempts via
 * mark_product_embedding_failed if inference fails, so a single bad row
 * doesn't loop forever (the SQL side stops offering a row after 5 failures).
 *
 * This is a batch worker, not a one-shot backfill tool: each invocation
 * processes one small batch (BATCH_SIZE) and returns how many it did/failed,
 * plus `remainingHint` (true if the batch was full, i.e. more likely pending).
 * Run it on a schedule so the catalog converges over time without ever
 * blocking a request:
 *
 *   - Recommended: pg_cron + pg_net, scheduled from SQL:
 *       select cron.schedule('generate-embeddings-tick', '*\/2 * * * *', $$
 *         select net.http_post(
 *           url := '<project-url>/functions/v1/generate-embeddings',
 *           headers := jsonb_build_object(
 *             'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
 *             'Content-Type', 'application/json'
 *           )
 *         );
 *       $$);
 *     (store a dedicated random CRON_SECRET — NOT the service role key — as
 *     a Vault secret named 'cron_secret', and set the same value as this
 *     function's own CRON_SECRET secret. See
 *     20260826971000_fix_generate_embeddings_cron_auth.sql for why: the
 *     platform's auto-injected SUPABASE_SERVICE_ROLE_KEY value depends on
 *     which key system the project is on and isn't safe to compare against
 *     directly.)
 *   - Or manually / from any external scheduler: `supabase functions invoke
 *     generate-embeddings` (uses the CLI's own service-role auth), or a plain
 *     authenticated POST with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Security: this worker only ever runs with service-role privileges
 * (products_pending_embedding / set_product_embedding / mark_product_
 * embedding_failed are all service_role-only grants) — the RPCs themselves
 * enforce that. The HTTP endpoint is additionally gated by a dedicated
 * CRON_SECRET (not the service-role key) so only the scheduled cron job can
 * trigger it. It is never called from the client app.
 *
 * Deploy: supabase functions deploy generate-embeddings
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

// Empirically, this function hits Supabase's own per-invocation CPU/wall-
// clock execution limit after ~5s regardless of BATCH_SIZE (confirmed via a
// direct synchronous call, bypassing pg_net/pg_cron entirely, that still
// got cut off at ~5.0s with a platform-level error). ~15-16 items/invocation
// is the realistic ceiling either way, so BATCH_SIZE just needs to comfortably
// cover that — asking for more only adds wasted candidate-fetch overhead
// against the same fixed time budget. Throughput now comes from invocation
// *frequency* (see the cron schedule), not batch size.
const BATCH_SIZE = 20;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Gate on a dedicated CRON_SECRET rather than the service-role key itself.
  // Supabase's own auto-injected SUPABASE_SERVICE_ROLE_KEY changes format
  // depending on project key-system state (legacy JWT vs. new sb_secret_...
  // key), so comparing against it directly is brittle and broke once the
  // platform switched formats out from under this function. CRON_SECRET is
  // a value we mint and control end-to-end (Vault + this function's own
  // secret), so it never drifts. SERVICE_ROLE_KEY below is still used only
  // to build the privileged Postgres client, whatever format it's in.
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return json({ error: "Unauthorized — this worker requires cron auth" }, 401);
  }

  const provider = resolveEmbeddingProvider();
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: pending, error } = await client.rpc("products_pending_embedding", { p_limit: BATCH_SIZE });
  if (error) {
    console.error("[generate-embeddings] products_pending_embedding failed:", error.message);
    return json({ error: "Failed to fetch pending products" }, 500);
  }

  const rows = (pending ?? []) as { id: string; search_document: string }[];
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    const vector = await provider.embed(row.search_document);
    if (!vector) {
      failed++;
      await client.rpc("mark_product_embedding_failed", { p_id: row.id });
      continue;
    }

    const { error: writeError } = await client.rpc("set_product_embedding", {
      p_id: row.id,
      p_embedding: vector,
      p_model: "gte-small",
    });

    if (writeError) {
      console.error(`[generate-embeddings] set_product_embedding failed for ${row.id}:`, writeError.message);
      failed++;
      await client.rpc("mark_product_embedding_failed", { p_id: row.id });
    } else {
      processed++;
    }
  }

  return json({ processed, failed, remainingHint: rows.length === BATCH_SIZE });
});
