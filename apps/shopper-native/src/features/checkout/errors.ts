/**
 * Checkout error taxonomy — ported verbatim from shopper-web.
 */

import type { CheckoutConflict } from "./types";

export type CheckoutErrorCode =
  | "TIMEOUT"
  | "NETWORK"
  | "AUTH"
  | "CONFLICT"
  | "BAD_RESPONSE"
  | "FUNCTION_ERROR"
  | "RESERVATION_EXPIRED"
  | "UNKNOWN";

export class CheckoutRequestError extends Error {
  conflicts: CheckoutConflict[];
  shouldRefreshCatalog: boolean;
  code: CheckoutErrorCode;
  retryable: boolean;

  constructor(
    message: string,
    conflicts: CheckoutConflict[] = [],
    shouldRefreshCatalog = false,
    code: CheckoutErrorCode = "UNKNOWN",
    retryable = false,
  ) {
    super(message);
    this.name = "CheckoutRequestError";
    this.conflicts = conflicts;
    this.shouldRefreshCatalog = shouldRefreshCatalog;
    this.code = code;
    this.retryable = retryable;
  }
}

export function formatCheckoutError(error: unknown, lang: "ar" | "en") {
  if (error instanceof CheckoutRequestError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return lang === "ar"
    ? "تعذر إرسال الطلب حالياً. يرجى المحاولة مرة أخرى."
    : "Unable to submit the order right now. Please try again.";
}
