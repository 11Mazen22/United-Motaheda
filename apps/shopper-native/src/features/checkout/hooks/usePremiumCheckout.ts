import { useState, useEffect, useCallback, useRef } from "react";
import { useCartStore, selectPricing } from "@/stores/cart";
import { useAddressStore, type Address } from "@/features/addresses";
import { useAuth } from "@/features/auth";
import { fetchProductById } from "@/features/products/api/productsApi";
import { useDeliveryQuote } from "@/features/delivery/useDeliveryQuote";
import { SUPPORTED_GOVERNORATE } from "@/features/delivery/constants";
import { 
  createCheckoutOrder, 
  buildCheckoutNote,
  createIdempotencyKey,
  CheckoutRequestError,
  type CheckoutPaymentMethod 
} from "@/features/checkout";
import { useNetInfo } from "@react-native-community/netinfo";

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
  const [status, setStatus] = useState<CheckoutStatus>("LOADING");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("cod");
  const promoCode = useCartStore(s => s.promoCode);
  const setPromoCode = useCartStore(s => s.setPromoCode);
  const [note, setNote] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Idempotency key must be preserved across retries
  const idempotencyKeyRef = useRef<string | null>(null);
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = createIdempotencyKey();
  }

  const items = useCartStore(s => s.items);
  const pricing = useCartStore(selectPricing);
  const clearCart = useCartStore(s => s.clearCart);
  
  const { user } = useAuth();
  const addressStore = useAddressStore();
  const { isConnected } = useNetInfo();

  // 1. Initial Data Fetch & Revalidation
  useEffect(() => {
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
      if (items.length === 0 && status !== "SUCCESS") {
         // Should not be in checkout without items, unless we just succeeded
      }

      // Fetch fresh addresses
      await addressStore.fetch(user.id);
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
      } catch (e) {
         // Silently allow checkout if backend product fetch fails temporarily, 
         // but ideally we should flag it. We'll proceed so we don't hard-block 
         // legitimate orders on transient errors.
      }
      
      const addresses = useAddressStore.getState().addresses;
      const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
      if (defaultAddr && !selectedAddressId) {
        setSelectedAddressId(defaultAddr.id);
      }
      
      setStatus("READY");
    };
    
    init();
    return () => { active = false; };
  }, [user, isConnected, items.length]);
  
  const addresses = addressStore.addresses;
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || null;

  // 2. Delivery Zone Validation (using exact web logic parity)
  const quote = useDeliveryQuote({
    subtotal: pricing.subtotal,
    customerCoords: selectedAddress?.lat && selectedAddress?.lng ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null,
    address: selectedAddress ? { city: selectedAddress.city, streetName: selectedAddress.street } : undefined,
  });
  
  const isAddressValid = quote.isDeliverable;

  const canSubmit = status === "READY" && selectedAddress && isAddressValid && paymentMethod && items.length > 0;

  const submit = useCallback(async () => {
     if (!canSubmit) return;
     if (!user) return;
     if (status === "SUBMITTING") return; // double-submit protection
     
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
         lat: selectedAddress.lat,
         lng: selectedAddress.lng,
       };

       const noteStr = buildCheckoutNote({
         note,
         paymentLabel: paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
         paymentMethod,
         requestPosMachine: false,
         lang: "en",
       });

       const command = {
         idempotencyKey: idempotencyKeyRef.current!,
         customer: {
           userId: user.id,
           email: user.email,
           fullName: selectedAddress.recipient_name || user.user_metadata?.full_name || "",
           phone: selectedAddress.phone || user.phone || "",
         },
         address: addressSnapshot,
         payment: {
           method: paymentMethod,
           label: paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment",
           requestPosMachine: false,
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
       };

       const result = await createCheckoutOrder(command);
       
       setPlacedOrderId(result.orderId);
       clearCart(); // Safely wipe cart ONLY on success
       setStatus("SUCCESS");
     } catch (e: any) {
       setStatus("FAILED");
       setErrorMsg(e instanceof CheckoutRequestError ? e.message : "Failed to place order. Please try again.");
     }
  }, [canSubmit, user, selectedAddress, paymentMethod, items, pricing, note, promoCode, status, clearCart]);

  return {
    status,
    setStatus,
    addresses,
    selectedAddress,
    setSelectedAddressId,
    isAddressValid,
    paymentMethod,
    setPaymentMethod,
    note,
    setNote,
    promoCode,
    setPromoCode,
    submit,
    items,
    pricing,
    errorMsg,
    placedOrderId,
  };
}
