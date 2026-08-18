/**
 * useCheckoutFlow — encapsulates all state, effects, and business logic
 * for the checkout screen. The screen itself becomes a thin orchestrator
 * that wires this hook's output into sub-components.
 *
 * Navigation and scroll are intentionally NOT handled here — those are
 * presentation concerns. The hook surfaces `step` and `placedOrderId` as
 * reactive signals; the component reacts to them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

import { useCartStore, selectItemCount } from "@/stores/cart";
import { useOrderStore } from "@/stores/orders";
import { invalidateOrders } from "@/features/orders";
import { useCheckoutStore } from "@/stores/checkout";
import {
  useAuth,
  sendPhoneOtp,
  normalizeEgyptianPhone,
  PHONE_VERIFICATION_ENABLED,
} from "@/features/auth";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { geocodeAddress } from "@/lib/geocoding";
import * as ExpoLocation from "expo-location";
import {
  useAddressStore,
  selectDefaultAddress,
  type Address,
} from "@/features/addresses";
import { useDeliveryContext, useLocationStore } from "@/features/delivery";
import {
  pickPaymentReceiptImage,
  uploadPaymentReceipt,
  ReceiptUploadError,
  type ReceiptErrorCode,
} from "@/features/payment";

import {
  checkoutFormSchema,
  type CheckoutFormSchema,
  createCheckoutPricing,
  buildCheckoutSubmitCommand,
  buildCheckoutNote,
  createIdempotencyKey,
  createCheckoutOrder,
  CheckoutRequestError,
  formatCheckoutError,
  isManualWalletPayment,
  patchOrderManualPayment,
  type CheckoutFormInput,
  type CheckoutPricing,
} from "@/features/checkout";
import { saveCheckoutDraft, clearCheckoutDraft, loadCheckoutDraft } from "@/features/checkout/resilience";
import { useApplyCoupon } from "./useApplyCoupon";
import { SUPPORTED_GOVERNORATE } from "@/features/delivery";
import { paymentLabel } from "../constants";

export type CheckoutStep = "details" | "review" | "success";

const RECEIPT_ERROR_KEYS: Record<ReceiptErrorCode, string> = {
  permission_denied: "payment.receiptPermissionDenied",
  sign_in_required:  "payment.receiptSignInRequired",
  read_failed:       "payment.receiptReadFailed",
  upload_failed:     "payment.receiptUploadFailed",
  url_failed:        "payment.receiptUrlFailed",
};

function buildDefaults(name?: string | null): CheckoutFormSchema {
  return {
    fullName:        name ?? "",
    phone:           "",
    city:            SUPPORTED_GOVERNORATE.ar,
    streetName:      "",
    buildingNumber:  "",
    floor:           "",
    apartmentNumber: "",
    note:            "",
    promoCode:       "",
  };
}

export interface CheckoutFlowState {
  // ── Step ────────────────────────────────────────────────────────────
  step:            CheckoutStep;
  placedOrderId:   string | null;

  // ── Cart (granular selectors — only re-renders on subscribed slice) ──
  items:       ReturnType<typeof useCartStore.getState>["items"];
  itemCount:   number;

  // ── Checkout payment store ───────────────────────────────────────────
  paymentMethod:     ReturnType<typeof useCheckoutStore.getState>["paymentMethod"];
  transferNumber:    string;
  receiptUri:        string | null;
  setPaymentMethod:  (m: ReturnType<typeof useCheckoutStore.getState>["paymentMethod"]) => void;
  setTransferNumber: (v: string) => void;

  // ── UI flags ─────────────────────────────────────────────────────────
  requestPos:          boolean;
  submitting:          boolean;
  submitError:         string | null;
  promoError:          string | null;
  uploadingReceipt:    boolean;
  manualPaymentError:  string | null;
  showAuthGate:        boolean;
  setShowAuthGate:     (v: boolean) => void;
  otpPending:          { phone: string; form: CheckoutFormSchema } | null;

  // ── Profile / address autofill state ─────────────────────────────────
  savedProfilePhone:    string | null;
  useAccountProfile:    boolean;
  setUseAccountProfile: (v: boolean) => void;
  useSavedAddress:      boolean;
  setUseSavedAddress:   (v: boolean) => void;
  defaultAddress:       Address | null;

  // ── Delivery / location ───────────────────────────────────────────────
  deliveryQuote:       ReturnType<typeof useDeliveryContext>;
  selectedBranchId:    string | null;
  setSelectedBranchId: (id: string) => void;

  // ── Pricing ───────────────────────────────────────────────────────────
  pricing:      CheckoutPricing;
  promoApplied: boolean;

  // ── Form (react-hook-form surface) ───────────────────────────────────
  form: Pick<
    ReturnType<typeof useForm<CheckoutFormSchema>>,
    "control" | "handleSubmit" | "getValues" | "setValue" | "formState" | "trigger"
  >;

  // ── Handlers ─────────────────────────────────────────────────────────
  /** Validate form → move to review. Returns true on success. */
  goToReview:       () => Promise<boolean>;
  backToDetails:    () => void;
  handleApplyPromo: () => void;
  handlePickReceipt:() => Promise<void>;
  onSubmit:         (form: CheckoutFormSchema) => Promise<void>;
  handleOtpVerified:(phone: string) => void;
  handleOtpCancel:  () => void;
  onPaymentChange:  (m: ReturnType<typeof useCheckoutStore.getState>["paymentMethod"]) => void;
  onTogglePos:      () => void;

  // ── Coupon ────────────────────────────────────────────────────────────
  couponApplied:   boolean;
  couponError:     string | null;
  couponValidating:boolean;
  couponCode:      string;
  appliedCouponCode: string;
  couponDiscountAmount: number;
  setCouponCode:   (v: string) => void;
  handleApplyCoupon: () => Promise<void>;
  handleRemoveCoupon: () => void;

  // ── Draft recovery ────────────────────────────────────────────────────
  /** Non-null when a recoverable previous checkout draft was found on mount. */
  pendingDraft:        import("../resilience").CheckoutDraft | null;
  handleRestoreDraft:  () => void;
  handleDiscardDraft:  () => void;

  // ── User ─────────────────────────────────────────────────────────────
  user: ReturnType<typeof useAuth>["user"];
  lang: "en" | "ar";
}

