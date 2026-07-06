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

  const idempotencyKeyRef = useRef(createIdempotencyKey());

  // ── Derived cart lines (memoized) ────────────────────────────────────
  const cartLines = useMemo(
    () =>
      items
        .filter((i) => i.product && i.product.inStock && i.product.stock > 0)
        .map((i) => ({
          productId: i.productId,
          quantity:  i.quantity,
          unitPrice: i.product.price ?? 0,
          name:      i.product.name,
          code:      i.product.code,
        })),
    [items],
  );

  // ── Pricing (memoized) ───────────────────────────────────────────────
  const pricing = useMemo(
    () =>
      createCheckoutPricing(cartLines, {
        promoCode:   promoCodeFromStore,
        shippingFee: deliveryQuote.cost,
      }),
    [cartLines, promoCodeFromStore, deliveryQuote.cost],
  );

  const promoApplied = pricing.discount > 0;

  // ── React-hook-form ──────────────────────────────────────────────────
  const { control, handleSubmit, getValues, setValue, formState, trigger } =
    useForm<CheckoutFormSchema>({
      resolver:      zodResolver(checkoutFormSchema(lang)),
      defaultValues: buildDefaults(user?.name),
      mode:          "onChange",
    });

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
    setStep("review");
    return true;
  }, [trigger]);

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

      const reservationFailures = await ensureReservations();
      if (reservationFailures.length > 0) {
        setSubmitError(t("checkout.reservationFailed"));
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

      const command = buildCheckoutSubmitCommand({
        idempotencyKey:    idempotencyKeyRef.current,
        user,
        form:              form as unknown as CheckoutFormInput,
        pricing,
        paymentMethod,
        paymentLabel:      paymentLabel(paymentMethod),
        requestPosMachine: requestPos,
        note:              checkoutNote,
        transferNumber:    manual ? transferNumber : undefined,
        paymentProofUrl:   manual ? paymentProofUrl : undefined,
      });

      let orderId: string;
      try {
        const result = await createCheckoutOrder(command);
        orderId = result.orderId;

        if (isManualWalletPayment(paymentMethod) && paymentProofUrl) {
          const needsPatch =
            result.status !== "pending_payment" ||
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

      setPlacedOrderId(orderId);
      clearCart();
      resetCheckout();
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
      if (cartLines.length === 0) return;
      setSubmitting(true);
      setSubmitError(null);

      if (!user?.id) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setSubmitting(false);
        setShowAuthGate(true);
        return;
      }

      if (!PHONE_VERIFICATION_ENABLED) {
        await placeOrderForForm(form);
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
          return;
        }
        try {
          await sendPhoneOtp(candidate);
          setOtpPending({ phone: e164, form });
        } catch {
          if (__DEV__) console.warn("[checkout] sendPhoneOtp failed");
          setSubmitError(t("checkout.otpSendError"));
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setSubmitting(false);
        }
        return;
      }

      await placeOrderForForm(form);
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
    user,
    lang,
  };
}
