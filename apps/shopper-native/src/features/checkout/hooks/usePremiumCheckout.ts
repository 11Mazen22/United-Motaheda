import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCartStore, selectPricing } from "@/stores/cart";
import { useAddressStore } from "@/features/addresses";
import { useAuth } from "@/features/auth";
import { usePrescriptions } from "@/features/prescriptions/hooks/usePrescriptions";
import { fetchProductById } from "@/features/products/api/productsApi";
import { fetchPrescriptionRequiredProductIds } from "../prescriptionGate";
import { useDeliveryQuote } from "@/features/delivery/useDeliveryQuote";
import {
  createCheckoutOrder,
  buildCheckoutNote,
  createIdempotencyKey,
  CheckoutRequestError,
  isManualWalletPayment,
  patchOrderManualPayment,
  type CheckoutPaymentMethod
} from "@/features/checkout";
import { paymentLabel } from "../constants";
import { pickPaymentReceiptImage, uploadPaymentReceipt, ReceiptUploadError } from "@/features/payment";
import { useNetInfo } from "@react-native-community/netinfo";

export interface PlacedOrderSummary {
  orderId: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  addressFormatted: string;
  paymentLabel: string;
}

export type CheckoutStatus =
  | "LOADING"
  | "READY"
  | "AUTH_REQUIRED"
  | "ADDRESS_REQUIRED"
  | "ADDRESS_INVALID"
  | "DELIVERY_UNAVAILABLE"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_INVALID"
  | "PRICING_CHANGED"
  | "INVENTORY_CHANGED"
  | "SUBMITTING"
  | "SUCCESS"
  | "FAILED"
  | "OFFLINE";

