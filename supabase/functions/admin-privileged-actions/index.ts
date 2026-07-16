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
const STAFF_STATUSES = ["Active", "Inactive"] as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function rollbackCreatedUser(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  return error?.message ?? null;
}

async function writeAudit(
  adminClient: ReturnType<typeof createClient>,
  adminId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await adminClient.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    details,
  });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}

async function assertTargetManageable(
  adminClient: ReturnType<typeof createClient>,
  callerRole: string,
  targetUserId: string,
): Promise<void> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error || !data) throw new Error("Target profile was not found");
  if (callerRole === "manager" && data.role === "admin") {
    throw new Error("Only an administrator can manage an administrator account");
  }
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
        const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
        const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
        const username = typeof payload.username === "string" ? payload.username.trim() : "";
        const role = typeof payload.role === "string" ? payload.role : "";
        const status = typeof payload.status === "string" ? payload.status : "Active";
        const password = typeof payload.password === "string" ? payload.password : "";

        if (!fullName || !email || !phone || !username || !role || !password) {
          return jsonResponse({ error: "All staff fields are required", stage: "validation" }, 400);
        }
        if (fullName.length > 120 || username.length > 50 || phone.length > 30) {
          return jsonResponse({ error: "One or more staff fields are too long", stage: "validation" }, 400);
        }
        if (password.length < 8) {
          return jsonResponse({ error: "Password must be at least 8 characters", stage: "validation" }, 400);
        }
        if (!(STAFF_ROLES as readonly string[]).includes(role)) {
          return jsonResponse({ error: `Invalid role: ${role}`, stage: "validation" }, 400);
        }
        if (!(STAFF_STATUSES as readonly string[]).includes(status)) {
          return jsonResponse({ error: `Invalid initial status: ${status}`, stage: "validation" }, 400);
        }
        if (callerRole === "manager" && role === "admin") {
          return jsonResponse({ error: "Only an administrator can create an administrator", stage: "authorization" }, 403);
        }

        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          user_metadata: { full_name: fullName, username, phone },
          email_confirm: true,
        });

        if (createError || !created?.user?.id) {
          return jsonResponse(
            {
              error: createError?.message ?? "Failed to create Auth user",
              code: createError?.code,
              stage: "auth",
            },
            createError?.status ?? 400,
          );
        }

        const createdUserId = created.user.id;
        const { data: profile, error: profileError } = await adminClient
          .from("profiles")
          .upsert(
            {
              id: createdUserId,
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
          )
          .select("id, role, status")
          .single();

        if (profileError || !profile || profile.role !== role || profile.status !== status) {
          const cleanupError = await rollbackCreatedUser(adminClient, createdUserId);
          return jsonResponse(
            {
              error: profileError
                ? `Profile creation failed: ${profileError.message}`
                : "Profile role/status did not persist",
              stage: "profile",
              cleanupError,
            },
            500,
          );
        }

        try {
          await writeAudit(adminClient, callerUser.id, "create_staff", createdUserId, {
            role,
            status,
            email,
          });
        } catch (auditError) {
          const cleanupError = await rollbackCreatedUser(adminClient, createdUserId);
          return jsonResponse(
            {
              error: auditError instanceof Error ? auditError.message : "Audit write failed",
              stage: "audit",
              cleanupError,
            },
            500,
          );
        }

        return jsonResponse({ success: true, userId: createdUserId });
      }

      case "set_account_lock": {
        const targetUserId = payload.userId as string | undefined;
        const locked = payload.locked as boolean | undefined;
        if (!targetUserId || typeof locked !== "boolean") {
          return jsonResponse({ error: "userId and locked (boolean) are required" }, 400);
        }
        await assertTargetManageable(adminClient, callerRole, targetUserId);
        // "876000h" (~100 years) is Supabase's own documented convention for
        // an effectively-permanent ban; "none" lifts any existing ban.
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: locked ? "876000h" : "none",
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        await writeAudit(adminClient, callerUser.id, locked ? "lock_account" : "unlock_account", targetUserId, { locked });
        return jsonResponse({ success: true, locked });
      }

      case "reset_sessions": {
        const targetUserId = payload.userId as string | undefined;
        if (!targetUserId) {
          return jsonResponse({ error: "userId is required" }, 400);
        }
        await assertTargetManageable(adminClient, callerRole, targetUserId);
        // Short, self-clearing ban — long enough that any in-flight access
        // token can't be silently refreshed while active, short enough that
        // the account isn't left locked out. GoTrue lifts it automatically
        // once the duration elapses; no follow-up unban call needed.
        const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "1h",
        });
        if (error) return jsonResponse({ error: error.message }, 400);
        await writeAudit(adminClient, callerUser.id, "reset_sessions", targetUserId, {});
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${String(action)}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
