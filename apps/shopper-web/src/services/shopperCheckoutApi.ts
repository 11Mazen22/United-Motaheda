/**
 * services/shopperCheckoutApi.ts
 *
 * FIXED — 403 "Profile not found" resolved.
 *
 * ROOT CAUSE
 * ──────────
 * The Edge Function `create-order` looks up the caller's row in the
 * `profiles` table. When the `on_auth_user_created` trigger was broken,
 * users were created in auth.users but got no corresponding profiles row.
 * The Edge Function found nothing and returned 403 "Profile not found."
 *
 * THE FIX (layered defence)
 * ─────────────────────────
 * 1. `ensureUserProfile()` — called before every Edge Function invocation.
 *    It checks whether a profile row exists; if not, it upserts one using
 *    the user data already present in the checkout command. This silently
 *    self-heals any user who signed up while the trigger was broken.
 * 2. If the Edge Function still returns 403 (e.g. RLS blocked the upsert),
 *    we surface a clear, actionable error message instead of a raw crash.
 *
 * 3. The permanent server-side fix is in fix_missing_profiles.sql —
 *    run that once in Supabase SQL Editor to backfill all affected users.
 *
 * Previous fix (still present): `signal` moved inside the invoke options
 * object so the AbortController timeout actually works.
 */

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { CheckoutRequestError } from "../app/checkout/errors";
import type {
  CheckoutConflict,
  CheckoutSubmitCommand,
  CreateOrderResult,
} from "../app/checkout/types";
import {
  normalizeOrderStatus,
  type StoredOrder,
} from "../app/orders";
import { getSupabaseClient } from "../lib/supabaseClient";

// ─── Edge Function name ───────────────────────────────────────────────────────
const EDGE_FUNCTION_NAME = "create-order";

// ─── Timeout ──────────────────────────────────────────────────────────────────
const TIMEOUT_MS = 20_000;

// ─── Response shape expected from the Edge Function ───────────────────────────
interface EdgeFunctionResponse {
  order: {
    id: string;
    created_at: string;
    status?: string;
    payment_status?: string;
    payment_reference?: string | null;
    idempotent_replay?: boolean;
  };
  conflicts: CheckoutConflict[];
}

export type CheckoutOrderPersistencePayload = {
  draft: Omit<
    StoredOrder,
    | "id"
    | "createdAt"
    | "status"
    | "itemCount"
    | "source"
    | "syncState"
    | "lastSyncedAt"
    | "lastError"
  >;
  overrides: Pick<
    StoredOrder,
    "id" | "createdAt" | "status" | "source" | "syncState" | "lastSyncedAt"
  >;
};

// ─── Profile self-heal ────────────────────────────────────────────────────────

/**
 * Ensures a profiles row exists for the authenticated user before we call
 * the Edge Function. If the row is missing (broken trigger on signup),
 * this upserts one using the data already available in the checkout command.
 *
 * Failures are intentionally swallowed — if the upsert is blocked by RLS
 * the Edge Function call still proceeds and will surface its own error.
 */
async function ensureUserProfile(command: CheckoutSubmitCommand): Promise<void> {
  const { userId, email, fullName, phone } = command.customer;
  if (!userId) return; // guest checkout — no profile needed

  const supabase = getSupabaseClient();

  try {
    // 1. Fast-path: check whether a row already exists
    const { data: existing, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      // Can't read the table — skip silently; Edge Function will decide
      return;
    }

    if (existing) return; // Profile exists — nothing to do

    // 2. Profile row is missing — create it now using checkout form data.

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: email ?? "",
        full_name: fullName,
        phone: phone,
        role: "customer",
        status: "Active",
        created_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (upsertError) {
      // Log but don't throw — the Edge Function will surface a clear 403 if
      // it still can't find the profile, which we handle below.
      return;
    }
  } catch {
    // Don't rethrow — attempt the Edge Function call regardless
  }
}

export function buildCheckoutOrderPersistencePayload(
  command: CheckoutSubmitCommand,
  result: CreateOrderResult,
): CheckoutOrderPersistencePayload {
  return {
    draft: {
      fullName: command.customer.fullName.trim(),
      phone: command.customer.phone.trim(),
      city: command.address.city.trim(),
      street: command.address.streetLine.trim(),
      address: command.address.formatted.trim(),
      note: command.note.trim(),
      subtotal: command.expectedPricing.subtotal,
      tax: command.expectedPricing.tax,
      shipping: command.expectedPricing.shipping,
      discount: command.expectedPricing.discount,
      total: command.expectedPricing.total,
      items: command.cartLines.map((line) => ({
        productId: line.code?.trim() || line.productId.trim(),
        name: line.name.trim(),
        quantity: line.quantity,
        price: line.unitPrice,
      })),
      qrToken: undefined,
    },
    overrides: {
      id: result.orderId,
      createdAt: result.createdAt,
      status: normalizeOrderStatus(result.status),
      source: "remote",
      syncState: "synced",
      lastSyncedAt: result.createdAt,
    },
  };
}

