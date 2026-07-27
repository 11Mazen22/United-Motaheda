/**
 * track-order — Supabase Edge Function
 *
 * Returns a TrackingSnapshot for one order identified by (order_id, token).
 * The token is orders.qr_token — a unique, hex-encoded column generated at
 * order creation time (see apps/api/prisma/schema.prisma line 566 and the
 * idx_orders_qr_token partial index in database/performance_indexes.sql).
 *
 * Called by:
 *   - apps/shopper-web/src/services/logisticsApi.ts  fetchTrackingSnapshot()
 *
 * Expected request body:
 *   {
 *     order_id: string   // UUID
 *     token:    string   // orders.qr_token value
 *   }
 *
 * Response contract — must match TrackingSnapshot exactly as defined in
 * apps/shopper-web/src/services/logisticsApi.ts lines 74–95:
 *   {
 *     order: {
 *       id:           string
 *       status:       string
 *       destination:  Record<string, unknown>   // customer_address JSON blob
 *       customer_lat: number | null
 *       customer_lng: number | null
 *     }
 *     driver: {
 *       first_name: string
 *       phone:      string
 *     } | null
 *     location: {
 *       lat:         number
 *       lng:         number
 *       captured_at: string
 *     } | null
 *   }
 *
 * Auth model:
 *   This endpoint is intentionally token-authenticated, not JWT-authenticated.
 *   The qr_token acts as a bearer capability — knowing the token is
 *   sufficient to read tracking state for that order. This matches the web
 *   client's design (OrderTracking.tsx reads ?token= from the URL; it is
 *   intended to be shareable as a tracking link, e.g. via SMS).
 *
 *   The service-role client is used for all DB reads so no caller session
 *   is required. All data exposure is limited to the fields this function
 *   explicitly returns — no full order rows are forwarded to the client.
 *
 * Stale location policy:
 *   If the most recent driver_locations row has captured_at older than
 *   STALE_THRESHOLD_MS (10 minutes), location is returned as null with
 *   the snapshot still populated. The web client already handles
 *   location: null gracefully (fetchTrackingSnapshotByOrderId returns
 *   null and the UI shows a "live tracking unavailable" state).
 *
 * Driver name resolution:
 *   orders.assigned_driver_id → auth.users.id = profiles.id
 *   We select first_name from profiles.full_name (split on first space)
 *   and phone from profiles.phone — matching the fields the web client
 *   renders in its driver card.
 *
 * Deploy: supabase functions deploy track-order
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Location pings older than this are treated as unavailable.
 * 10 minutes — generous enough to handle brief connectivity gaps on
 * the driver's device, tight enough to not show wildly stale position.
 */
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Extract a driver's display first name from a full_name string. */
function firstNameFrom(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Environment ─────────────────────────────────────────────────────────────
  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const order_id = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const token    = typeof body.token    === "string" ? body.token.trim()    : "";

  if (!order_id) return json({ error: "order_id is required" }, 400);
  if (!token)    return json({ error: "token is required" }, 400);

  // ── Service-role client — token-authenticated endpoint ───────────────────────
  // No caller JWT is required: the qr_token is the bearer capability.
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Resolve order by (id, qr_token) ─────────────────────────────────────────
  // Both columns are queried together so a valid token for a different order
  // cannot be used to read this order's tracking state.
  const { data: order, error: orderError } = await db
    .from("orders")
    .select([
      "id",
      "status",
      "customer_address",
      "customer_lat",
      "customer_lng",
      "assigned_driver_id",
    ].join(","))
    .eq("id",       order_id)
    .eq("qr_token", token)
    .maybeSingle();

  if (orderError) {
    console.error("[track-order] order lookup failed:", orderError.message);
    return json({ error: "Failed to retrieve order" }, 500);
  }
  if (!order) {
    // 404 rather than 403 — don't reveal whether the order exists with a
    // different token. Both cases look identical to the caller.
    return json({ error: "Order not found" }, 404);
  }

  const assignedDriverId: string | null = order.assigned_driver_id ?? null;

  // ── Driver profile ───────────────────────────────────────────────────────────
  // Resolve only if an assigned_driver_id is present. full_name → first_name
  // split happens here so the raw name is never forwarded to the client.
  let driverPayload: { first_name: string; phone: string } | null = null;

  if (assignedDriverId) {
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, phone")
      .eq("id", assignedDriverId)
      .maybeSingle();

    if (profile) {
      driverPayload = {
        first_name: firstNameFrom(profile.full_name as string | null),
        phone:      (profile.phone as string | null) ?? "",
      };
    }
  }

  // ── Latest driver location ────────────────────────────────────────────────────
  // Uses the (order_id, captured_at desc) index created in the migration.
  // Only returns a ping if it is within STALE_THRESHOLD_MS — stale pings
  // are suppressed so the client shows "location unavailable" rather than
  // an outdated map marker.
  let locationPayload: { lat: number; lng: number; captured_at: string } | null = null;

  const { data: ping, error: pingError } = await db
    .from("driver_locations")
    .select("lat, lng, captured_at")
    .eq("order_id", order_id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pingError) {
    // Non-fatal: location is optional in the TrackingSnapshot contract.
    // Log and continue — the client will show the status-only view.
    console.error("[track-order] location lookup failed:", pingError.message);
  } else if (ping) {
    const ageMs = Date.now() - Date.parse(ping.captured_at as string);
    if (Number.isFinite(ageMs) && ageMs <= STALE_THRESHOLD_MS) {
      locationPayload = {
        lat:         ping.lat as number,
        lng:         ping.lng as number,
        captured_at: ping.captured_at as string,
      };
    }
    // If ageMs > STALE_THRESHOLD_MS, locationPayload remains null.
    // The client renders a "location temporarily unavailable" state.
  }

  // ── Build and return TrackingSnapshot ────────────────────────────────────────
  // Shape must match apps/shopper-web/src/services/logisticsApi.ts TrackingSnapshot.
  return json({
    order: {
      id:           order.id as string,
      status:       (order.status as string) ?? "pending",
      destination:  (order.customer_address as Record<string, unknown>) ?? {},
      customer_lat: (order.customer_lat as number | null) ?? null,
      customer_lng: (order.customer_lng as number | null) ?? null,
    },
    driver:   driverPayload,
    location: locationPayload,
  });
});
