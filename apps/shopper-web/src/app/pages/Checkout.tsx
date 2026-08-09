// Checkout.tsx – with cascading address dropdowns and dynamic delivery fee
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useDeliveryQuote, useLocationState, useBrowserLocation } from "@pharmacy/domain-location";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  Gift,
  Link2,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Smartphone,
  Truck,
  Upload,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { createCheckoutOrder } from "../../services/shopperCheckoutApi";
import {
  isManualPaymentMethod,
  patchWebOrderManualPayment,
  uploadWebPaymentReceipt,
} from "../../services/webPaymentApi";
import {
  CheckoutFieldErrors,
  CheckoutFieldName,
  CheckoutFormValues,
  getDeliveryWindowLabel,
  getDeliveryWindowSentence,
  normalizeEgyptianPhone,
} from "../config";
import { CheckoutRequestError, formatCheckoutError } from "../checkout/errors";
import { createCheckoutPricing } from "../checkout/pricing";
import {
  buildCheckoutAddressSnapshot,
  buildCheckoutNote,
  buildCheckoutSubmitCommand,
  createIdempotencyKey,
} from "../checkout/payload";
import {
  hasCheckoutValidationErrors,
  validateCheckoutInput,
} from "../checkout/validation";
import { EmptyState, PageHero, SectionIntro } from "../components/BrandPrimitives";
import { BranchSelector } from "../components/BranchSelector";
import { BranchMapEmbed } from "../components/BranchMapEmbed";
import { GeofenceStatusBanner } from "../components/GeofenceStatusBanner";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { ShopperPage, ShopperSurface } from "../components/ShopperPrimitives";
import { PlacesAutocompleteField } from "../components/PlacesAutocompleteField";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { cn } from "../components/UI";
import { appendOrder } from "../orders";
import { getCatalogProductImage } from "../catalog";
import { getLocalizedProductName } from "../localization";
import { GOVERNORATE_LOCK, DEFAULT_DELIVERY_FEE } from "../constants/location";
import { useBranches } from "../hooks/useBranches";

// ─── Field Components ─────────────────────────────────────────────────────────

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  dir,
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  error?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500" />
        <input
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          dir={dir}
          className={cn(
            "h-12 w-full rounded-2xl border bg-slate-50 ps-11 pe-4 text-sm font-semibold text-slate-700 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-teal-500/15",
            error
              ? "border-rose-300 focus:border-rose-400"
              : "border-slate-200 focus:border-teal-400",
          )}
        />
      </div>
      {error ? <p className="mt-2 text-xs font-bold text-rose-600">{error}</p> : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={cn("text-end font-black", accent ? "text-slate-700" : "text-slate-900")}>
        {value}
      </span>
    </div>
  );
}

function itemCount(cart: Array<{ quantity: number }>) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

// ─── Main Checkout Component ──────────────────────────────────────────────────

