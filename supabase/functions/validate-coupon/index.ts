/**
 * validate-coupon — Supabase Edge Function
 *
 * Validates a coupon code against all server-side rules and returns
 * the concrete discount amount or a typed failure reason.
 *
 * This function is a pure READ operation — it does NOT write a
 * coupon_redemptions row. The redemption is recorded atomically by the
 * create-order Edge Function after the order is committed.
 *
 * Auth model:
 *   JWT-authenticated (caller's Supabase session). The validate_coupon
 *   database RPC uses auth.uid() internally for the per-user checks.
 *   Anonymous callers receive { valid: false, reason: 'not_found' } from
 *   the RPC — this Edge Function will 401 before reaching the RPC.
 *
 * Request body:
 *   { code: string, order_subtotal: number }
 *
 * Response (success):
 *   {
 *     valid:            true,
 *     coupon_id:        string,
 *     code:             string,
 *     discount_type:    'percentage' | 'fixed_amount',
 *     discount_value:   number,
 *     discount_amount:  number,   // concrete EGP amount off the order
 *     min_order_amount: number | null,
 *     first_order_only: boolean,
 *   }
 *
 * Response (failure):
 *   {
 *     valid:  false,
 *     reason: 'not_found' | 'inactive' | 'expired' | 'limit_reached'
 *             | 'already_redeemed' | 'first_order_only'
 *             | 'min_order_not_met'
 *     min_order_amount?: number   // present when reason = 'min_order_not_met'
 *   }
 *
 * Deploy: supabase functions deploy validate-coupon
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Environment ─────────────────────────────────────────────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  // Caller-scoped client — JWT is validated by getUser().
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid or expired session" }, 401);
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return json({ error: "code is required" }, 400);
  }

  const orderSubtotal = typeof body.order_subtotal === "number"
    ? body.order_subtotal
    : typeof body.order_subtotal === "string"
      ? parseFloat(body.order_subtotal)
      : NaN;

  if (!Number.isFinite(orderSubtotal) || orderSubtotal < 0) {
    return json({ error: "order_subtotal must be a non-negative number" }, 400);
  }

  // ── Validate via DB RPC ──────────────────────────────────────────────────────
  // validate_coupon is SECURITY DEFINER and uses the caller's auth.uid()
  // (set by the anon-key + Authorization header client) for per-user checks.
  const { data: result, error: rpcError } = await callerClient.rpc(
    "validate_coupon",
    {
      p_code:           code.toUpperCase(),
      p_order_subtotal: orderSubtotal,
    },
  );

  if (rpcError) {
    console.error("[validate-coupon] RPC error:", rpcError.message);
    return json({ error: "Validation service unavailable. Please try again." }, 500);
  }

  // The RPC returns a jsonb object — cast and forward directly.
  return json(result as Record<string, unknown>);
});
