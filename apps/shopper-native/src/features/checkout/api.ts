/**
 * Checkout API service — calls the shared Supabase Edge Function
 * (`create-order`), the same one the web app uses. Order creation is
 * authenticated via the caller's Supabase session, so `orders.user_id`
 * is always set correctly and idempotency-key replay is handled server-side.
 *
 * Delivery quotes / branch lookups still go through the Railway backend
 * (see @/lib/railwayApi) — only order creation was moved off it, since the
 * Railway /orders route requires quoteToken/assignmentToken/branchId fields
 * this app never populated and has no auth guard.
 */

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CheckoutRequestError } from "./errors";
import { withDeduplication, withRetry } from "./resilience";
import type {
  CheckoutSubmitCommand,
  CreateOrderResult,
} from "./types";

const EDGE_FUNCTION_NAME = "create-order";
const TIMEOUT_MS = 20_000;

interface EdgeFunctionResponse {
  order: {
    id: string;
    created_at: string;
    status?: string;
    payment_status?: string;
    payment_reference?: string | null;
    idempotent_replay?: boolean;
  };
  conflicts: CreateOrderResult["conflicts"];
}

// Timeout applied to the two Supabase calls inside ensureUserProfile.
const PROFILE_TIMEOUT_MS = 8_000;

/**
 * Ensures a profiles row exists for the authenticated user before we call
 * the Edge Function. Self-heals users whose signup trigger was broken.
 *
 * Behavior (changed from prior silent-fail version):
 *   - select fails → log + still attempt upsert (RLS quirks shouldn't block
 *     a write attempt; if the row exists, on-conflict makes it a no-op)
 *   - upsert fails → THROW a typed CheckoutRequestError(code: "AUTH") so
 *     checkout shows a precise error instead of letting the Edge Function
 *     return a generic 403 "profile not found"
 *
 * Previously this function swallowed both kinds of failure in dev-only
 * console warnings, which meant users hit the misleading
 * "sign out and sign back in" UI even when the real problem was a NOT NULL
 * constraint or RLS policy needing attention.
 */

async function ensureUserProfile(command: CheckoutSubmitCommand): Promise<void> {
  const { userId, email, fullName, phone } = command.customer;
  if (!userId) return;

  // Step 1: probe for an existing row. We log selectError but DO NOT bail —
  // the upsert below would have worked even if the select failed (e.g.,
  // transient network blip, edge RLS denial on read-but-not-write).
  // Timeout: 8 s so we never hang the checkout button indefinitely.
  let exists = false;
  try {
    // Use Promise.race so TypeScript infers the return type from the Supabase
    // query directly. withTimeout<T> hits a wall against Supabase's deeply
    // nested conditional generics; race() is the cleaner alternative.
    const { data, error } = await Promise.race([
      supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new CheckoutRequestError(
            "انتهت مهلة الاتصال أثناء التحقق من الملف الشخصي. أعد المحاولة.",
            [], false, "TIMEOUT", true,
          )),
          PROFILE_TIMEOUT_MS,
        ),
      ),
    ]);
    if (error && __DEV__) {
      console.warn("[checkout] ensureUserProfile select failed:", error.message);
    }
    exists = !!data;
  } catch (err) {
    if (err instanceof CheckoutRequestError) throw err;
    if (__DEV__) console.warn("[checkout] ensureUserProfile select threw:", err);
  }

  if (exists) return;

  if (__DEV__) console.warn("[checkout] Profile row missing for user", userId, "— creating it.");

  // Step 2: upsert with the column set the handle_new_user trigger uses.
  // role / status / phone_verified have DB-level defaults from the
  // 20260518_fix_signup_trigger migration, so we don't need to set them
  // here (and shouldn't, to avoid trampling values the trigger may have set
  // for older accounts).
  const { error: upsertError } = await Promise.race([
    supabase.from("profiles").upsert(
      {
        id:        userId,
        email:     email ?? "",
        full_name: fullName,
        phone:     phone ?? null,
      },
      { onConflict: "id", ignoreDuplicates: false },
    ),
    new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(new CheckoutRequestError(
          "انتهت مهلة الاتصال أثناء تهيئة الملف الشخصي. أعد المحاولة.",
          [], false, "TIMEOUT", true,
        )),
        PROFILE_TIMEOUT_MS,
      ),
    ),
  ]);

  if (upsertError) {
    if (__DEV__) console.error("[checkout] ensureUserProfile upsert failed:", upsertError.message);
    throw new CheckoutRequestError(
      "تعذّر تهيئة ملفك الشخصي. حاول مجدداً أو تواصل مع الدعم.",
      [], false, "AUTH", false,
    );
  }
}

