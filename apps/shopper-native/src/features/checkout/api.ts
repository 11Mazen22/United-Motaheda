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
import { captureError } from "@/lib/crashReporter";
import type {
  CheckoutSubmitCommand,
  CreateOrderResult,
} from "./types";

const EDGE_FUNCTION_NAME = "create-order";
const TIMEOUT_MS = 20_000;

// Small helper — pick Arabic or English based on lang. Same idiom as
// features/auth/errorMap.ts's getAuthError: this file lives outside React
// (no useTranslation()), and these CheckoutRequestError messages render
// directly in the checkout UI, so they need to follow the active locale
// instead of always coming back in Arabic regardless of language.
const bi = (lang: "ar" | "en", ar: string, en: string): string =>
  lang === "en" ? en : ar;

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

/**
 * Ensures a profiles row exists for the authenticated user before we call
 * the Edge Function. Self-heals users whose signup trigger was broken.
 *
 * Behavior:
 *   - Attempts to fetch profile; if successful, returns early
 *   - On any error (network, RLS, etc), proceeds to upsert attempt
 *   - Upsert failure is thrown as a CheckoutRequestError("AUTH")
 *
 * This avoids Promise.race which can timeout aggressively on slow networks.
 * Instead, we proceed directly to upsert and rely on on-conflict clause for
 * idempotency.
 */

async function ensureUserProfile(command: CheckoutSubmitCommand, lang: "ar" | "en"): Promise<void> {
  const { userId, email, fullName, phone } = command.customer;
  if (!userId) return;

  // Step 1: probe for an existing row. Log errors but proceed to upsert
  // regardless — if the row exists, on-conflict makes it a no-op.
  let exists = false;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    
    if (error && __DEV__) {
      console.warn("[checkout] ensureUserProfile select failed:", error.message);
    }
    exists = !!data;
  } catch (err) {
    if (__DEV__) console.warn("[checkout] ensureUserProfile select threw:", err);
    // Continue to upsert on select error
  }

  if (exists) return;

  if (__DEV__) console.warn("[checkout] Profile row missing for user", userId, "— creating it.");

  // Step 2: upsert with the column set the handle_new_user trigger uses.
  // role / status / phone_verified have DB-level defaults from the
  // 20260518_fix_signup_trigger migration, so we don't need to set them
  // here (and shouldn't, to avoid trampling values the trigger may have set
  // for older accounts).
  try {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id:        userId,
          email:     email ?? "",
          full_name: fullName,
          phone:     phone ?? null,
        },
        { onConflict: "id", ignoreDuplicates: false },
      );

    if (upsertError) {
      if (__DEV__) console.error("[checkout] ensureUserProfile upsert failed:", upsertError.message);
      captureError(upsertError, { 
        surface: "checkout", 
        action: "ensureUserProfile", 
        userId: userId 
      });
      throw new CheckoutRequestError(
        bi(lang, "تعذّر تهيئة ملفك الشخصي. حاول مجدداً أو تواصل مع الدعم.", "Couldn't set up your profile. Please try again or contact support."),
        [], false, "AUTH", false,
      );
    }
  } catch (err) {
    if (err instanceof CheckoutRequestError) throw err;
    if (__DEV__) console.error("[checkout] ensureUserProfile upsert threw:", err);
    captureError(err, { 
      surface: "checkout", 
      action: "ensureUserProfile", 
      userId: userId 
    });
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
  lang: "ar" | "en" = "ar",
): Promise<CreateOrderResult> {
  // Two layers of protection against duplicate submissions:
  //   1. withDeduplication — collapses concurrent calls with the same key
  //   2. withRetry — retries only retryable (network/timeout) errors
  return withRetry(
    () => withDeduplication(
      `checkout:${command.idempotencyKey}`,
      () => _createCheckoutOrder(command, lang),
    ),
    { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 8_000, jitter: 0.3 },
  );
}

