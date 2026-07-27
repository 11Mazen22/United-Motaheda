/**
 * driver-location — Supabase Edge Function
 *
 * Receives a GPS ping from an authenticated driver and writes it to
 * public.driver_locations.
 *
 * Called by:
 *   - apps/shopper-native/src/features/driver/api.ts  pushDriverLocation()
 *   - apps/shopper-web/src/services/logisticsApi.ts    pushDriverLocation()
 *
 * Expected request body (DriverLocationPayload — both clients):
 *   {
 *     driver_id:       string   // must equal auth.uid()
 *     order_id:        string
 *     lat:             number
 *     lng:             number
 *     accuracy_meters: number?
 *     speed_kmh:       number?
 *     heading:         number?
 *     battery_level:   number?  // web-only field — accepted and ignored
 *     captured_at:     string?  // ISO-8601; defaults to now() if absent
 *   }
 *
 * Response on success:  { "ok": true }
 * Response on error:    { "error": "<message>" }  with appropriate status
 *
 * Auth model (mirrors create-order/index.ts exactly):
 *   - callerClient  created with anon key + caller's Authorization header
 *     → used only to verify JWT and read uid
 *   - adminClient   created with service-role key
 *     → used only for the INSERT so it bypasses RLS for performance;
 *       all authorization checks are performed in application code before
 *       the INSERT, so the service-role bypass is intentional and auditable
 *
 * Authorization checks (in order):
 *   1. Valid Supabase JWT present
 *   2. driver_id in payload === auth.uid() (prevents impersonation)
 *   3. Caller has role = 'driver' in profiles (prevents customers/staff
 *      from writing fake pings)
 *   4. An accepted delivery_assignment exists for (order_id, driver_id)
 *      (prevents pings for orders the driver is not assigned to)
 *
 * Payload validation:
 *   - lat must be in [-90, 90]
 *   - lng must be in [-180, 180]
 *   - captured_at, if provided, must parse as a valid date and not be
 *     more than 5 minutes in the future (clock skew guard)
 *
 * Idempotency: no deduplication — duplicate pings are inserted as separate
 * rows. The track-order function always reads the latest by captured_at, so
 * duplicates are harmless and dedup logic would add latency for no benefit.
 *
 * Deploy: supabase functions deploy driver-location
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Maximum allowed clock skew for captured_at (5 minutes). */
const MAX_FUTURE_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
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
  const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth: verify JWT ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  // Caller-scoped client — only used to verify the JWT and read uid/role.
  // Matches the pattern established in create-order/index.ts.
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

  const {
    driver_id,
    order_id,
    lat,
    lng,
    accuracy_meters,
    speed_kmh,
    heading,
    // battery_level intentionally accepted and discarded (web-only field)
    captured_at: capturedAtRaw,
  } = body as {
    driver_id?:       unknown;
    order_id?:        unknown;
    lat?:             unknown;
    lng?:             unknown;
    accuracy_meters?: unknown;
    speed_kmh?:       unknown;
    heading?:         unknown;
    battery_level?:   unknown;
    captured_at?:     unknown;
  };

  // ── Payload validation ───────────────────────────────────────────────────────
  if (typeof driver_id !== "string" || !driver_id.trim()) {
    return json({ error: "driver_id is required" }, 400);
  }
  if (typeof order_id !== "string" || !order_id.trim()) {
    return json({ error: "order_id is required" }, 400);
  }
  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
    return json({ error: "lat must be a finite number in [-90, 90]" }, 400);
  }
  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
    return json({ error: "lng must be a finite number in [-180, 180]" }, 400);
  }

  // Resolve captured_at — use provided value if valid, otherwise now().
  let capturedAt: string;
  if (typeof capturedAtRaw === "string" && capturedAtRaw.trim()) {
    const parsed = Date.parse(capturedAtRaw);
    if (!Number.isFinite(parsed)) {
      return json({ error: "captured_at must be a valid ISO-8601 date string" }, 400);
    }
    if (parsed > Date.now() + MAX_FUTURE_MS) {
      return json({ error: "captured_at must not be more than 5 minutes in the future" }, 400);
    }
    capturedAt = new Date(parsed).toISOString();
  } else {
    capturedAt = new Date().toISOString();
  }

  // Sanitise optional numeric fields — null if absent or non-finite.
  const safeAccuracy = isFiniteNumber(accuracy_meters) && accuracy_meters >= 0
    ? accuracy_meters : null;
  const safeSpeed    = isFiniteNumber(speed_kmh)       && speed_kmh >= 0
    ? speed_kmh : null;
  const safeHeading  = isFiniteNumber(heading)         && heading >= 0 && heading <= 360
    ? heading : null;

  // ── Authorization check 1: driver_id must equal auth.uid() ──────────────────
  if (driver_id.trim() !== user.id) {
    return json({ error: "driver_id does not match authenticated user" }, 403);
  }

  // ── Authorization check 2: caller must have role = 'driver' ─────────────────
  const { data: profile, error: profileError } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return json({ error: "Could not verify driver profile" }, 403);
  }
  if (profile.role !== "driver") {
    return json({ error: "Forbidden — driver role required" }, 403);
  }

  // ── Authorization check 3: accepted assignment must exist ───────────────────
  // Uses the service-role client so this read is not subject to the driver's
  // own RLS policies (which filter delivery_assignments by driver_id anyway,
  // but we want to be explicit and avoid a second round-trip auth evaluation).
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: assignment, error: assignmentError } = await adminClient
    .from("delivery_assignments")
    .select("id")
    .eq("order_id",        order_id.trim())
    .eq("driver_id",       user.id)
    .eq("response_status", "accepted")
    .maybeSingle();

  if (assignmentError) {
    return json({ error: "Could not verify delivery assignment" }, 500);
  }
  if (!assignment) {
    return json({ error: "No accepted assignment found for this order" }, 403);
  }

  // ── Insert location ping ─────────────────────────────────────────────────────
  const { error: insertError } = await adminClient
    .from("driver_locations")
    .insert({
      order_id:        order_id.trim(),
      driver_id:       user.id,
      lat,
      lng,
      accuracy_meters: safeAccuracy,
      heading:         safeHeading,
      speed_kmh:       safeSpeed,
      captured_at:     capturedAt,
    });

  if (insertError) {
    console.error("[driver-location] insert failed:", insertError.message);
    return json({ error: "Failed to record location" }, 500);
  }

  return json({ ok: true });
});