export function useCheckoutFlow(): CheckoutFlowState {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? ("en" as const) : ("ar" as const);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Cart — granular selectors (one subscription per slice) ──────────
  const items    = useCartStore((s) => s.items);
  const itemCount = useCartStore(selectItemCount);
  const promoCodeFromStore  = useCartStore((s) => s.promoCode);
  // Actions: stable function refs — never cause re-renders
  const setPromoCodeStore   = useCartStore((s) => s.setPromoCode);
  const clearCart           = useCartStore((s) => s.clearCart);
  const ensureReservations  = useCartStore((s) => s.ensureReservations);
  const commitReservations  = useCartStore((s) => s.commitReservations);

  const refreshOrders = useOrderStore((s) => s.hydrate);

  // ── Checkout store — granular selectors ─────────────────────────────
  const paymentMethod    = useCheckoutStore((s) => s.paymentMethod);
  const transferNumber   = useCheckoutStore((s) => s.transferNumber);
  const receiptUri       = useCheckoutStore((s) => s.receiptUri);
  const setPaymentMethod  = useCheckoutStore((s) => s.setPaymentMethod);
  const setTransferNumber = useCheckoutStore((s) => s.setTransferNumber);
  const setReceiptUri     = useCheckoutStore((s) => s.setReceiptUri);
  const resetCheckout     = useCheckoutStore((s) => s.reset);

  // ── Address ──────────────────────────────────────────────────────────
  const defaultAddress = useAddressStore(selectDefaultAddress);
  const fetchAddresses = useAddressStore((s) => s.fetch);

  // ── Delivery / location ──────────────────────────────────────────────
  const deliveryQuote      = useDeliveryContext();
  const customerCoordinates = useLocationStore((s) => s.coordinates);
  const selectedBranchId   = useLocationStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useLocationStore((s) => s.setSelectedBranchId);

  // ── Local UI state ───────────────────────────────────────────────────
  const [step, setStep]                        = useState<CheckoutStep>("details");
  const [requestPos, setRequestPos]            = useState(false);
  const [promoError, setPromoError]            = useState<string | null>(null);
  const [submitting, setSubmitting]            = useState(false);
  const [submitError, setSubmitError]          = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId]      = useState<string | null>(null);
  const [manualPaymentError, setManualPaymentError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [savedProfilePhone, setSavedProfilePhone] = useState<string | null>(null);
  const [useAccountProfile, setUseAccountProfile] = useState(false);
  const [useSavedAddress, setUseSavedAddress]  = useState(false);
  const [otpPending, setOtpPending]            = useState<{ phone: string; form: CheckoutFormSchema } | null>(null);
  const [showAuthGate, setShowAuthGate]        = useState(false);

  // ── Coupon ────────────────────────────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const {
    couponResult,
    validating:   couponValidating,
    couponError,
    applyCode:    applyCodeFn,
    removeCoupon: removeCouponFn,
    couponApplied,
  } = useApplyCoupon();

  // ── Track checkout started once on mount ─────────────────────────────
  useEffect(() => {
    track("checkout_started", { item_count: cartLines.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-request GPS on checkout mount ───────────────────────────────
  // If we don't already have coordinates, request them silently in the
  // background so the delivery quote fires and zone validation works
  // without the user having to tap "Use my location".
  const setCoordinatesFromStore = useLocationStore((s) => s.setCoordinates);
  useEffect(() => {
    if (customerCoordinates) return; // already have location
    let cancelled = false;
    void (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoordinatesFromStore({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      } catch {
        // Non-fatal — geocoding fallback handles the no-GPS case
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idempotencyKeyRef = useRef(createIdempotencyKey());
  /**
   * Synchronous duplicate-submission guard.
   *
   * Problem: `submitting` state is set via setState, which is batched and
   * asynchronous. A user who double-taps the "Confirm" button can fire two
   * calls to onSubmit() before the first setState({ submitting: true }) has
   * flushed through React's scheduler — both calls see `submitting === false`
   * and both proceed past the early-return guard.
   *
   * The idempotency key on the server prevents the second call from creating
   * a duplicate order, but it still fires a network request, triggers
   * inventory checks, runs the phone-OTP flow, etc. That's wasteful and can
   * produce confusing double-error UI.
   *
   * Solution: a plain ref that is set synchronously before any await. The
   * ref assignment is immediate (no scheduler), so the second tap always sees
   * true and returns early, regardless of whether React has re-rendered yet.
   */
  const submitInProgressRef = useRef(false);

  // ── Derived cart lines (memoized) ────────────────────────────────────
  const cartLines = useMemo(
    () =>
      items
        .filter((i) => i.product && i.product.inStock && i.product.stock > 0)
        .map((i) => ({
          productId:    i.productId,
          quantity:     i.quantity,
          unitPrice:    i.product.price ?? 0,
          name:         i.product.name,
          code:         i.product.code,
          reservationId: i.reservationId,
        })),
    [items],
  );

  // ── Pricing (memoized) ───────────────────────────────────────────────
  const pricing = useMemo(
    () =>
      createCheckoutPricing(cartLines, {
        promoCode:    promoCodeFromStore,
        shippingFee:  deliveryQuote.cost,
        // Server-validated coupon takes precedence over the legacy client code.
        couponAmount: couponResult?.valid ? couponResult.discountAmount : undefined,
      }),
    [cartLines, promoCodeFromStore, deliveryQuote.cost, couponResult],
  );

  const promoApplied = pricing.discount > 0;

  // ── React-hook-form ──────────────────────────────────────────────────
  const { control, handleSubmit, getValues, setValue, formState, trigger } =
    useForm<CheckoutFormSchema>({
      resolver:      zodResolver(checkoutFormSchema(lang)),
      defaultValues: buildDefaults(user?.name),
      mode:          "onChange",
    });

  // ── Draft recovery ───────────────────────────────────────────────────
  // Placed after useForm so setValue is in scope.
  const [pendingDraft, setPendingDraft] = useState<import("../resilience").CheckoutDraft | null>(null);

  useEffect(() => {
    let alive = true;
    loadCheckoutDraft().then((draft: import("../resilience").CheckoutDraft | null) => {
      if (!alive || !draft) return;
      if (draft.idempotencyKey !== idempotencyKeyRef.current) {
        setPendingDraft(draft);
      }
    }).catch(() => {});
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    const f = pendingDraft.form;
    if (f.fullName)        setValue("fullName",        f.fullName,        { shouldDirty: true });
    if (f.phone)           setValue("phone",           f.phone,           { shouldDirty: true });
    if (f.streetName)      setValue("streetName",      f.streetName,      { shouldDirty: true });
    if (f.buildingNumber)  setValue("buildingNumber",  f.buildingNumber,  { shouldDirty: true });
    if (f.floor)           setValue("floor",           f.floor,           { shouldDirty: true });
    if (f.apartmentNumber) setValue("apartmentNumber", f.apartmentNumber, { shouldDirty: true });
    if (f.note)            setValue("note",            f.note,            { shouldDirty: true });
    if (f.promoCode)       setValue("promoCode",       f.promoCode,       { shouldDirty: true });
    setPendingDraft(null);
    void clearCheckoutDraft();
  }, [pendingDraft, setValue]);

  const handleDiscardDraft = useCallback(() => {
    setPendingDraft(null);
    void clearCheckoutDraft();
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────

  // Fetch saved phone from profile
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .single();
        if (!alive || error || !data?.phone) return;
        setSavedProfilePhone(data.phone as string);
      } catch {
        // ignore — fallback is manual input
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Fetch saved addresses
  useEffect(() => {
    if (!user?.id) return;
    fetchAddresses(user.id);
  }, [user?.id, fetchAddresses]);

  // Autofill from account profile
  useEffect(() => {
    if (!useAccountProfile) return;
    if (user?.name)       setValue("fullName", user.name,          { shouldValidate: true, shouldDirty: true });
    if (savedProfilePhone) setValue("phone",   savedProfilePhone,  { shouldValidate: true, shouldDirty: true });
  }, [useAccountProfile, user?.name, savedProfilePhone, setValue]);

  // Autofill from saved address
  useEffect(() => {
    if (!useSavedAddress || !defaultAddress) return;
    setValue("streetName",      defaultAddress.street,           { shouldValidate: true, shouldDirty: true });
    setValue("buildingNumber",  defaultAddress.building,         { shouldValidate: true, shouldDirty: true });
    setValue("floor",           defaultAddress.floor ?? "",      { shouldValidate: true, shouldDirty: true });
    setValue("apartmentNumber", defaultAddress.apartment ?? "",  { shouldValidate: true, shouldDirty: true });
  }, [useSavedAddress, defaultAddress, setValue]);

  // ── Handlers ─────────────────────────────────────────────────────────

  /** Validate form then advance to review step. Returns true if valid. */
  const goToReview = useCallback(async (): Promise<boolean> => {
    const valid = await trigger();
    if (!valid) {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return false;
    }
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track("checkout_step_review_viewed", { item_count: cartLines.length });
    setStep("review");
    return true;
  }, [trigger, cartLines.length]);

  const backToDetails = useCallback(() => {
    setStep("details");
  }, []);

  const handleApplyPromo = useCallback(() => {
    const code = (getValues("promoCode") ?? "").trim().toUpperCase();
    if (!code) return;
    setPromoCodeStore(code);
    setValue("promoCode", code);
    const willDiscount = createCheckoutPricing(cartLines, { promoCode: code }).discount > 0;
    if (willDiscount) {
      setPromoError(null);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setPromoError(t("checkout.promoInvalid"));
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [cartLines, getValues, setPromoCodeStore, setValue, t]);

  /** Core order placement — called once phone is verified (or gate bypassed). */
  const placeOrderForForm = useCallback(
    async (form: CheckoutFormSchema): Promise<void> => {
      if (!user?.id) return;

      // ── Save recovery draft before any network call ────────────────────
      // If the app is killed mid-submission (backgrounded on iOS, OOM on
      // Android), the user can recover their form state on next launch.
      void saveCheckoutDraft({
        idempotencyKey: idempotencyKeyRef.current,
        form: {
          fullName:        form.fullName,
          phone:           form.phone,
          streetName:      form.streetName,
          buildingNumber:  form.buildingNumber,
          floor:           form.floor,
          apartmentNumber: form.apartmentNumber,
          note:            form.note ?? "",
          promoCode:       form.promoCode ?? "",
        },
        paymentMethod,
      });

      const reservationFailures = await ensureReservations();
      if (reservationFailures.length > 0) {
        setSubmitError(t("checkout.reservationFailed"));
        track("checkout_reservation_failed", {
          failed_count: reservationFailures.length,
        });
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setSubmitting(false);
        return;
      }

      const checkoutNote = buildCheckoutNote({
        note:              form.note ?? "",
        paymentLabel:      paymentLabel(paymentMethod),
        paymentMethod,
        requestPosMachine: requestPos,
        lang,
      });

      const manual = isManualWalletPayment(paymentMethod);
      let paymentProofUrl: string | undefined;

      if (manual) {
        if (!transferNumber.trim()) {
          setManualPaymentError(t("checkout.missingTransferNum"));
          setSubmitting(false);
          return;
        }
        if (!receiptUri) {
          setManualPaymentError(t("checkout.missingReceipt"));
          setSubmitting(false);
          return;
        }
        setUploadingReceipt(true);
        try {
          paymentProofUrl = await uploadPaymentReceipt(user.id, receiptUri);
        } catch (err) {
          setManualPaymentError(
            err instanceof ReceiptUploadError
              ? t(RECEIPT_ERROR_KEYS[err.code])
              : t("checkout.uploadReceiptError"),
          );
          setSubmitting(false);
          setUploadingReceipt(false);
          return;
        }
        setUploadingReceipt(false);
        setManualPaymentError(null);
      }

      // ── Coordinate resolution (three-tier) ─────────────────────────────
      // 1. GPS coordinates (most accurate)
      // 2. Saved default address lat/lng
      // 3. Geocode the form address on the fly (new address, no GPS)
      let resolvedCoords: { lat: number; lng: number } | null =
        customerCoordinates ??
        (defaultAddress &&
          typeof defaultAddress.lat === "number" &&
          typeof defaultAddress.lng === "number"
            ? { lat: defaultAddress.lat, lng: defaultAddress.lng }
            : null);

      if (!resolvedCoords && !useSavedAddress) {
        // Best-effort: geocode the address the user just typed.
        // Failure is non-fatal — the order can be placed without coords;
        // the delivery quote will be less accurate but the order succeeds.
        try {
          const geocoded = await geocodeAddress({
            street:   form.streetName?.trim() ?? "",
            building: form.buildingNumber?.trim() ?? "",
            district: "",
            city:     form.city?.trim() ?? "القاهرة",
          });
          if (geocoded && geocoded.confidence >= 0.3) {
            resolvedCoords = { lat: geocoded.lat, lng: geocoded.lng };
          }
        } catch {
          // Non-fatal — proceed without coordinates
        }
      }

      const command = buildCheckoutSubmitCommand({
        idempotencyKey:    idempotencyKeyRef.current,
        user,
        form:              form as unknown as CheckoutFormInput,
        pricing,
        coordinates:       resolvedCoords,
        paymentMethod,
        paymentLabel:      paymentLabel(paymentMethod),
        requestPosMachine: requestPos,
        note:              checkoutNote,
        transferNumber:    manual ? transferNumber : undefined,
        paymentProofUrl:   manual ? paymentProofUrl : undefined,
      });

      let orderId: string;
      // eslint-disable-next-line prefer-const
      let result!: Awaited<ReturnType<typeof createCheckoutOrder>>;
      try {
        result = await createCheckoutOrder(command);
        orderId = result.orderId;

        if (isManualWalletPayment(paymentMethod) && paymentProofUrl) {
          const needsPatch =
            result.status !== "payment_pending" ||
            result.paymentStatus !== "pending_verification";
          if (needsPatch) {
            await patchOrderManualPayment(
              orderId,
              { transferNumber: transferNumber.trim(), paymentProofUrl },
              paymentMethod,
            );
          }
        }
      } catch (err) {
        if (__DEV__) console.warn("[checkout] createCheckoutOrder failed:", err);
        const isReplay = err instanceof CheckoutRequestError && err.code === "UNKNOWN" &&
          (err as unknown as { idempotentReplay?: boolean }).idempotentReplay;
        if (isReplay) track("checkout_idempotent_replay");
        else track("checkout_failed", {
          error_code:    err instanceof CheckoutRequestError ? err.code : "UNKNOWN",
          payment_method: paymentMethod,
          retryable:     err instanceof CheckoutRequestError ? (err.retryable ? 1 : 0) : 0,
        });
        setSubmitError(
          err instanceof CheckoutRequestError
            ? formatCheckoutError(err, lang)
            : t("checkout.submitError"),
        );
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setSubmitting(false);
        return;
      }

      // Inventory commit is best-effort — order is already placed.
      void commitReservations(orderId);
      void refreshOrders(user.id);
      invalidateOrders(queryClient, user.id);

      track("checkout_completed", {
        order_id:       orderId,
        payment_method: paymentMethod,
        total:          pricing.total,
        item_count:     pricing.itemCount,
        discount:       pricing.discount,
        has_coupon:     pricing.discount > 0 ? 1 : 0,
        idempotent_replay: result.idempotentReplay ? 1 : 0,
      });

      setPlacedOrderId(orderId);
      clearCart();
      resetCheckout();
      void clearCheckoutDraft();
      idempotencyKeyRef.current = createIdempotencyKey();

      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep("success");
      setSubmitting(false);
    },
    [
      user,
      paymentMethod,
      requestPos,
      pricing,
      customerCoordinates,
      defaultAddress,
      transferNumber,
      receiptUri,
      lang,
      t,
      ensureReservations,
      commitReservations,
      refreshOrders,
      queryClient,
      clearCart,
      resetCheckout,
    ],
  );

  const handlePickReceipt = useCallback(async () => {
    setManualPaymentError(null);
    const picked = await pickPaymentReceiptImage();
    if (picked.ok) {
      setReceiptUri(picked.localUri);
      return;
    }
    if (!picked.cancelled) {
      setManualPaymentError(t(RECEIPT_ERROR_KEYS[picked.code]));
    }
  }, [setReceiptUri, t]);

  const onSubmit = useCallback(
    async (form: CheckoutFormSchema): Promise<void> => {
      // ── Synchronous duplicate-submission guard ──────────────────────────
      // This ref check fires BEFORE any await so it's immune to React's
      // batched-setState race. The idempotency key is a second-line defence
      // at the server; this guard prevents the redundant network round-trip.
      if (submitInProgressRef.current) return;
      submitInProgressRef.current = true;

      if (cartLines.length === 0) {
        submitInProgressRef.current = false;
        return;
      }
      setSubmitting(true);
      setSubmitError(null);

      if (!user?.id) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setSubmitting(false);
        setShowAuthGate(true);
        // Auth gate is a modal pause — release the guard so the user can
        // re-submit after signing in without reloading the screen.
        submitInProgressRef.current = false;
        return;
      }

      if (!PHONE_VERIFICATION_ENABLED) {
        await placeOrderForForm(form);
        // placeOrderForForm clears submitting on all its own exit paths;
        // release the guard here so a failed attempt can be retried.
        submitInProgressRef.current = false;
        return;
      }

      let phoneVerified = false;
      let profilePhone: string | null = null;
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("phone, phone_verified")
          .eq("id", user.id)
          .single();
        if (!error) {
          phoneVerified = profile?.phone_verified === true;
          profilePhone  = (profile?.phone ?? null) as string | null;
        }
      } catch (e) {
        if (__DEV__) console.warn("[checkout] profile lookup threw:", e);
      }

      const formPhoneE164    = normalizeEgyptianPhone((form.phone ?? "").trim());
      const profilePhoneE164 = profilePhone ? normalizeEgyptianPhone(profilePhone) : null;
      if (phoneVerified && formPhoneE164 && formPhoneE164 !== profilePhoneE164) {
        phoneVerified = false;
      }

      if (!phoneVerified) {
        const candidate = (form.phone ?? "").trim() || profilePhone || "";
        const e164 = normalizeEgyptianPhone(candidate);
        if (!e164) {
          setSubmitError(t("checkout.invalidPhone"));
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setSubmitting(false);
          submitInProgressRef.current = false;
          return;
        }
        try {
          await sendPhoneOtp(candidate);
          setOtpPending({ phone: e164, form });
          // OTP flow is a modal pause — release so the verified callback can
          // call placeOrderForForm normally.
          submitInProgressRef.current = false;
        } catch {
          if (__DEV__) console.warn("[checkout] sendPhoneOtp failed");
          setSubmitError(t("checkout.otpSendError"));
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setSubmitting(false);
          submitInProgressRef.current = false;
        }
        return;
      }

      await placeOrderForForm(form);
      submitInProgressRef.current = false;
    },
    [cartLines, user, placeOrderForForm, t],
  );

  const handleOtpVerified = useCallback(
    (verifiedPhone: string): void => {
      if (!otpPending) return;
      const stashedForm = otpPending.form;
      setOtpPending(null);
      const stashedE164 = normalizeEgyptianPhone(stashedForm.phone ?? "");
      if (verifiedPhone && verifiedPhone !== stashedE164) {
        const local = verifiedPhone.replace(/^\+20/, "0");
        setValue("phone", local, { shouldValidate: true, shouldDirty: true });
        stashedForm.phone = local;
      }
      void placeOrderForForm(stashedForm);
    },
    [otpPending, placeOrderForForm, setValue],
  );

  const handleOtpCancel = useCallback((): void => {
    setOtpPending(null);
    setSubmitting(false);
    setSubmitError(t("checkout.otpCancelled"));
  }, [t]);

  const onPaymentChange = useCallback(
    (m: typeof paymentMethod) => {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      setPaymentMethod(m);
      if (!isManualWalletPayment(m)) setManualPaymentError(null);
    },
    [setPaymentMethod],
  );

  const onTogglePos = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setRequestPos((v) => !v);
  }, []);

  // ── Coupon handlers ──────────────────────────────────────────────────
  const handleApplyCoupon = useCallback(async () => {
    await applyCodeFn(couponCode, pricing.subtotal);
    // Analytics fired after applyCodeFn resolves — couponResult state is set
    // inside useApplyCoupon; we check it on next render via couponApplied.
  }, [applyCodeFn, couponCode, pricing.subtotal]);

  const handleRemoveCoupon = useCallback(() => {
    track("checkout_coupon_removed", { code: couponResult?.code ?? "" });
    removeCouponFn();
    setCouponCode("");
  }, [removeCouponFn, couponResult]);

  // ── Return ────────────────────────────────────────────────────────────
  return {
    step,
    placedOrderId,
    items,
    itemCount,
    paymentMethod,
    transferNumber,
    receiptUri,
    setPaymentMethod,
    setTransferNumber,
    requestPos,
    submitting,
    submitError,
    promoError,
    uploadingReceipt,
    manualPaymentError,
    showAuthGate,
    setShowAuthGate,
    otpPending,
    savedProfilePhone,
    useAccountProfile,
    setUseAccountProfile,
    useSavedAddress,
    setUseSavedAddress,
    defaultAddress,
    deliveryQuote,
    selectedBranchId,
    setSelectedBranchId,
    pricing,
    promoApplied,
    form: { control, handleSubmit, getValues, setValue, formState, trigger },
    goToReview,
    backToDetails,
    handleApplyPromo,
    handlePickReceipt,
    onSubmit,
    handleOtpVerified,
    handleOtpCancel,
    onPaymentChange,
    onTogglePos,
    couponApplied,
    couponError,
    couponValidating,
    couponCode,
    appliedCouponCode: couponResult?.valid ? couponResult.code : "",
    couponDiscountAmount: couponResult?.valid ? couponResult.discountAmount : 0,
    setCouponCode,
    handleApplyCoupon,
    handleRemoveCoupon,
    // ── Draft recovery ─────────────────────────────────────────────────
    pendingDraft,
    handleRestoreDraft,
    handleDiscardDraft,
    user,
    lang,
  };
}