export function usePremiumCheckout() {
  const { t, i18n } = useTranslation();
  const lang: "ar" | "en" = i18n.language === "en" ? "en" : "ar";
  const [status, setStatus] = useState<CheckoutStatus>("LOADING");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("cod");
  const promoCode = useCartStore(s => s.promoCode);
  const setPromoCode = useCartStore(s => s.setPromoCode);
  const [note, setNote] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [placedOrderSummary, setPlacedOrderSummary] = useState<PlacedOrderSummary | null>(null);
  const [rxRequiredProductIds, setRxRequiredProductIds] = useState<Set<string>>(new Set());
  const [selectedPrescriptionIds, setSelectedPrescriptionIds] = useState<string[]>([]);
  const allPrescriptions = usePrescriptions();
  const [transferNumber, setTransferNumber] = useState("");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [manualPaymentError, setManualPaymentError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Idempotency key must be preserved across retries
  const idempotencyKeyRef = useRef<string | null>(null);
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = createIdempotencyKey();
  }

  const items = useCartStore(s => s.items);
  const pricing = useCartStore(selectPricing);
  const clearCart = useCartStore(s => s.clearCart);
  
  const { user } = useAuth();
  const addresses = useAddressStore(s => s.addresses);
  const fetchAddresses = useAddressStore(s => s.fetch);
  const { isConnected } = useNetInfo();

  // 1. Initial Data Fetch & Revalidation
  useEffect(() => {
    // An order was just placed: submit() clears the cart, which changes
    // `items`/`items.length` below and would otherwise re-run this whole
    // effect — ending on its unconditional setStatus("READY") and
    // stomping "SUCCESS" back to "READY" within the same tick, so the
    // success screen never stayed visible. Once we've reached a terminal
    // post-submit state there's nothing left to (re)validate.
    if (status === "SUCCESS" || status === "SUBMITTING" || status === "FAILED") return;

    let active = true;
    const init = async () => {
      if (!user) {
        setStatus("AUTH_REQUIRED");
        return;
      }
      if (isConnected === false) {
        setStatus("OFFLINE");
        return;
      }

      // Fetch fresh addresses
      await fetchAddresses(user.id);
      if (!active) return;

      // Revalidate cart items (Pricing & Inventory Checks)
      try {
        const freshProducts = await Promise.all(items.map(i => fetchProductById(i.productId)));
        for (let i = 0; i < items.length; i++) {
          const fresh = freshProducts[i];
          const item = items[i];
          if (!fresh || !fresh.inStock || fresh.stock < item.quantity) {
            setStatus("INVENTORY_CHANGED");
            return;
          }
          if (fresh.price !== item.product.price) {
            setStatus("PRICING_CHANGED");
            return;
          }
        }
      } catch {
         // Silently allow checkout if backend product fetch fails temporarily,
         // but ideally we should flag it. We'll proceed so we don't hard-block
         // legitimate orders on transient errors.
      }

      const rxIds = await fetchPrescriptionRequiredProductIds(items.map((i) => i.productId));
      if (active) setRxRequiredProductIds(rxIds);

      // Only auto-select when there's a real, explicit default, or exactly one
      // address to begin with (an unambiguous choice either way). With 2+
      // addresses and none marked default, this used to fall back to
      // addresses[0] -- which, since fetchAddresses() orders by
      // updated_at DESC, silently picked whichever address was saved most
      // recently. That has nothing to do with which one is actually
      // deliverable: confirmed live, a customer's most-recent address had a
      // bad geocode (a vague "district + city" query with no street matched
      // ~30km off), so checkout opened already pointed at an undeliverable
      // address before they had touched anything -- correctly SELECTED per
      // this logic, but never a choice the customer actually made. Leaving
      // selectedAddressId null here instead makes them pick consciously.
      const addresses = useAddressStore.getState().addresses;
      const defaultAddr = addresses.find(a => a.is_default)
        ?? (addresses.length === 1 ? addresses[0] : undefined);
      if (defaultAddr && !selectedAddressId) {
        setSelectedAddressId(defaultAddr.id);
      }
      
      setStatus("READY");
    };
    
    init();
    return () => { active = false; };
  }, [user, isConnected, items.length, items, fetchAddresses, selectedAddressId, status]);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || null;

  // 2. Delivery Zone Validation (using exact web logic parity)
  const quote = useDeliveryQuote({
    subtotal: pricing.subtotal,
    customerCoords: selectedAddress?.lat && selectedAddress?.lng ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null,
    address: selectedAddress ? { city: selectedAddress.city, streetName: selectedAddress.street } : undefined,
  });
  
  const isAddressValid = quote.isDeliverable;

  const rxRequiredItems = items.filter((i) => rxRequiredProductIds.has(i.productId));
  const needsPrescription = rxRequiredItems.length > 0;
  const approvedPrescriptions = allPrescriptions.filter((p) => p.reviewStatus === "approved");
  const hasPrescriptionSelected = selectedPrescriptionIds.length > 0;

  const canSubmit = status === "READY" && selectedAddress && isAddressValid && paymentMethod && items.length > 0
    && (!needsPrescription || hasPrescriptionSelected);

  const handlePickReceipt = useCallback(async () => {
    const picked = await pickPaymentReceiptImage();
    if (picked.ok) {
      setReceiptUri(picked.localUri);
      setManualPaymentError(null);
    }
  }, []);

  const submit = useCallback(async () => {
     if (!canSubmit) return;
     if (!user) return;

     const manual = isManualWalletPayment(paymentMethod);
     let paymentProofUrl: string | undefined;

     if (manual) {
       if (!transferNumber.trim()) {
         setManualPaymentError(t("checkout.missingTransferNumber"));
         return;
       }
       if (!receiptUri) {
         setManualPaymentError(t("checkout.missingReceipt"));
         return;
       }
       setUploadingReceipt(true);
       try {
         paymentProofUrl = await uploadPaymentReceipt(user.id, receiptUri);
       } catch (err) {
         setManualPaymentError(err instanceof ReceiptUploadError ? err.message : t("checkout.uploadReceiptError"));
         setUploadingReceipt(false);
         return;
       }
       setUploadingReceipt(false);
       setManualPaymentError(null);
     }

     setStatus("SUBMITTING");
     setErrorMsg(null);
     try {
       if (items.length === 0) throw new Error("empty_cart");

       // Build the snapshot
       const floorLine = selectedAddress.floor ? `Floor ${selectedAddress.floor}` : null;
       const apartmentLine = selectedAddress.apartment ? `Apt ${selectedAddress.apartment}` : null;
       const buildingLine = selectedAddress.building ? `Building ${selectedAddress.building}` : null;

       const streetParts = [selectedAddress.street, buildingLine, floorLine, apartmentLine].filter(Boolean);
       const streetLine = streetParts.join(", ");
       const formatted = [streetLine, selectedAddress.city].filter(Boolean).join(", ");

       const addressSnapshot = {
         formatted,
         city: selectedAddress.city,
         streetLine,
         buildingNumber: selectedAddress.building || undefined,
         floor: selectedAddress.floor || undefined,
         apartmentNumber: selectedAddress.apartment || undefined,
         landmark: selectedAddress.landmark || undefined,
         deliveryInstructions: selectedAddress.delivery_instructions || undefined,
         locationSource: selectedAddress.location_source,
         locationAccuracyM: selectedAddress.location_accuracy_m,
         lat: selectedAddress.lat,
         lng: selectedAddress.lng,
       };

       const noteStr = buildCheckoutNote({
         note,
         paymentLabel: paymentLabel(paymentMethod),
         paymentMethod,
         requestPosMachine: false,
         lang: "en",
       });

       const command = {
         idempotencyKey: idempotencyKeyRef.current!,
         customer: {
           userId: user.id,
           email: user.email,
           fullName: selectedAddress.recipient_name || user.name || "",
           phone: selectedAddress.phone || "",
         },
         address: addressSnapshot,
         payment: {
           method: paymentMethod,
           label: paymentLabel(paymentMethod),
           requestPosMachine: false,
           transferNumber: manual ? transferNumber.trim() : undefined,
           paymentProofUrl: manual ? paymentProofUrl : undefined,
         },
         promoCode: promoCode || undefined,
         note: noteStr,
         expectedPricing: pricing,
         cartLines: items.map(i => ({
           productId: i.productId,
           quantity: i.quantity,
           unitPrice: i.product.price,
           name: i.product.nameEn || i.product.nameAr || i.product.name || "Product",
         })),
         prescriptionIds: needsPrescription ? selectedPrescriptionIds : undefined,
       };

       const result = await createCheckoutOrder(command, lang);

       if (manual && paymentProofUrl && (paymentMethod === "vodafone" || paymentMethod === "instapay")) {
         const needsPatch = result.status !== "payment_pending" || result.paymentStatus !== "pending_verification";
         if (needsPatch) {
           await patchOrderManualPayment(
             result.orderId,
             { transferNumber: transferNumber.trim(), paymentProofUrl },
             paymentMethod,
           );
         }
       }

       // Snapshot everything the success screen shows BEFORE clearCart() —
       // pricing/items/address are all live-reactive selectors, so once the
       // cart is wiped, "the total" silently becomes just the leftover
       // shippingFee (subtotal collapses to 0) and item lines vanish
       // entirely. Confirmed live: a real 200 EGP + 15 EGP shipping order
       // showed "15.00" as the total on the success screen because the
       // cart had already been cleared by the time it rendered.
       setPlacedOrderSummary({
         orderId: result.orderId,
         createdAt: result.createdAt,
         items: items.map((i) => ({
           name: i.product.nameAr || i.product.nameEn || i.product.name || "Product",
           quantity: i.quantity,
           unitPrice: i.product.price,
         })),
         subtotal: pricing.subtotal,
         shipping: pricing.shipping,
         discount: pricing.discount,
         total: pricing.total,
         addressFormatted: formatted,
         paymentLabel: paymentLabel(paymentMethod),
       });
       setPlacedOrderId(result.orderId);
       clearCart(); // Safely wipe cart ONLY on success
       setStatus("SUCCESS");
       } catch (e) {
        setStatus("FAILED");
        setErrorMsg(e instanceof CheckoutRequestError ? e.message : t("checkout.submitError"));
      }
  }, [canSubmit, user, selectedAddress, paymentMethod, items, pricing, note, promoCode, clearCart, needsPrescription, selectedPrescriptionIds, transferNumber, receiptUri, t, lang]);

  return {
    status,
    setStatus,
    addresses,
    selectedAddress,
    setSelectedAddressId,
    isAddressValid,
    paymentMethod,
    setPaymentMethod,
    transferNumber,
    setTransferNumber,
    receiptUri,
    handlePickReceipt,
    manualPaymentError,
    uploadingReceipt,
    note,
    setNote,
    promoCode,
    setPromoCode,
    submit,
    items,
    pricing,
    errorMsg,
    placedOrderId,
    placedOrderSummary,
    needsPrescription,
    rxRequiredItems,
    approvedPrescriptions,
    selectedPrescriptionIds,
    setSelectedPrescriptionIds,
  };
}
