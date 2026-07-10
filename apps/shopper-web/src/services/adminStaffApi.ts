// Staff onboarding — routes through the admin-privileged-actions Edge
// Function (supabase/functions/admin-privileged-actions/index.ts).
//
// FIXED 2026-07-10: this previously called supabase.auth.admin.createUser()
// directly through getSupabaseClient() — the normal anon-key client. GoTrue
// rejects every /admin/* endpoint from an anon-key caller outright, so this
// function never actually worked in production; the old comments here
// ("TEMPORARY WORKAROUND: create users in the Supabase dashboard manually")
// were describing a real, permanent failure, not a rare edge case. Creating
// an auth user requires the service-role key, which must never reach the
// browser — the Edge Function holds it server-side and re-verifies the
// caller is admin/manager itself before doing anything privileged, so this
// client-side function stays a thin, unprivileged wrapper.

import { getSupabaseClient } from "../lib/supabaseClient";

export async function createStaffUserViaSuperAdmin(staffData: {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  role: "admin" | "manager" | "pharmacist" | "driver";
  status: "Active" | "Inactive" | "Suspended";
  password: string;
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke("admin-privileged-actions", {
    body: { action: "create_staff", ...staffData },
  });

  if (error) {
    throw new Error(error.message ?? "Failed to create staff member.");
  }
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to create staff member.");
  }

  return {
    success: true,
    userId: data.userId as string,
    message: `Staff member ${staffData.fullName} created successfully. They can now login with email: ${staffData.email}`,
  };
}

/**
 * DIAGNOSTIC: Check Supabase auth status and return helpful error info
 */
export async function diagnosticSupabaseAuthStatus() {
  const supabase = getSupabaseClient();

  try {
    // Try to get current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      return {
        status: "error",
        message: "Cannot access auth session",
        error: sessionError.message,
        action: "Check Supabase connection and anon key",
      };
    }

    if (!session) {
      return {
        status: "warning",
        message: "No active session",
        action: "User may need to login first",
      };
    }

    // Try to access user data
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        status: "error",
        message: "Cannot fetch current user",
        error: userError.message,
        action: "Check auth token validity",
      };
    }

    return {
      status: "healthy",
      message: "Auth subsystem operational",
      user: user?.email,
    };
  } catch (err) {
    return {
      status: "error",
      message: "Unexpected auth error",
      error: err instanceof Error ? err.message : String(err),
      action: "Check browser console and Supabase logs",
    };
  }
}