function isNetworkErrorMessage(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message === "Failed to fetch" ||
    message === "Network request failed" ||
    message === "Load failed" ||
    message.includes("network")
  );
}

export function createCheckoutOrder(
  command: CheckoutSubmitCommand,
): Promise<CreateOrderResult> {
  // Two layers of protection against duplicate submissions:
  //   1. withDeduplication — collapses concurrent calls with the same key
  //   2. withRetry — retries only retryable (network/timeout) errors
  return withRetry(
    () => withDeduplication(
      `checkout:${command.idempotencyKey}`,
      () => _createCheckoutOrder(command),
    ),
    { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 8_000, jitter: 0.3 },
  );
}

async function _createCheckoutOrder(
  command: CheckoutSubmitCommand,
): Promise<CreateOrderResult> {
  await ensureUserProfile(command);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke<EdgeFunctionResponse>(
      EDGE_FUNCTION_NAME,
      {
        body:   command,
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const httpStatus = error.context?.status as number | undefined;
        let message = "تعذر إرسال الطلب حالياً.";
        try {
          const body = (await error.context?.json?.()) as { error?: string } | null;
          if (body?.error) message = body.error;
        } catch { /* body wasn't JSON — keep the generic message */ }

        if (httpStatus === 401 || httpStatus === 403) {
          throw new CheckoutRequestError(
            "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.",
            [], false, "AUTH", false,
          );
        }

        throw new CheckoutRequestError(message, [], false, "FUNCTION_ERROR", false);
      }

      if (error instanceof FunctionsRelayError) {
        throw new CheckoutRequestError(
          "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.",
          [], false, "NETWORK", true,
        );
      }

      if (error instanceof FunctionsFetchError) {
        throw new CheckoutRequestError(
          "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.",
          [], false, "NETWORK", true,
        );
      }

      throw new CheckoutRequestError(
        (error as { message?: string }).message ?? "تعذر إرسال الطلب حالياً.",
        [], false, "FUNCTION_ERROR", false,
      );
    }

    if (!data?.order?.id || !data?.order?.created_at) {
      throw new CheckoutRequestError(
        "استجابة غير مكتملة من خدمة الطلبات. حاول مجدداً.",
        [], false, "BAD_RESPONSE", false,
      );
    }

    return {
      orderId:          data.order.id,
      createdAt:        data.order.created_at,
      status:           data.order.status ?? "pending",
      paymentStatus:    data.order.payment_status ?? "pending",
      paymentReference: data.order.payment_reference ?? null,
      idempotentReplay: data.order.idempotent_replay ?? false,
      conflicts:        data.conflicts ?? [],
    };
  } catch (error) {
    clearTimeout(timer);

    if (error instanceof CheckoutRequestError) throw error;

    if (error instanceof Error && (error.name === "AbortError" || error.message === "Aborted")) {
      throw new CheckoutRequestError(
        "انتهت مهلة الاتصال. تحقق من اتصالك وأعد المحاولة.",
        [], false, "TIMEOUT", true,
      );
    }

    if (error instanceof TypeError && isNetworkErrorMessage((error as Error).message)) {
      throw new CheckoutRequestError(
        "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.",
        [], false, "NETWORK", true,
      );
    }

    throw new CheckoutRequestError(
      error instanceof Error ? error.message : "تعذر إرسال الطلب حالياً.",
      [], false, "UNKNOWN", false,
    );
  }
}
