// supabase/functions/admin-privileged-actions/index.ts
//
// Service-role-key-backed privileged account actions, callable only by an
// authenticated admin/manager. Committed to the repo (unlike this project's
// two existing Edge Functions, driver-batch-scan/driver-location, which are
// deployed but not in version control) — new privileged infrastructure
// shouldn't repeat that gap.
//
// Actions:
//   create_staff      — the actual fix for onboarding: adminStaffApi.ts's
//                        createStaffUserViaSuperAdmin() called
//                        supabase.auth.admin.createUser() through the
//                        normal anon-key client, which GoTrue rejects
//                        outright — admin endpoints require the
//                        service-role key, which only exists server-side,
//                        here.
//   set_account_lock  — auth.admin.updateUserById(id, { ban_duration }).
//                        Blocks future sign-in/token-refresh; does NOT kill
//                        an already-open session — that's what
//                        AuthContext's realtime listener (both apps) is
//                        for, see its own comment for why both layers are
//                        needed together.
//   reset_sessions    — same mechanism, a short self-clearing duration long
//                        enough to outlast any in-flight access token, then
//                        lifts automatically with no follow-up call needed.
//
// Every action re-verifies the caller is admin/manager INSIDE this
// function — never trust client-side gating for a service-role-backed
// endpoint. This re-implements the same profiles.role check is_manager()
// does at the DB layer, since a service-role Edge Function call has no
// Postgres session context for is_manager()'s auth.uid() to read from.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Deploy: supabase functions deploy admin-privileged-actions

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["admin", "manager", "pharmacist", "driver"] as const;
const STAFF_STATUSES = ["Active", "Inactive", "Suspended"] as const;

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

  // Client scoped to the CALLER's own JWT (anon key + their Authorization
  // header, matching create-order/index.ts's established pattern) — used
  // only to verify who's calling and their role, never for the privileged
  // action itself. Deliberately NOT the service-role key here: this client's
  // profiles read should stay subject to normal RLS, not bypass it.
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

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .maybeSingle();

  const callerRole = callerProfile?.role as string | undefined;
  if (callerRole !== "admin" && callerRole !== "manager") {
    return jsonResponse({ error: "Forbidden — admin or manager role required" }, 403);
  }

  // Service-role client — the only client in this function that can
  // actually perform a privileged action.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const action = payload.action as string | undefined;

  try {
    switch (action) {
      case "create_staff": {
        const fullName = payload.fullName as string | undefined;
        const email = payload.email as string | undefined;
        const phone = payload.phone as string | undefined;
        const username = payload.username as string | undefined;
        const role = payload.role as string | undefined;
        const status = (payload.status as string | undefined) ?? "Active";
        const password = payload.password as string | undefined;

        if (!fullName || !email || !phone || !username || !role || !password) {
          return jsonResponse({ error: "Missing required fields" }, 400);
        }
        if (!(STAFF_ROLES as readonly string[]).includes(role)) {
          return jsonResponse({ error: `Invalid role: ${role}` }, 400);
        }
        if (!(STAFF_STATUSES as readonly string[]).includes(status)) {
          return jsonResponse({ error: `Invalid status: ${status}` }, 400);
        }

        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          user_metadata: { full_name: fullName, username, phone, role },
          email_confirm: true,
        });

        if (createError || !created?.user?.id) {
          return jsonResponse({ error: createError?.message ?? "Failed to create auth user" }, 400);
        }

        const { error: profileError } = await adminClient.from("profiles").upsert(
          {
            id: created.user.id,
            email,
            full_name: fullName,
            phone,
            username,
            role,
            status,
            is_active: status === "Active",
            created_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        if (profileError) {
          return jsonResponse(
            { error: `Auth user created but profile write failed: ${profileError.message}` },
            500,
          );
        }

        return jsonResponse({ success: true, userId: created.user.id });
      }

      case "set_account_lock": {
        const targetUserId = payload.userId as string | undefined;
        const locked = payload.locked as boolean | undefined;
        if (!targetUserId || typeof locked !== "boolean") {
          return jsonResponse({ error: "userId and locked (boolean) are required" }, 400);
        }
        // "876000h" (~100 years) is Supabase's own documented convention for
        // an effectively-permanent ban; "none" lifts any existing ban.
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: locked ? "876000h" : "none",
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ success: true, locked });
      }

      case "reset_sessions": {
        const targetUserId = payload.userId as string | undefined;
        if (!targetUserId) {
          return jsonResponse({ error: "userId is required" }, 400);
        }
        // Short, self-clearing ban — long enough that any in-flight access
        // token can't be silently refreshed while active, short enough that
        // the account isn't left locked out. GoTrue lifts it automatically
        // once the duration elapses; no follow-up unban call needed.
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "1h",
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${String(action)}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
