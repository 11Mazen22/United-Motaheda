// Staff onboarding routes through the service-role-backed
// admin-privileged-actions Edge Function. The browser never receives an admin
// key; the function independently authenticates and authorizes the caller.

import { getSupabaseClient } from "../lib/supabaseClient";

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  role: "admin" | "manager" | "pharmacist" | "driver";
  status: "Active" | "Inactive";
  password: string;
}

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown; message?: unknown; stage?: unknown };
      const message = typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : null;
      if (message) {
        return typeof payload.stage === "string" ? `${message} (${payload.stage})` : message;
      }
    } catch {
      // Fall through to the transport error when the response is not JSON.
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : "Failed to create staff member.";
}

export async function createStaffUserViaSuperAdmin(staffData: CreateStaffPayload) {
  const supabase = getSupabaseClient();
  const payload: CreateStaffPayload = {
    ...staffData,
    fullName: staffData.fullName.trim(),
    email: staffData.email.trim().toLowerCase(),
    phone: staffData.phone.trim(),
    username: staffData.username.trim(),
  };

  const { data, error } = await supabase.functions.invoke("admin-privileged-actions", {
    body: { action: "create_staff", ...payload },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }
  if (!data?.success || typeof data.userId !== "string") {
    throw new Error(data?.error ?? "Staff creation was not confirmed by the server.");
  }

  return {
    success: true,
    userId: data.userId as string,
    message: `Staff member ${payload.fullName} created successfully. They can now log in with ${payload.email}.`,
  };
}
