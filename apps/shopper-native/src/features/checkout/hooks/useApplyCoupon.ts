/**
 * useApplyCoupon — encapsulates coupon validation state for the checkout flow.
 *
 * Design:
 *   - Calls the validate-coupon Edge Function on every "Apply" press.
 *   - Caches the last successful validation result so the pricing engine
 *     can use it without re-fetching on every render.
 *   - Exposes `removeCoupon()` so the user can clear an applied code.
 *   - Does NOT own the promoCode form field — the caller (useCheckoutFlow)
 *     continues to own the form; this hook only manages the async validation
 *     lifecycle alongside it.
 *   - Stateless with respect to the server: the actual redemption row is
 *     written by the create-order Edge Function after order commit, not here.
 *
 * Integration:
 *   useCheckoutFlow calls applyCode() when the user taps "Apply".
 *   The returned `couponResult` (when valid) is read by the pricing engine
 *   in place of the old hardcoded UNITED10 logic.
 */

import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { track } from "@/lib/analytics";
import {
  validateCouponCode,
  CouponValidationError,
} from "../couponApi";
import type { CouponValidationResult } from "../types";

export interface UseApplyCouponReturn {
  /** The last successful validation result. null until a valid code is applied. */
  couponResult:       CouponValidationResult & { valid: true } | null;
  /** True while a validation request is in flight. */
  validating:         boolean;
  /** User-facing error message. Null when no error or when a coupon is applied. */
  couponError:        string | null;
  /** Apply a code against the current subtotal. Populates couponResult or couponError. */
  applyCode:          (code: string, subtotal: number) => Promise<void>;
  /** Clear the applied coupon and any error. */
  removeCoupon:       () => void;
  /** True when a valid coupon is applied. */
  couponApplied:      boolean;
}

/** Arabic error messages for each server-side failure reason. */
function reasonToMessage(
  reason: string,
  minOrderAmount?: number,
): string {
  switch (reason) {
    case "not_found":
      return "كود الخصم غير صحيح أو غير موجود.";
    case "inactive":
      return "كود الخصم غير مفعّل حالياً.";
    case "expired":
      return "انتهت صلاحية كود الخصم.";
    case "limit_reached":
      return "تم استنفاد الحد الأقصى لاستخدام هذا الكود.";
    case "already_redeemed":
      return "لقد استخدمت هذا الكود من قبل.";
    case "first_order_only":
      return "هذا الكود متاح للطلب الأول فقط.";
    case "min_order_not_met":
      return minOrderAmount != null
        ? `الحد الأدنى للطلب هو ${minOrderAmount.toFixed(0)} ج.م.`
        : "لم يُستوفَ الحد الأدنى لقيمة الطلب.";
    default:
      return "كود الخصم غير صحيح.";
  }
}

export function useApplyCoupon(): UseApplyCouponReturn {
  const [couponResult, setCouponResult] =
    useState<(CouponValidationResult & { valid: true }) | null>(null);
  const [validating, setValidating]     = useState(false);
  const [couponError, setCouponError]   = useState<string | null>(null);

  // Prevent double-tap on the Apply button — same pattern as the submit guard.
  const inFlightRef = useRef(false);

  const applyCode = useCallback(
    async (code: string, subtotal: number): Promise<void> => {
      const trimmed = code.trim();
      if (!trimmed) {
        setCouponError("يرجى إدخال كود الخصم.");
        return;
      }

      // If the same code is already applied successfully, nothing to do.
      if (couponResult?.valid && couponResult.code === trimmed.toUpperCase()) {
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      setValidating(true);
      setCouponError(null);
      setCouponResult(null);

      try {
        const result = await validateCouponCode(trimmed, subtotal);

        if (result.valid) {
          setCouponResult(result);
          setCouponError(null);
          track("checkout_coupon_applied", {
            code:           result.code,
            discount_type:  result.discountType,
            discount_amount: result.discountAmount,
            first_order_only: result.firstOrderOnly ? 1 : 0,
          });
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
          }
        } else {
          setCouponResult(null);
          setCouponError(
            reasonToMessage(
              result.reason,
              result.reason === "min_order_not_met"
                ? result.minOrderAmount
                : undefined,
            ),
          );
          track("checkout_coupon_failed", {
            code:   trimmed.toUpperCase(),
            reason: result.reason,
          });
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error,
            ).catch(() => {});
          }
        }
      } catch (err) {
        setCouponResult(null);
        setCouponError(
          err instanceof CouponValidationError
            ? err.message
            : "تعذّر التحقق من الكود. حاول مجدداً.",
        );
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          ).catch(() => {});
        }
      } finally {
        setValidating(false);
        inFlightRef.current = false;
      }
    },
    [couponResult],
  );

  const removeCoupon = useCallback(() => {
    setCouponResult(null);
    setCouponError(null);
  }, []);

  return {
    couponResult,
    validating,
    couponError,
    applyCode,
    removeCoupon,
    couponApplied: couponResult?.valid === true,
  };
}
