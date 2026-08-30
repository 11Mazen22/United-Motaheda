// supabase/functions/delete-own-account/index.ts
//
// Self-service account deletion — a customer permanently deleting their own
// account. Separate from admin-privileged-actions (which is gated to
// admin/manager callers acting on OTHER users); this one only ever acts on
// the caller's own auth.users row, verified from their own JWT, never a
// user id supplied in the request body.
//
// auth.users -> profiles.id is ON DELETE CASCADE, and every user-owned
// table (addresses, orders' chain through profiles, cart_items, favorites,
// prescriptions, etc.) cascades from there, so a single
// auth.admin.deleteUser call is sufficient — no manual per-table cleanup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
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
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  // Scoped to the caller's own JWT — only used to establish who is calling.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: callerUser },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !callerUser) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    await adminClient.from("user_deletion_log").insert({
      deleted_user_id: callerUser.id,
      deleted_user_email: callerUser.email ?? null,
      deleted_user_name: (callerUser.user_metadata?.name as string | undefined) ?? null,
      deleted_by: callerUser.id,
      deletion_type: "self",
      reason: "User requested account deletion from the app",
    });
  } catch {
    // Best-effort audit trail — never block a user's own deletion request
    // over a logging failure.
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(callerUser.id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 400);
  }

  return jsonResponse({ success: true });
});
