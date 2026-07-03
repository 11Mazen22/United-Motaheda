/**
 * Checkout API service — uses the shared Railway backend.
 *
 * Both the web and the native app now call the same Railway /orders endpoint,
 * guaranteeing consistent order creation, delivery fee calculation, and
 * zone validation across platforms.
 *
 * Fallback: if Railway is unreachable we re-throw a typed CheckoutRequestError
 * so the AppSheet can show an actionable error to the user.
 */

import { supabase } from "@/lib/supabase";
import { railwayApi, RailwayApiError, type RailwayCreateOrderRequest } from "@/lib/railwayApi";
import { CheckoutRequestError } from "./errors";
import type {
  CheckoutSubmitCommand,
  CreateOrderResult,
} from "./types";

// Timeout applied to the two Supabase calls inside ensureUserProfile.
// railwayApi.createOrder() carries its own 15 s AbortController timeout
// internally (see src/lib/railwayApi.ts), so no separate timeout is needed
// for the Railway leg of the checkout flow.
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

export async function createCheckoutOrder(
  command: CheckoutSubmitCommand,
): Promise<CreateOrderResult> {
  await ensureUserProfile(command);

  // Build the Railway request payload from the typed CheckoutSubmitCommand.
  // Field names differ intentionally between the command (domain model) and
  // the Railway HTTP contract:
  //   command.cartLines      → cart.items
  //   command.expectedPricing.shipping → expectedPricing.deliveryFee
  //   command.payment.method → paymentMethod
  //
  // coordinates: not yet part of CheckoutSubmitCommand (the delivery-quote
  // flow resolves coordinates via GPS/address but doesn't thread them into
  // the command yet). Cairo centre is the safe fallback for the Railway
  // branch-routing logic until this field is propagated end-to-end.
  const railwayPayload: RailwayCreateOrderRequest = {
    idempotencyKey: command.idempotencyKey,
    customerName:   command.customer.fullName,
    customerPhone:  command.customer.phone,
    address:        command.address as Record<string, unknown>,
    note:           command.note ?? "",
    coordinates:    { lat: 30.0444, lng: 31.2357 },
    branchId:       undefined,
    cart: {
      items: command.cartLines.map((line) => ({
        productId: line.productId,
        name:      line.name,
        quantity:  line.quantity,
        unitPrice: line.unitPrice,
      })),
      subtotal: command.expectedPricing.subtotal,
    },
    expectedPricing: {
      subtotal:    command.expectedPricing.subtotal,
      discount:    command.expectedPricing.discount,
      tax:         command.expectedPricing.tax,
      deliveryFee: command.expectedPricing.shipping,
      total:       command.expectedPricing.total,
    },
    paymentMethod: command.payment.method,
  };

  try {
    const result = await railwayApi.createOrder(railwayPayload);

    return {
      orderId:          result.orderId,
      createdAt:        result.createdAt,
      status:           result.status ?? "pending",
      paymentStatus:    "pending",
      paymentReference: null,
      idempotentReplay: false,
      conflicts:        [],
    };
  } catch (error) {
    if (error instanceof CheckoutRequestError) throw error;

    if (error instanceof RailwayApiError) {
      if (error.code === "TIMEOUT") {
        throw new CheckoutRequestError(
          "انتهت مهلة الاتصال. تحقق من اتصالك وأعد المحاولة.",
          [], false, "TIMEOUT", true,
        );
      }
      if (error.code === "NETWORK") {
        throw new CheckoutRequestError(
          "تعذر الوصول إلى خدمة الطلبات. تحقق من اتصالك بالإنترنت.",
          [], false, "NETWORK", true,
        );
      }
      if (error.status === 401 || error.status === 403) {
        throw new CheckoutRequestError(
          "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.",
          [], false, "AUTH", false,
        );
      }
      throw new CheckoutRequestError(
        error.message ?? "تعذر إرسال الطلب حالياً.",
        [], false, "FUNCTION_ERROR", false,
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
