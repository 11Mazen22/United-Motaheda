/**
 * wipeUserData() — full sign-out scrub.
 *
 * Called from AuthProvider.signOut after `supabase.auth.signOut()` resolves.
 * Resets every in-memory store that holds user-specific state AND removes
 * every persisted AsyncStorage key, so the next account that signs in on
 * this device sees a clean slate.
 *
 * NOT touched: `united-lang-v1` (locale, not user-specific) and
 * `um_onboarding_v1` (onboarding seen-flag, not user-specific).
 * `united-auth-v1` is owned by Supabase's own client and cleared by
 * `supabase.auth.signOut()`.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { useOrderStore } from "@/stores/orders";
import { usePrescriptionsStore } from "@/stores/prescriptionsStore";
import { useHealthProfileStore } from "@/stores/healthProfileStore";
import { useAddressStore } from "@/features/addresses/store";
import { usePaymentStore } from "@/features/payment/store";

/** Every AsyncStorage key that holds user data. Order doesn't matter. */
const USER_STORAGE_KEYS: readonly string[] = [
  "united-cart-v1",         // cart
  "united-wishlist-v1",     // wishlist (storage.ts key)
  "um_wishlist_v1",         // wishlist (legacy key, still written)
  "um_orders_v1",           // orders
  "up.prescriptions",       // prescriptions (zustand persist middleware)
  "up.healthProfile",       // healthProfile (zustand persist middleware)
  "united-payment-v1",      // payment method selection
  "united-addresses-v1",    // address cache
];

export async function wipeUserData(): Promise<void> {
  // 1. Reset every in-memory Zustand store (fires UI updates immediately).
  useCartStore.getState().clearCart();
  useWishlistStore.getState().clear();
  useOrderStore.getState().clearOrders();
  usePrescriptionsStore.getState().reset();
  useHealthProfileStore.getState().reset();
  useAddressStore.getState().reset();
  usePaymentStore.getState().reset();

  // 2. Clear persist-middleware caches (prescriptions + healthProfile use
  //    zustand/middleware persist; the in-memory reset above only resets
  //    the live state object — the rehydrate-on-launch payload lives in
  //    AsyncStorage and must be wiped explicitly).
  const persistClears: Array<Promise<void> | undefined> = [
    usePrescriptionsStore.persist?.clearStorage() as Promise<void> | undefined,
    useHealthProfileStore.persist?.clearStorage() as Promise<void> | undefined,
  ];
  await Promise.all(persistClears.filter((p): p is Promise<void> => p != null));

  // 3. Belt-and-suspenders: directly remove every known storage key in case
  //    a mutation slipped through between steps 1 and 2.
  try {
    await AsyncStorage.multiRemove(Array.from(USER_STORAGE_KEYS));
  } catch (e) {
    if (__DEV__) console.warn("[wipeUserData] multiRemove failed:", e);
  }
}
