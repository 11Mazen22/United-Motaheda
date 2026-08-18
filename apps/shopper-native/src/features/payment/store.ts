/**
 * Payment selection store — `profiles.preferred_payment_method` backed.
 *
 * Anonymous users get the COD default + local-cache fallback. Authed users
 * sync to the profile column so the preference follows them across devices.
 */

import { create } from "zustand";
import { storageGet, storageSet } from "@/utils/storage";
import { fetchPreferredPayment, setPreferredPayment } from "./api";
import type { PaymentMethodType, PaymentState } from "./types";
import { PAYMENT_METHODS } from "./types";

const PAYMENT_STORAGE_KEY = "united-payment-v1";

interface ExtendedState extends PaymentState {
  userId: string | null;
  hydrate: (userId: string | null) => Promise<void>;
}

export const usePaymentStore = create<ExtendedState>((set, get) => ({
  selected: "cod",
  methods: PAYMENT_METHODS,
  loading: false,
  userId:  null,

  setSelected: (type) => {
    set({ selected: type });
    storageSet(PAYMENT_STORAGE_KEY, type);
    const userId = get().userId;
    if (userId) {
      // Fire-and-forget; failure doesn't undo the local change.
      void setPreferredPayment(userId, type).catch((e) => {
        if (__DEV__) console.warn("[payment] setPreferredPayment failed:", e);
      });
    }
  },

  hydrate: async (userId) => {
    if (userId === null) {
      const saved = await storageGet<PaymentMethodType>(PAYMENT_STORAGE_KEY);
      set({ selected: saved ?? "cod", userId: null });
      return;
    }

    set({ userId, loading: true });
    try {
      const server = await fetchPreferredPayment(userId);
      const selected = server ?? "cod";
      set({ selected, loading: false });
      storageSet(PAYMENT_STORAGE_KEY, selected);
    } catch (e) {
      if (__DEV__) console.warn("[payment.hydrate] failed:", e);
      // Fall back to local cache.
      const saved = await storageGet<PaymentMethodType>(PAYMENT_STORAGE_KEY);
      set({ selected: saved ?? "cod", loading: false });
    }
  },

  reset: () => {
    set({ selected: "cod", loading: false, userId: null });
    storageSet(PAYMENT_STORAGE_KEY, "cod" as PaymentMethodType);
  },
}));

export async function hydratePaymentStore(): Promise<void> {
  // Kept for backwards compat with any caller — defaults to anonymous mode.
  await usePaymentStore.getState().hydrate(null);
}