export default function Checkout() {
  const { user } = useAuth();
  const { cart, clearCart } = useCart();
  const { refreshCatalog } = useCatalog();
  const { t, lang } = useLanguage();
  const isShopperShell = useIsShopperShell();

  // Auto-request location on checkout mount — fires the delivery quote
  // immediately so zone validation and fee calculation work without the
  // user having to click "Use my location".
  useBrowserLocation(true);
  const [step, setStep] = useState<1 | 2>(1);

  // Scroll to top whenever the user advances between checkout steps so they
  // always land at the top of the Review panel, not mid-page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<CheckoutFieldName>>(new Set());
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState<number>(0);
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  /** Synchronous guard — prevents double-tap submissions while isSubmitting state update is still pending. */
  const submitInProgressRef = useRef(false);
  type PaymentMethodId = "cod" | "instapay" | "vodafone" | "online" | "banquemisr";

  // ── Cairo-only branch selection ───────────────────────────────────────
  const { data: deliveryBranches = [] } = useBranches();
  const primaryDeliveryBranch = deliveryBranches[0] ?? null;
  const selectedArea = useLocationState((state) => state.selectedArea);
  const selectedBranchId = useLocationState((state) => state.selectedBranchId);
  const locationCoordinates = useLocationState((state) => state.coordinates);
  const locationPermission = useLocationState((state) => state.permission);
  const setSelectedArea = useLocationState((state) => state.setSelectedArea);
  const setSelectedBranchId = useLocationState((state) => state.setSelectedBranchId);
  const setLocationCoordinates = useLocationState((state) => state.setCoordinates);
  const setLocationPermission = useLocationState((state) => state.setPermission);

  const [form, setForm] = useState<CheckoutFormValues>({
    fullName: "",
    phone: "",
    city: "",
    streetName: "",
    buildingNumber: "",
    floor: "",
    apartmentNumber: "",
    note: "",
    promoCode: "",
    cityId: "",
    regionId: "",
    subRegionId: "",
    building: "",
    apartment: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cod");
  const [requestPosMachine, setRequestPosMachine] = useState(false);
  const [transferNumber, setTransferNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [manualPaymentError, setManualPaymentError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Force Cairo city value in the form (service is Cairo-only).
  useEffect(() => {
    setForm((current) => ({ ...current, city: GOVERNORATE_LOCK }));
  }, []);

  // Set / repair branch + area selection (handles stale persisted IDs too).
  useEffect(() => {
    if (!primaryDeliveryBranch) return;

    const areaSet = new Set(deliveryBranches.map((branch) => branch.area));
    const hasValidArea = Boolean(selectedArea) && areaSet.has(selectedArea);
    const hasValidBranch = Boolean(selectedBranchId)
      && deliveryBranches.some((branch) => branch.id === selectedBranchId);

    if (!hasValidArea) setSelectedArea(primaryDeliveryBranch.area);
    if (!hasValidBranch) setSelectedBranchId(primaryDeliveryBranch.id);
  }, [
    deliveryBranches,
    primaryDeliveryBranch,
    selectedArea,
    selectedBranchId,
    setSelectedArea,
    setSelectedBranchId,
  ]);

  // Ensure selected branch stays valid when area changes.
  useEffect(() => {
    if (!selectedArea) return;
    const branchesInArea = deliveryBranches.filter((branch) => branch.area === selectedArea);
    if (!branchesInArea.length) return;
    if (!branchesInArea.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(branchesInArea[0].id);
    }
  }, [deliveryBranches, selectedArea, selectedBranchId]);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    setForm((current) => ({
      ...current,
      fullName: current.fullName || user.fullName || "",
      phone: current.phone || normalizeEgyptianPhone(user.phone || ""),
      streetName: current.streetName || user.address || "",
    }));
  }, [user]);

  // Clear manual payment state when the user switches payment methods so
  // a stale receipt / transfer number never gets attached to a COD order.
  useEffect(() => {
    setTransferNumber("");
    setReceiptFile(null);
    setReceiptPreview(null);
    setManualPaymentError(null);
  }, [paymentMethod]);

  const selectedBranch = useMemo(
    () => deliveryBranches.find((branch) => branch.id === selectedBranchId),
    [deliveryBranches, selectedBranchId],
  );

  // Compute errors
  const validationErrors = validateCheckoutInput(form, lang);
  const displayErrors: CheckoutFieldErrors = {};
  if (isSubmitted) {
    Object.assign(displayErrors, validationErrors);
  } else {
    for (const field of touchedFields) {
      if (validationErrors[field]) {
        displayErrors[field] = validationErrors[field];
      }
    }
  }

  const totalItems = itemCount(cart);
  const subtotal = cart.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const cartSnapshot = useMemo(
    () => ({
      items: cart.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.product?.price || 0,
        code: item.product?.code,
        name: item.product ? getLocalizedProductName(item.product, lang) : item.product_id,
      })),
      itemCount: totalItems,
      subtotal,
    }),
    [cart, lang, subtotal, totalItems],
  );
  const deliveryQuote = useDeliveryQuote(cartSnapshot, form.streetName.trim(), selectedBranchId || undefined);

  // ── Auto-geocode street address to get delivery quote when no GPS ─────────
  // When the user types a street address but hasn't granted GPS permission,
  // geocode it after a 1.5s debounce and feed the result into the location
  // store so useDeliveryQuote can run the zone check.
  useEffect(() => {
    const street = form.streetName.trim();
    if (!street || street.length < 6) return;
    if (locationCoordinates) return; // GPS already set — no need to geocode

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          text: `${street}, القاهرة, مصر`,
          apiKey: "c6beba954a794cb49263d1679e4bc8bf",
          limit: "1",
          lang: "ar",
          filter: "countrycode:eg",
        });
        const resp = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);
        if (!resp.ok) return;
        const json = await resp.json();
        const feature = json.features?.[0];
        if (!feature) return;
        const { lat, lon } = feature.properties;
        if (lat && lon) {
          setLocationCoordinates({ lat, lng: lon });
        }
      } catch {
        // Non-fatal — quote just won't run without coordinates
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [form.streetName, locationCoordinates, setLocationCoordinates]);

  // Use the dynamic quote cost when available; otherwise fall back to the
  // flat DEFAULT_DELIVERY_FEE so checkout is usable without location permission.
  const dynamicDeliveryFee = deliveryQuote.data?.cost ?? DEFAULT_DELIVERY_FEE;
  const dynamicFeeLabel = deliveryQuote.isLoading
    ? (lang === "ar" ? "جارٍ الحساب…" : "Calculating…")
    : deliveryQuote.data?.isDeliverable === false
    ? (lang === "ar" ? "غير متاح" : "Unavailable")
    : `${dynamicDeliveryFee} ${lang === "ar" ? "ج.م" : "EGP"}`;

  const pricing = useMemo(
    () =>
      createCheckoutPricing(cartSnapshot.items, {
        promoCode: promoApplied ? form.promoCode : undefined,
        shippingFee: dynamicDeliveryFee,
        discountAmount: promoApplied && couponDiscountAmount > 0 ? couponDiscountAmount : undefined,
      }),
    [cartSnapshot.items, dynamicDeliveryFee, form.promoCode, promoApplied, couponDiscountAmount],
  );

  const addressSnapshot = useMemo(
    () =>
      buildCheckoutAddressSnapshot(form, {
        region: selectedArea || undefined,
        subRegion:
          (lang === "ar" ? selectedBranch?.nameAr : selectedBranch?.nameEn) || undefined,
      }),
    [form, lang, selectedArea, selectedBranch],
  );
  const address = addressSnapshot.formatted;
  const streetLine = addressSnapshot.streetLine;

  const paymentMethodLabel = (() => {
    if (paymentMethod === "cod") return lang === "ar" ? "الدفع عند الاستلام" : "Cash on delivery";
    if (paymentMethod === "instapay") return lang === "ar" ? "إنستاباي" : "InstaPay";
    if (paymentMethod === "vodafone") return lang === "ar" ? "فودافون كاش" : "Vodafone Cash";
    if (paymentMethod === "online") return lang === "ar" ? "رابط دفع إلكتروني" : "Online payment link";
    return lang === "ar" ? "بنك مصر (قريباً)" : "Banque Misr (coming soon)";
  })();

  const checkoutSignals = [
    {
      Icon: Truck,
      title: lang === "ar" ? "التوصيل" : "Delivery",
      value: deliveryQuote.data
        ? deliveryQuote.data.eta
          ? `${deliveryQuote.data.eta.minMinutes}-${deliveryQuote.data.eta.maxMinutes} min`
          : getDeliveryWindowLabel(lang)
        : getDeliveryWindowLabel(lang),
    },
    {
      Icon: CreditCard,
      title: lang === "ar" ? "رسوم التوصيل" : "Delivery fee",
      value: deliveryQuote.data?.isDeliverable ? dynamicFeeLabel : (lang === "ar" ? "غير متاح" : "Unavailable"),
    },
    {
      Icon: ShieldCheck,
      title: lang === "ar" ? "التحقق" : "Validation",
      value: deliveryQuote.data?.branch?.nameEn
        ? `${lang === "ar" ? "الفرع" : "Branch"}: ${lang === "ar" ? deliveryQuote.data.branch.nameAr : deliveryQuote.data.branch.nameEn}`
        : lang === "ar" ? "الاسم والهاتف والعنوان" : "Name, phone, and address",
    },
  ];

  const reviewPanels = [
    {
      Icon: MapPin,
      title: lang === "ar" ? "عنوان التوصيل" : "Delivery address",
      value: address,
    },
    {
      Icon: Clock3,
      title: lang === "ar" ? "وعد التوصيل" : "Delivery promise",
      value: deliveryQuote.data
        ? deliveryQuote.data.eta
          ? `${deliveryQuote.data.eta.minMinutes}-${deliveryQuote.data.eta.maxMinutes} min`
          : getDeliveryWindowSentence(lang)
        : getDeliveryWindowSentence(lang),
    },
    {
      Icon: CreditCard,
      title: lang === "ar" ? "طريقة الدفع" : "Payment",
      value: paymentMethodLabel,
    },
  ];

  const updateField = (field: CheckoutFieldName | "note" | "promoCode", value: string) => {
    setForm((current) => ({
      ...current,
      [field]: field === "phone" ? normalizeEgyptianPhone(value) : value,
    }));
  };

  const requestCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setSubmitError(
        lang === "ar"
          ? "خدمة تحديد الموقع غير متاحة على هذا الجهاز."
          : "Location services are not available on this device.",
      );
      return;
    }

    setSubmitError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationPermission("granted");
      },
      () => {
        setLocationPermission("denied");
        setSubmitError(
          lang === "ar"
            ? "تعذر تحديد موقعك الحالي. يرجى السماح بالوصول إلى الموقع ثم إعادة المحاولة."
            : "We couldn't detect your current location. Please allow location access and try again.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 10_000,
      },
    );
  };

  const markFieldTouched = (field: CheckoutFieldName) => {
    setTouchedFields((prev) => new Set(prev).add(field));
  };

  const validateBeforeNextStep = () => {
    const nextErrors = validateCheckoutInput(form, lang);
    setIsSubmitted(true);
    if (hasCheckoutValidationErrors(nextErrors)) {
      setSubmitError(
        lang === "ar"
          ? "يرجى استكمال بيانات التوصيل بشكل صحيح قبل متابعة الطلب."
          : "Please complete the delivery details correctly before continuing.",
      );
      setStep(1);
      return false;
    }
    setSubmitError("");
    return true;
  };

  // ── Server-validated coupon state ───────────────────────────────────────
  const handleApplyPromo = async () => {
    const code = form.promoCode.trim().toUpperCase();
    if (!code) return;

    setCouponValidating(true);
    setPromoError("");
    setPromoApplied(false);
    setCouponDiscountAmount(0);

    try {
      const { data, error } = await getSupabaseClient().functions.invoke("validate-coupon", {
        body: {
          code,
          order_subtotal: pricing.subtotal,
        },
      });

      if (error || !data) {
        setPromoError(lang === "ar" ? "تعذّر التحقق من الكود. حاول مرة أخرى." : "Could not validate coupon. Please try again.");
        return;
      }

      if (data.valid) {
        setPromoApplied(true);
        setCouponDiscountAmount(data.discount_amount ?? 0);
        setPromoError("");
      } else {
        const reasons: Record<string, string> = {
          not_found:        lang === "ar" ? "كود الخصم غير صحيح أو غير موجود." : "Invalid or unknown coupon code.",
          inactive:         lang === "ar" ? "كود الخصم غير مفعّل حالياً." : "This coupon is currently inactive.",
          expired:          lang === "ar" ? "انتهت صلاحية كود الخصم." : "This coupon has expired.",
          limit_reached:    lang === "ar" ? "تم استنفاد الحد الأقصى لهذا الكود." : "This coupon has reached its usage limit.",
          already_redeemed: lang === "ar" ? "لقد استخدمت هذا الكود من قبل." : "You have already used this coupon.",
          first_order_only: lang === "ar" ? "هذا الكود للطلب الأول فقط." : "This coupon is valid for first orders only.",
          min_order_not_met:lang === "ar" ? `الحد الأدنى للطلب هو ${data.min_order_amount ?? ""} ج.م.` : `Minimum order of ${data.min_order_amount ?? ""} EGP required.`,
        };
        setPromoError(reasons[data.reason as string] ?? (lang === "ar" ? "كود الخصم غير صالح." : "Invalid coupon code."));
        setPromoApplied(false);
      }
    } catch {
      setPromoError(lang === "ar" ? "تعذّر التحقق من الكود." : "Could not validate coupon.");
    } finally {
      setCouponValidating(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateBeforeNextStep()) return;

    if (!user) {
      setSubmitError(
        "Please sign in before completing checkout.",
      );
      return;
    }

    if (cart.length === 0) {
      setSubmitError(
        "Your cart is empty. Add products before checkout.",
      );
      return;
    }

    if (!deliveryQuote.data) {
      // Only block if location permission was never granted.
      // When permission IS granted but the quote API is unreachable (CORS error,
      // network failure, Railway down), the order still goes through — the team
      // confirms deliverability manually and the flat DEFAULT_DELIVERY_FEE applies.
      if (locationPermission !== "granted") {
        setSubmitError(
          lang === "ar"
            ? "يرجى تفعيل خدمة الموقع في المتصفح لتأكيد إمكانية التوصيل."
            : "Please enable location services in your browser to confirm delivery availability.",
        );
        return;
      }
      // Location granted but quote unavailable → fall through with flat fee.
    }

    if (deliveryQuote.data && !deliveryQuote.data.isDeliverable) {
      setSubmitError(
        lang === "ar"
          ? "عنوانك خارج نطاق خدمة الفرع المختار حالياً."
          : "Your location is outside our service zone for the selected branch.",
      );
      return;
    }

    const items = cart.map((item) => ({
      productId: item.product_id,
      name: item.product ? getLocalizedProductName(item.product, lang) : item.product_id,
      quantity: item.quantity,
      price: item.product?.price || 0,
    }));

    if (!address || !streetLine || !form.city.trim()) {
      setSubmitError(
        "Unable to place order: address details are incomplete.",
      );
      return;
    }

    // Validate manual payment inputs before touching the server.
    const isManual = isManualPaymentMethod(paymentMethod);
    if (isManual) {
      if (!transferNumber.trim()) {
        setManualPaymentError(
          lang === "ar"
            ? "يرجى إدخال رقم هاتف المرسل أو معرف إنستاباي."
            : "Please enter the sender's phone number or InstaPay ID.",
        );
        return;
      }
      if (!receiptFile) {
        setManualPaymentError(
          lang === "ar"
            ? "يرجى رفع لقطة شاشة إيصال التحويل."
            : "Please upload a screenshot of the transfer receipt.",
        );
        return;
      }
    }

    setManualPaymentError(null);
    setSubmitError("");

    // Synchronous duplicate-submission guard — same pattern as React Native.
    if (submitInProgressRef.current) return;
    submitInProgressRef.current = true;

    setIsSubmitting(true);

    // Upload receipt before calling the Edge Function so the URL is available.
    let paymentProofUrl: string | undefined;
    if (isManual && receiptFile && user?.id) {
      setUploadingReceipt(true);
      try {
        paymentProofUrl = await uploadWebPaymentReceipt(user.id, receiptFile);
      } catch (uploadErr) {
        setManualPaymentError(
          uploadErr instanceof Error ? uploadErr.message : "تعذّر رفع الإيصال.",
        );
        setIsSubmitting(false);
        setUploadingReceipt(false);
        return;
      } finally {
        setUploadingReceipt(false);
      }
    }

    let orderId: string | null = null;
    let orderDate: string | null = null;
    let orderStatus = "pending";
    const checkoutNote = buildCheckoutNote({
      note: form.note,
      paymentLabel: paymentMethodLabel,
      paymentMethod,
      requestPosMachine,
      lang,
    });
    const submitCommand = buildCheckoutSubmitCommand({
      idempotencyKey: idempotencyKeyRef.current,
      user,
      form,
      pricing,
      coordinates: locationCoordinates,
      region: selectedArea || undefined,
      subRegion: (lang === "ar" ? selectedBranch?.nameAr : selectedBranch?.nameEn) || undefined,
      paymentMethod,
      paymentLabel: paymentMethodLabel,
      requestPosMachine,
      note: checkoutNote,
      transferNumber: isManual ? transferNumber.trim() : undefined,
      paymentProofUrl: isManual ? paymentProofUrl : undefined,
    });

    try {
      const response = await createCheckoutOrder(submitCommand);

      orderId = response.orderId;
      orderDate = response.createdAt;
      orderStatus = response.status;
      void refreshCatalog(true);

      // Patch the order with proof fields if the Edge Function didn't persist them.
      if (isManual && orderId && paymentProofUrl && isManualPaymentMethod(paymentMethod)) {
        const needsPatch =
          response.status !== "pending_payment"
          || response.paymentStatus !== "pending_verification";
        if (needsPatch) {
          void patchWebOrderManualPayment(orderId, transferNumber.trim(), paymentProofUrl, paymentMethod);
        }
      }

      try {
        const localOrder = appendOrder(
          {
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            city: form.city.trim(),
            street: streetLine,
            address: address || "Address not specified",
            note: checkoutNote,
            subtotal: pricing.subtotal,
            tax: pricing.tax,
            shipping: pricing.shipping,
            discount: pricing.discount,
            total: pricing.total,
            items,
          },
          {
            id: orderId ?? `LOCAL-${Date.now()}`,
            createdAt: orderDate ?? new Date().toISOString(),
            status: orderStatus.toLowerCase(),
          },
        );

        await clearCart();
        setPlacedOrderId(localOrder.id);
        idempotencyKeyRef.current = createIdempotencyKey();
      } catch {
        await clearCart();
        setPlacedOrderId(orderId ?? `SUBMITTED-${Date.now()}`);
        idempotencyKeyRef.current = createIdempotencyKey();
      }
    } catch (error) {

      if (error instanceof CheckoutRequestError && error.shouldRefreshCatalog) {
        void refreshCatalog(true);
      }

      if (error instanceof CheckoutRequestError && error.code === "AUTH") {
        setSubmitError(
          lang === "ar"
            ? "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى ثم إعادة المحاولة."
            : "Your session has expired. Please sign in again and retry checkout.",
        );
      } else if (error instanceof CheckoutRequestError && error.code === "TIMEOUT") {
        setSubmitError(
          lang === "ar"
            ? "استغرق إرسال الطلب وقتاً أطول من المتوقع. تحقق من الاتصال وحاول مرة أخرى."
            : "Checkout timed out. Please check your connection and try again.",
        );
      } else {
        setSubmitError(formatCheckoutError(error, lang));
      }
      return;
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const paymentMethodPanel = (
    <div className="space-y-3" role="radiogroup" aria-label={t("payment_method")}>
      <label
        className={cn(
          "flex cursor-pointer flex-col gap-3 rounded-[1.5rem] border bg-slate-50 p-5 transition-all",
          paymentMethod === "cod" ? "border-teal-400 ring-2 ring-teal-400/25" : "border-slate-200",
        )}
      >
        <div className="flex items-start gap-4">
          <input
            type="radio"
            name="checkout-payment"
            checked={paymentMethod === "cod"}
            onChange={() => setPaymentMethod("cod")}
            className="mt-1 h-5 w-5 accent-teal-600"
          />
          <div className="flex flex-1 items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-slate-900">{t("cash_on_delivery")}</p>
              <p className="text-sm font-semibold text-slate-500">
                {lang === "ar"
                  ? "تدفع عند استلام الطلب من المندوب."
                  : "Pay the courier when the order arrives."}
              </p>
            </div>
          </div>
        </div>
        {paymentMethod === "cod" ? (
          <label className="ms-9 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={requestPosMachine}
              onChange={(event) => setRequestPosMachine(event.target.checked)}
              className="h-4 w-4 accent-teal-600"
            />
            <span className="text-sm font-bold text-slate-700">{t("request_pos_machine")}</span>
          </label>
        ) : null}
      </label>

      <label
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-[1.5rem] border bg-slate-50 p-5 transition-all",
          paymentMethod === "instapay" ? "border-teal-400 ring-2 ring-teal-400/25" : "border-slate-200",
        )}
      >
        <input
          type="radio"
          name="checkout-payment"
          checked={paymentMethod === "instapay"}
          onChange={() => setPaymentMethod("instapay")}
          className="h-5 w-5 accent-teal-600"
        />
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-slate-900">{t("payment_insta_pay")}</p>
          <p className="text-sm font-semibold text-slate-500">{t("payment_insta_hint")}</p>
        </div>
      </label>

      <label
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-[1.5rem] border bg-slate-50 p-5 transition-all",
          paymentMethod === "vodafone" ? "border-teal-400 ring-2 ring-teal-400/25" : "border-slate-200",
        )}
      >
        <input
          type="radio"
          name="checkout-payment"
          checked={paymentMethod === "vodafone"}
          onChange={() => setPaymentMethod("vodafone")}
          className="h-5 w-5 accent-teal-600"
        />
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600">
          <Phone className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-slate-900">{t("payment_vodafone_cash")}</p>
          <p className="text-sm font-semibold text-slate-500">{t("payment_vodafone_hint")}</p>
        </div>
      </label>

      <label
        className={cn(
          "flex cursor-not-allowed items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-100/80 p-5 opacity-60",
        )}
      >
        <input type="radio" name="checkout-payment-online" disabled className="h-5 w-5 accent-teal-600" />
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400">
          <Link2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-slate-700">{t("payment_online_link")}</p>
          <p className="text-sm font-semibold text-slate-500">{t("payment_online_disabled")}</p>
        </div>
      </label>

      <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-700">{t("payment_banque_misr_placeholder")}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {lang === "ar" ? "سيتم إضافة التكامل لاحقاً." : "Integration will be added in a future release."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Manual payment upload panel ──────────────────────────────────────────
  const manualPaymentUploadPanel = isManualPaymentMethod(paymentMethod) ? (
    <div className="mt-4 space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          {lang === "ar" ? "تفاصيل التحويل" : "Transfer details"}
        </p>
        <h3 className="mt-1 text-sm font-black text-slate-900">
          {paymentMethod === "instapay"
            ? (lang === "ar" ? "إرسال عبر إنستاباي" : "Send via InstaPay")
            : (lang === "ar" ? "إرسال عبر فودافون كاش" : "Send via Vodafone Cash")}
        </h3>
      </div>

      {/* Transfer number */}
      <div>
        <label className="mb-2 block text-sm font-black text-slate-700">
          {paymentMethod === "instapay"
            ? (lang === "ar" ? "معرّف إنستاباي (IPA ID)" : "InstaPay ID (IPA ID)")
            : (lang === "ar" ? "رقم هاتف المرسل" : "Sender phone number")}
          <span className="ms-1 font-semibold text-rose-500">*</span>
        </label>
        <input
          type={paymentMethod === "vodafone" ? "tel" : "text"}
          value={transferNumber}
          onChange={(e) => setTransferNumber(e.target.value)}
          placeholder={paymentMethod === "instapay" ? "yourname@instapay" : "01XXXXXXXXX"}
          dir="ltr"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15"
        />
      </div>

      {/* Receipt upload */}
      <div>
        <label className="mb-2 block text-sm font-black text-slate-700">
          {lang === "ar" ? "إيصال التحويل (لقطة شاشة)" : "Transfer receipt (screenshot)"}
          <span className="ms-1 font-semibold text-rose-500">*</span>
        </label>

        {receiptPreview ? (
          <div className="relative">
            <img
              src={receiptPreview}
              alt="receipt preview"
              className="h-48 w-full rounded-2xl border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-400 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-600">
            <Upload className="h-6 w-6" />
            <span className="text-xs font-bold">
              {lang === "ar" ? "انقر لاختيار الصورة" : "Click to choose image"}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">PNG, JPG – بحد أقصى 10 ميجابايت</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setReceiptFile(file);
                setReceiptPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        )}
      </div>

      {manualPaymentError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600">
          {manualPaymentError}
        </p>
      )}
    </div>
  ) : null;

  // ── Checkout order summary sidebar ────────────────────────────────────────
  const checkoutSummary = (
    <div
      className={cn(
        "overflow-hidden",
        isShopperShell
          ? "rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
          : "checkout-summary-card card-premium",
      )}
    >
      <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4fbfb_100%)] px-6 py-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{t("order_summary")}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {cart.length} {lang === "ar" ? "منتج" : "items"}
            </p>
          </div>
          {isShopperShell ? (
            <div className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white">
              {lang === "ar" ? "مراجعة" : "Review"}
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-6">
        <div className={cn("mb-6 space-y-3", isShopperShell ? "" : "max-h-52 overflow-y-auto")}>
          {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
            >
              <ImageWithFallback
                src={item.product ? getCatalogProductImage(item.product) : undefined}
                alt=""
                className="h-14 w-14 flex-shrink-0 rounded-xl border border-slate-100 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.16),transparent_55%),linear-gradient(180deg,#ffffff_0%,#effaf8_100%)] object-cover"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-slate-800">
                  {item.product ? getLocalizedProductName(item.product, lang) : item.product_id}
                </p>
                <p className="text-xs font-semibold text-slate-400">x{item.quantity}</p>
              </div>
              <p className="flex-shrink-0 text-sm font-black text-slate-900">
                {((item.product?.price || 0) * item.quantity).toFixed(2)} {t("currency")}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-black text-slate-700">{t("promo_code")}</label>
          <div className="flex gap-2">
            <input
              value={form.promoCode}
              onChange={(event) => updateField("promoCode", event.target.value)}
              placeholder={lang === "ar" ? "أدخل كود الخصم" : "Enter promo code"}
              disabled={promoApplied}
              dir="ltr"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-teal-400 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void handleApplyPromo()}
              disabled={promoApplied || !form.promoCode.trim() || couponValidating}
              className={cn(
                "flex-shrink-0 rounded-2xl px-4 text-sm font-black transition-colors",
                promoApplied
                  ? "bg-slate-100 text-slate-600"
                  : "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] disabled:opacity-40",
              )}
            >
              {couponValidating
                ? (lang === "ar" ? "جارٍ التحقق…" : "Checking…")
                : promoApplied
                  ? (lang === "ar" ? "مفعّل ✓" : "Applied ✓")
                  : t("apply")}
            </button>
          </div>
          {promoError ? <p className="mt-2 text-xs font-bold text-rose-500">{promoError}</p> : null}
          {promoApplied ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-600">
              <Gift className="h-3.5 w-3.5" />
              {lang === "ar"
                ? `تم تفعيل خصم ${pricing.discount.toFixed(0)} ج.م`
                : `Discount of ${pricing.discount.toFixed(0)} EGP applied`}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <SummaryRow label={t("subtotal")} value={`${pricing.subtotal.toFixed(2)} ${t("currency")}`} />
          {promoApplied ? (
            <SummaryRow
              label={lang === "ar" ? "خصم الكود" : "Promo discount"}
              value={`- ${pricing.discount.toFixed(2)} ${t("currency")}`}
              accent
            />
          ) : null}

          {/* Dynamic delivery fee row */}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-500">{t("shipping")}</span>
            <div className="flex items-center gap-2">
              {selectedBranch ? (
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-black text-teal-700">
                  {lang === "ar" ? selectedBranch.nameAr : selectedBranch.nameEn}
                </span>
              ) : null}
              <span className="text-end font-black text-slate-700">
                {pricing.shipping.toFixed(2)} {t("currency")}
              </span>
            </div>
          </div>

          <SummaryRow
            label={lang === "ar" ? "وقت التوصيل" : "Delivery window"}
            value={
              deliveryQuote.data?.eta
                ? lang === "ar"
                  ? `من ${deliveryQuote.data.eta.minMinutes} إلى ${deliveryQuote.data.eta.maxMinutes} دقيقة`
                  : `${deliveryQuote.data.eta.minMinutes}-${deliveryQuote.data.eta.maxMinutes} min`
                : getDeliveryWindowLabel(lang)
            }
          />
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-lg font-black text-slate-900">{t("total")}</span>
            <span className="text-2xl font-black text-slate-700">
              {pricing.total.toFixed(2)} {t("currency")}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-600">
            {lang === "ar" ? "التوصيل" : "Delivery"}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {lang === "ar"
              ? "لن يمكن تأكيد الطلب إلا بعد إدخال الاسم ورقم الهاتف والعنوان بشكل صحيح."
              : "The order cannot be confirmed until the name, phone number, and address are entered correctly."}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-700">
            <ShieldCheck className="h-4 w-4 text-slate-600" />
            {t("secure_checkout")}
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {lang === "ar" ? "دفع آمن ومشفر 256-bit SSL" : "Secure payment protected with 256-bit SSL encryption"}
          </p>
        </div>
      </div>
    </div>
  );

  // ─── Address form fields – shared between desktop & mobile ────────────────
  const addressFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        icon={User}
        label={t("full_name")}
        value={form.fullName}
        onChange={(value) => updateField("fullName", value)}
        onBlur={() => markFieldTouched("fullName")}
        placeholder={lang === "ar" ? "الاسم بالكامل" : "Full name"}
        error={displayErrors.fullName}
      />
      <Field
        icon={Phone}
        label={t("phone")}
        value={form.phone}
        onChange={(value) => updateField("phone", value)}
        onBlur={() => markFieldTouched("phone")}
        placeholder="010XXXXXXXX"
        dir="ltr"
        error={displayErrors.phone}
      />

      {/* Cairo-only branch + area selection */}
      <div className="sm:col-span-2">
        <BranchSelector
          lang={lang}
          locations={deliveryBranches}
          selectedArea={selectedArea}
          selectedBranchId={selectedBranchId}
          onChangeArea={setSelectedArea}
          onChangeBranch={setSelectedBranchId}
        />
      </div>

      {/* Branch map embed — shows the selected branch location */}
      {selectedBranch && (
        <div className="sm:col-span-2">
          <BranchMapEmbed
            src={`https://maps.google.com/maps?q=${selectedBranch.lat},${selectedBranch.lng}&z=17&t=&ie=UTF8&iwloc=&output=embed`}
            title={lang === "ar" ? selectedBranch.nameAr : selectedBranch.nameEn}
          />
        </div>
      )}

      <div className="sm:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#ffffff_0%,#f8fbfb_62%,#eff6f7_100%)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">
                {lang === "ar" ? "تحديد الموقع" : "Improve address accuracy"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {locationCoordinates
                  ? (lang === "ar"
                    ? "تم تحديد موقعك. يمكنك تحديثه في أي وقت."
                    : "Location detected. You can refresh it anytime.")
                  : locationPermission === "denied"
                    ? (lang === "ar"
                      ? "تم رفض إذن الموقع. اضغط لإعادة المحاولة."
                      : "Location access was denied. Tap to try again.")
                    : (lang === "ar"
                      ? "استخدم موقعك الحالي لتحسين دقة العنوان ورسوم التوصيل."
                      : "Use your live location for a more accurate address and delivery quote.")}
              </p>
            </div>
            <button
              type="button"
              onClick={requestCurrentLocation}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-black shadow-sm transition",
                locationCoordinates
                  ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50",
              )}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
              {locationCoordinates
                ? (lang === "ar" ? "تحديث الموقع" : "Refresh location")
                : (lang === "ar" ? "استخدم موقعي" : "Use my location")}
            </button>
          </div>
        </div>
      </div>

      <div className="sm:col-span-2">
        {deliveryQuote.data ? (
          <GeofenceStatusBanner lang={lang} status={deliveryQuote.data} />
        ) : locationPermission === "denied" && cart.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-black">
              {lang === "ar" ? "تحقق من الموقع" : "Confirm location"}
            </p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-amber-900">
              {lang === "ar"
                ? "يرجى السماح بالوصول إلى موقعك في المتصفح لتأكيد إمكانية التوصيل."
                : "Please allow location access in your browser to confirm delivery availability."}
            </p>
          </div>
        ) : null}
      </div>


      {/* Street name — autocomplete */}
      <PlacesAutocompleteField
        label={t("street_name")}
        value={form.streetName}
        onChange={(value) => updateField("streetName", value)}
        onBlur={() => markFieldTouched("streetName")}
        onSuggestionSelect={(s) => {
          if (s.street)      updateField("streetName",    s.street);
          if (s.houseNumber) updateField("buildingNumber", s.houseNumber);
        }}
        placeholder={lang === "ar" ? "مثال: شارع النصر" : "e.g. El-Nasr Street"}
        error={displayErrors.streetName}
        lang={lang}
      />

      {/* Building / Floor / Apartment */}
      <Field
        icon={Building2}
        label={lang === "ar" ? "العمارة" : "Building"}
        value={form.buildingNumber}
        onChange={(value) => updateField("buildingNumber", value)}
        onBlur={() => markFieldTouched("buildingNumber")}
        placeholder={lang === "ar" ? "رقم العمارة" : "Building number"}
        dir="ltr"
        error={displayErrors.buildingNumber}
      />
      <Field
        icon={Building2}
        label={`${lang === "ar" ? "الدور" : "Floor"} ${lang === "ar" ? "(اختياري)" : "(optional)"}`}
        value={form.floor}
        onChange={(value) => updateField("floor", value)}
        onBlur={() => markFieldTouched("floor")}
        placeholder={lang === "ar" ? "مثال: 3" : "e.g. 3"}
        dir="ltr"
        error={displayErrors.floor}
      />
      <Field
        icon={Building2}
        label={lang === "ar" ? "الشقة" : "Apartment"}
        value={form.apartmentNumber}
        onChange={(value) => updateField("apartmentNumber", value)}
        onBlur={() => markFieldTouched("apartmentNumber")}
        placeholder={lang === "ar" ? "رقم الشقة" : "Apartment number"}
        dir="ltr"
        error={displayErrors.apartmentNumber}
      />
    </div>
  );

  const notesField = (
    <div className="mt-4">
      <label className="mb-2 block text-sm font-black text-slate-700">
        {lang === "ar" ? "ملاحظات" : "Notes"}{" "}
        <span className="font-semibold text-slate-400">
          {lang === "ar" ? "(اختياري)" : "(Optional)"}
        </span>
      </label>
      <textarea
        rows={3}
        value={form.note}
        onChange={(event) => updateField("note", event.target.value)}
        placeholder={t("order_note_placeholder")}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
      />
    </div>
  );

  // ─── Order placed confirmation ────────────────────────────────────────────

  if (placedOrderId) {
    if (isShopperShell) {
      return (
        <div className="checkout-page bg-[#F5FDFC]">
          <ShopperPage docked={false} className="py-6">
            <ShopperSurface className="overflow-hidden border-slate-200 bg-[linear-gradient(145deg,#ffffff_0%,#f8fbfb_62%,#eff6f7_100%)] p-6 text-center">
              <div className="relative mx-auto mb-6 h-24 w-24">
                <div className="absolute inset-0 animate-ping rounded-full bg-slate-500/15" />
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_22px_46px_rgba(15,23,42,0.18)]">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {lang === "ar" ? "تم الاستلام" : "Order received"}
              </p>
              <h1 className="mt-2 text-[1.9rem] font-black tracking-tight text-slate-950">
                {t("order_placed")}
              </h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                {lang === "ar"
                  ? "تم استلام طلبك بنجاح، وسيتواصل فريقنا معك قريبًا لتأكيد التوصيل."
                  : "Your order has been received successfully, and our team will contact you shortly to confirm delivery."}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
                <CheckCircle2 className="h-4 w-4" />
                {lang === "ar" ? `رقم الطلب: ${placedOrderId}` : `Order ID: ${placedOrderId}`}
              </div>
              <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4 text-start">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-slate-100 text-slate-700">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{t("estimated_delivery")}</p>
                    <p className="text-sm font-semibold text-slate-500">{getDeliveryWindowSentence(lang)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/orders"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50"
                >
                  <ClipboardList className="h-4 w-4 text-teal-500" />
                  {lang === "ar" ? "طلباتي" : "My orders"}
                </Link>
                <Link
                  to="/products"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.2rem] bg-[var(--primary)] px-5 text-sm font-black text-white"
                >
                  <Package className="h-4 w-4" />
                  {lang === "ar" ? "مواصلة التسوق" : "Continue shopping"}
                </Link>
              </div>
            </ShopperSurface>
          </ShopperPage>
        </div>
      );
    }

    return (
      <div className="checkout-page medical-page medical-shell bg-[#F5FDFC]">
        <div className="page-section py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="relative mx-auto mb-8 h-28 w-28">
              <div className="absolute inset-0 animate-ping rounded-full bg-slate-500/20" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-500 text-white shadow-[0_24px_50px_rgba(44,190,181,0.3)]">
                <CheckCircle2 className="h-14 w-14" />
              </div>
            </div>
            <h1 className="mb-4 text-4xl font-black text-slate-900">{t("order_placed")}</h1>
            <p className="mb-10 text-base font-semibold leading-8 text-slate-500">
              {lang === "ar"
                ? "تم استلام طلبك بنجاح، وسيتواصل فريقنا معك قريبًا لتأكيد التوصيل."
                : "Your order has been received successfully, and we will contact you shortly to confirm delivery."}
            </p>
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600">
              <CheckCircle2 className="h-4 w-4" />
              {lang === "ar" ? `رقم الطلب: ${placedOrderId}` : `Order ID: ${placedOrderId}`}
            </div>
            <div className="card-premium mb-8 p-6">
              <div className="mx-auto flex max-w-md items-center gap-4 text-start">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{t("estimated_delivery")}</p>
                  <p className="text-sm font-semibold text-slate-500">{getDeliveryWindowSentence(lang)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/orders"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50"
                style={{ height: "3.25rem" }}
              >
                <ClipboardList className="h-4 w-4 text-teal-500" />
                {lang === "ar" ? "طلباتي" : "My orders"}
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-8 text-sm font-black text-white transition-colors hover:bg-[var(--primary-strong)]"
                style={{ height: "3.25rem" }}
              >
                <Package className="h-4 w-4" />
                {lang === "ar" ? "مواصلة التسوق" : "Continue shopping"}
                <ArrowRight className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty cart ───────────────────────────────────────────────────────────

  if (cart.length === 0) {
    return (
      <div className="checkout-page medical-page medical-shell bg-[#F5FDFC]">
        <div className="page-section py-16">
          <EmptyState
            icon={Package}
            title={lang === "ar" ? "السلة فارغة" : "Cart is empty"}
            description={
              lang === "ar"
                ? "لا يمكنك إكمال الطلب بدون منتجات. ابدأ بإضافة ما تحتاجه."
                : "You can't checkout without products. Start by adding what you need."
            }
            action={
              <Link
                to="/products"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white transition-colors hover:bg-[var(--primary-strong)]"
              >
                <Package className="h-4 w-4" />
                {t("browse_products")}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // ─── Mobile (ShopperShell) layout ─────────────────────────────────────────

  if (isShopperShell) {
    return (
      <div className="checkout-page bg-[#F5FDFC]">
        <ShopperPage docked={false} className="pb-[11rem] pt-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(145deg,#ffffff_0%,#f8fbfb_62%,#eff6f7_100%)] p-5 shadow-[0_20px_42px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/cart"
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
                >
                  <ArrowLeft className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
                  {lang === "ar" ? "السلة" : "Cart"}
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {lang === "ar" ? "دفع آمن" : "Secure checkout"}
                </div>
              </div>

              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {lang === "ar" ? "إتمام الطلب" : "Checkout"}
              </p>
              <h1 className="mt-2 text-[2rem] font-black leading-[1.02] tracking-tight text-slate-950">
                {lang === "ar" ? "تفاصيل التوصيل" : "Delivery details"}
              </h1>

              <div className="mt-4 flex items-center gap-2 rounded-[1.15rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {lang === "ar" ? "دفع آمن ومشفر 256-bit SSL" : "Secure payment protected with 256-bit SSL encryption"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-lg font-black text-slate-950">{totalItems}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {lang === "ar" ? "القطع" : "Items"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-base font-black text-slate-950">{getDeliveryWindowLabel(lang)}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {lang === "ar" ? "التوصيل" : "Window"}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-base font-black text-slate-950">{dynamicFeeLabel}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {lang === "ar" ? "الرسوم" : "Fee"}
                  </p>
                </div>
              </div>
            </div>

            {/* Step indicators */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { num: 1, labelAr: "التوصيل", labelEn: "Delivery" },
                { num: 2, labelAr: "المراجعة", labelEn: "Review" },
              ].map((item) => {
                const isActive = step === item.num;
                const isDone = step > item.num;
                return (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => {
                      if (item.num === 1 || validateBeforeNextStep()) {
                        setStep(item.num as 1 | 2);
                      }
                    }}
                    className={cn(
                      "rounded-[1.35rem] border px-4 py-4 text-start transition-all",
                      isActive
                        ? "border-slate-900 bg-slate-950 text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)]"
                        : isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-black",
                          isActive
                            ? "bg-white text-slate-950"
                            : isDone
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : item.num}
                      </span>
                      <div>
                        <p className="text-sm font-black">
                          {lang === "ar" ? item.labelAr : item.labelEn}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {deliveryQuote.data?.isDeliverable === false && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
                    <Truck className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-red-700">
                      {lang === "ar" ? "عنوانك خارج نطاق التوصيل" : "Your address is outside our delivery zone"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-red-600">
                      {lang === "ar"
                        ? "للأسف لا نستطيع التوصيل لهذا العنوان حالياً. يرجى اختيار عنوان آخر أو التواصل معنا."
                        : "We cannot deliver to this address currently. Please update your address or contact us."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {submitError ? (
              <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
                {submitError}
              </div>
            ) : null}

            <div className="space-y-4">
              {step === 1 ? (
                <ShopperSurface className="overflow-hidden p-5">
                  <SectionIntro
                    spacing="compact"
                    eyebrow={
                      <span className="badge-teal">
                        <MapPin className="h-4 w-4" />
                        {t("shipping_address")}
                      </span>
                    }
                    title={lang === "ar" ? "بيانات التوصيل" : "Delivery details"}
                  />

                  <div className="mb-5 grid gap-3 sm:grid-cols-3">
                    {checkoutSignals.map(({ Icon, title, value }) => (
                      <div key={title} className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {addressFields}
                  {notesField}
                </ShopperSurface>
              ) : (
                <>
                  <ShopperSurface className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {lang === "ar" ? "المراجعة" : "Review"}
                        </p>
                        <h2 className="mt-2 text-[1.35rem] font-black text-slate-950">
                          {lang === "ar" ? "تأكيد بيانات الطلب" : "Confirm order details"}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
                      >
                        <ArrowLeft className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
                        {lang === "ar" ? "تعديل" : "Edit"}
                      </button>
                    </div>

                    <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{form.fullName.trim()}</p>
                          <p className="text-sm font-semibold text-slate-500" dir="ltr">{form.phone.trim()}</p>
                          <p className="text-sm font-semibold text-slate-500">{address}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {reviewPanels.map(({ Icon, title, value }) => (
                        <div key={title} className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600">
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
                          <p className="mt-1 text-sm font-black leading-6 text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </ShopperSurface>

                  <ShopperSurface className="p-5">
                    <SectionIntro
                      spacing="compact"
                      eyebrow={
                        <span className="badge-teal">
                          <CreditCard className="h-4 w-4" />
                          {t("payment_method")}
                        </span>
                      }
                      title={lang === "ar" ? "طريقة الدفع" : "Payment method"}
                    />
                    {paymentMethodPanel}
                    {manualPaymentUploadPanel}
                  </ShopperSurface>
                </>
              )}

              {checkoutSummary}
            </div>
          </div>
        </ShopperPage>

        {/* Fixed bottom CTA */}
        <div className="fixed inset-x-0 bottom-0 z-50 bg-[linear-gradient(180deg,rgba(245,252,252,0)_0%,rgba(245,252,252,0.92)_24%,rgba(245,252,252,0.98)_100%)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] pt-6">
          <div className="mx-auto max-w-3xl rounded-[1.6rem] border border-slate-200 bg-white p-3 shadow-[0_26px_54px_rgba(15,23,42,0.14)]">
            <div className="flex items-center justify-between gap-3 px-2 pb-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {lang === "ar" ? "الإجمالي" : "Total"}
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {pricing.total.toFixed(2)} {t("currency")}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {lang === "ar" ? `${totalItems} قطعة` : `${totalItems} items`}
              </p>
            </div>
            <button
              type="button"
              onClick={
                step === 1
                  ? () => { if (validateBeforeNextStep()) setStep(2); }
                  : handlePlaceOrder
              }
              disabled={isSubmitting || uploadingReceipt}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[#2563eb] text-sm font-black text-white shadow-[0_18px_34px_rgba(37,99,235,0.24)] disabled:opacity-60"
            >
              {step === 1 ? (
                <>
                  {lang === "ar" ? "التالي: مراجعة الطلب" : "Next: Review order"}
                  <ArrowRight className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
                </>
              ) : isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  {lang === "ar" ? "جارٍ إرسال الطلب..." : "Submitting order..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t("confirm_order")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Desktop layout ───────────────────────────────────────────────────────

  return (
    <div className="checkout-page medical-page medical-shell bg-[#F5FDFC]">
      <PageHero
        lang={lang}
        crumbs={[
          { label: t("home"), to: "/" },
          { label: t("cart_title"), to: "/cart" },
          { label: t("checkout_title") },
        ]}
        eyebrow={
          <span className="badge-teal border-0 bg-slate-500/10 text-teal-200">
            <ShieldCheck className="h-4 w-4" />
            {lang === "ar" ? "إتمام طلب آمن" : "Secure checkout"}
          </span>
        }
        title={t("checkout_title")}
        stats={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-lg font-black text-slate-950">{totalItems}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "ar" ? "إجمالي القطع" : "Total items"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-lg font-black text-slate-950">{getDeliveryWindowLabel(lang)}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "ar" ? "وقت التوصيل" : "Delivery window"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-lg font-black text-slate-950">{dynamicFeeLabel}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "ar" ? "رسوم التوصيل" : "Delivery fee"}
              </p>
            </div>
          </div>
        }
      />

      <div className="page-section py-10 md:py-14">
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            {/* Step tabs */}
            <div className="card-premium p-4">
              <div className="flex gap-3">
                {[
                  { num: 1, labelAr: "التوصيل", labelEn: "Delivery" },
                  { num: 2, labelAr: "المراجعة", labelEn: "Review" },
                ].map((item) => {
                  const isActive = step === item.num;
                  const isDone = step > item.num;
                  return (
                    <button
                      key={item.num}
                      type="button"
                      onClick={() => {
                        if (item.num === 1 || validateBeforeNextStep()) {
                          setStep(item.num as 1 | 2);
                        }
                      }}
                      className={cn(
                        "inline-flex h-11 flex-1 items-center justify-center gap-3 rounded-2xl border px-4 text-sm font-black transition-all",
                        isActive
                          ? "border-teal-300 bg-slate-50 text-slate-700"
                          : isDone
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-black",
                          isActive
                            ? "bg-[var(--primary)] text-white"
                            : isDone
                              ? "bg-emerald-600 text-white"
                              : "border border-slate-200 bg-white text-slate-400",
                        )}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : item.num}
                      </span>
                      {lang === "ar" ? item.labelAr : item.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
                {submitError}
              </div>
            ) : null}

            <div className="card-premium p-6 md:p-8">
              <SectionIntro
                spacing="compact"
                eyebrow={
                  <span className="badge-teal">
                    <MapPin className="h-4 w-4" />
                    {step === 1 ? t("shipping_address") : t("payment_method")}
                  </span>
                }
                title={
                  step === 1
                    ? lang === "ar" ? "بيانات التوصيل" : "Delivery details"
                    : lang === "ar" ? "مراجعة الطلب والدفع" : "Review and payment"
                }
              />

              {step === 1 ? (
                <>
                  <div className="mb-5 grid gap-3 md:grid-cols-3">
                    {checkoutSignals.map(({ Icon, title, value }) => (
                      <div key={title} className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {addressFields}
                  {notesField}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => { if (validateBeforeNextStep()) setStep(2); }}
                      className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-8 text-sm font-black text-white transition-colors hover:bg-[var(--primary-strong)]"
                      style={{ height: "3.25rem" }}
                    >
                      {lang === "ar" ? "التالي: مراجعة الطلب" : "Next: Review order"}
                      <ArrowRight className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{form.fullName.trim()}</p>
                        <p className="text-sm font-semibold text-slate-500" dir="ltr">{form.phone.trim()}</p>
                        <p className="text-sm font-semibold text-slate-500">{address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {reviewPanels.map(({ Icon, title, value }) => (
                      <div key={title} className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">{paymentMethodPanel}</div>
                  {manualPaymentUploadPanel}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700"
                    >
                      {lang === "ar" ? "تعديل البيانات" : "Edit details"}
                    </button>
                    <button
                      type="button"
                      onClick={handlePlaceOrder}
                      disabled={isSubmitting || uploadingReceipt || deliveryQuote.data?.isDeliverable === false}
                      className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-8 text-sm font-black text-white transition-colors hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ height: "3.25rem" }}
                    >
                      {deliveryQuote.data?.isDeliverable === false ? (
                        <>
                          <X className="h-4 w-4" />
                          {lang === "ar" ? "خارج نطاق التوصيل" : "Outside delivery zone"}
                        </>
                      ) : isSubmitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                          {lang === "ar" ? "جارٍ إرسال الطلب..." : "Submitting order..."}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          {t("confirm_order")}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="checkout-summary">
            <div className="xl:sticky xl:top-28">{checkoutSummary}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