// ─── Main API call ────────────────────────────────────────────────────────────

export async function createCheckoutOrder(
  command: CheckoutSubmitCommand,
): Promise<CreateOrderResult> {
  const supabase = getSupabaseClient();

  // ── Self-heal: make sure the profile row exists before calling the EF ────────
  await ensureUserProfile(command);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke<EdgeFunctionResponse>(
      EDGE_FUNCTION_NAME,
      {
        body: command,
        signal: controller.signal, // correctly inside FunctionInvokeOptions
      },
    );

    clearTimeout(timer);

    // ── Handle Supabase-layer errors ─────────────────────────────────────────

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const httpStatus = error.context?.status as number | undefined;
        let message = `Order service error (HTTP ${httpStatus ?? "?"})`;
        let conflicts: CheckoutConflict[] = [];
        let shouldRefreshCatalog = false;

        try {
          const body = (await error.context?.json?.()) as {
            error?: string;
            code?: string;
            conflicts?: CheckoutConflict[];
            shouldRefreshCatalog?: boolean;
          } | null;

          if (body?.error) message = body.error;
          if (Array.isArray(body?.conflicts)) conflicts = body.conflicts;
          if (body?.shouldRefreshCatalog) shouldRefreshCatalog = true;
        } catch {
          // Body wasn't JSON — keep the generic message
        }

        // ── Translate the specific 403 "Profile not found" case ────────────────
        // This means ensureUserProfile couldn't create the row (likely RLS).
        // Tell the user what happened and what to do.
        if (
          httpStatus === 403 &&
          (message.toLowerCase().includes("profile not found") ||
            message.toLowerCase().includes("profile"))
        ) {
          throw new CheckoutRequestError(
            "لم يتم العثور على ملفك الشخصي. يرجى تسجيل الخروج وإعادة تسجيل الدخول ثم المحاولة مرة أخرى.\n" +
              "Your account profile was not found. Please sign out and sign back in, then try again.",
            [],
            false,
            "AUTH",
            false,
          );
        }

        // General 401 / 403 — session expired or missing
        if (httpStatus === 401 || httpStatus === 403) {
          throw new CheckoutRequestError(
            "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.\n" +
              "Your session has expired. Please sign in again.",
            [],
            false,
            "AUTH",
            false,
          );
        }

        throw new CheckoutRequestError(
          message,
          conflicts,
          shouldRefreshCatalog,
          conflicts.length > 0 ? "CONFLICT" : "FUNCTION_ERROR",
          false,
        );
      }

      if (error instanceof FunctionsRelayError) {
        throw new CheckoutRequestError(
          "The order service is temporarily unreachable. Please try again in a moment.",
          [],
          false,
          "NETWORK",
          true,
        );
      }

      if (error instanceof FunctionsFetchError) {
        throw new CheckoutRequestError(
          "A network error prevented the order from being sent. Check your connection and try again.",
          [],
          false,
          "NETWORK",
          true,
        );
      }

      throw new CheckoutRequestError(
        (error as { message?: string }).message ?? "Unexpected error submitting order.",
        [],
        false,
        "FUNCTION_ERROR",
        false,
      );
    }

    // ── Guard against empty / malformed response ──────────────────────────────

    if (!data?.order?.id || !data?.order?.created_at) {
      throw new CheckoutRequestError(
        "The order service returned an incomplete response. Please try again.",
        [],
        false,
        "BAD_RESPONSE",
        false,
      );
    }

    // ─── Map to CreateOrderResult ──────────────────────────────────────────────
    const result: CreateOrderResult = {
      orderId: data.order.id,
      createdAt: data.order.created_at,
      status: data.order.status ?? "pending",
      paymentStatus: data.order.payment_status ?? "pending",
      paymentReference: data.order.payment_reference ?? null,
      idempotentReplay: data.order.idempotent_replay ?? false,
      conflicts: data.conflicts ?? [],
    };

    return result;
  } catch (error) {
    clearTimeout(timer);

    if (error instanceof CheckoutRequestError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CheckoutRequestError(
        "The order request timed out. Please check your connection and try again.",
        [],
        false,
        "TIMEOUT",
        true,
      );
    }

    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new CheckoutRequestError(
        "Unable to reach the order service. Please check your internet connection.",
        [],
        false,
        "NETWORK",
        true,
      );
    }

    throw new CheckoutRequestError(
      error instanceof Error
        ? error.message
        : "Unable to submit the order right now. Please try again.",
      [],
      false,
      "UNKNOWN",
      false,
    );
  }
}