async function _createCheckoutOrder(
  command: CheckoutSubmitCommand,
  lang: "ar" | "en",
): Promise<CreateOrderResult> {
  await ensureUserProfile(command, lang);

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
        let message = bi(lang, "تعذر إرسال الطلب حالياً.", "Couldn't submit the order right now.");
        let conflicts: CreateOrderResult["conflicts"] = [];
        try {
          const body = (await error.context?.json?.()) as { error?: string; conflicts?: CreateOrderResult["conflicts"] } | null;
          if (body?.error) message = body.error;
          if (body?.conflicts?.length) conflicts = body.conflicts;
        } catch { /* body wasn't JSON — keep the generic message */ }

        if (httpStatus === 401 || httpStatus === 403) {
          throw new CheckoutRequestError(
            bi(lang, "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.", "Your session has expired. Please sign in again."),
            [], false, "AUTH", false,
          );
        }

        if (message === "order_commit_failed") {
          throw new CheckoutRequestError(
            bi(lang, "عذراً، بعض العناصر في سلتك لم تعد متوفرة. يرجى مراجعة السلة والمحاولة مرة أخرى.", "Sorry, some items in your cart are no longer available. Please review your cart and try again."),
            [], false, "RESERVATION_EXPIRED", false,
          );
        }

        if (message === "cart_changed") {
          throw new CheckoutRequestError(
            bi(lang, "تغيّرت أسعار أو توفر بعض العناصر في سلتك. راجع السلة قبل المتابعة.", "Prices or availability changed for some items in your cart. Please review your cart before continuing."),
            conflicts, true, "CONFLICT", false,
          );
        }

        if (message === "prescription_required" || message === "prescription_not_approved") {
          throw new CheckoutRequestError(
            bi(lang, "هذا الطلب يحتوي على أدوية تستلزم روشتة معتمدة من الصيدلي.", "This order contains medication that requires a pharmacist-approved prescription."),
            [], false, "CONFLICT", false,
          );
        }

        if (message === "address_not_deliverable") {
          throw new CheckoutRequestError(
            bi(lang, "عذراً، هذا العنوان خارج نطاق التوصيل الحالي.", "Sorry, this address is outside our current delivery range."),
            [], false, "CONFLICT", false,
          );
        }

        if (message === "location_required") {
          throw new CheckoutRequestError(
            bi(lang, "يرجى تحديد موقع دقيق (GPS) للعنوان قبل إتمام الطلب.", "Please set a precise (GPS) location for the address before placing the order."),
            [], false, "CONFLICT", false,
          );
        }

        throw new CheckoutRequestError(message, [], false, "FUNCTION_ERROR", false);
      }

      if (error instanceof FunctionsRelayError) {
        throw new CheckoutRequestError(
          bi(lang, "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.", "Couldn't reach the order service. Check your internet connection."),
          [], false, "NETWORK", true,
        );
      }

      if (error instanceof FunctionsFetchError) {
        throw new CheckoutRequestError(
          bi(lang, "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.", "Couldn't reach the order service. Check your internet connection."),
          [], false, "NETWORK", true,
        );
      }

      throw new CheckoutRequestError(
        (error as { message?: string }).message ?? bi(lang, "تعذر إرسال الطلب حالياً.", "Couldn't submit the order right now."),
        [], false, "FUNCTION_ERROR", false,
      );
    }

    if (!data?.order?.id || !data?.order?.created_at) {
      throw new CheckoutRequestError(
        bi(lang, "استجابة غير مكتملة من خدمة الطلبات. حاول مجدداً.", "Incomplete response from the order service. Please try again."),
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
        bi(lang, "انتهت مهلة الاتصال. تحقق من اتصالك وأعد المحاولة.", "The connection timed out. Check your connection and try again."),
        [], false, "TIMEOUT", true,
      );
    }

    if (error instanceof TypeError && isNetworkErrorMessage((error as Error).message)) {
      throw new CheckoutRequestError(
        bi(lang, "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.", "Couldn't reach the order service. Check your internet connection."),
        [], false, "NETWORK", true,
      );
    }

    throw new CheckoutRequestError(
      error instanceof Error ? error.message : bi(lang, "تعذر إرسال الطلب حالياً.", "Couldn't submit the order right now."),
      [], false, "UNKNOWN", false,
    );
  }
}
