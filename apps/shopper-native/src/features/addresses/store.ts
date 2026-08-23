import { create } from "zustand";
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "./api";
import { geocodeAddress } from "@/lib/geocoding";
import type { Address, AddressFormData } from "./types";

export type { AddressFormData } from "./types";

interface AddressState {
  addresses: Address[];
  loading: boolean;
  error: string | null;
  /** Cached userId — set on first fetch, used for revert operations. */
  _userId: string | null;

  fetch: (userId: string) => Promise<void>;
  add: (userId: string, form: AddressFormData) => Promise<Address>;
  update: (id: string, userId: string, form: Partial<AddressFormData>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string, userId: string) => Promise<void>;
  reset: () => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  loading: false,
  error: null,
  _userId: null,

  fetch: async (userId) => {
    set({ loading: true, error: null, _userId: userId });
    try {
      const addresses = await fetchAddresses(userId);
      set({ addresses, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  add: async (userId, form) => {
    // ── Duplicate detection ───────────────────────────────────────────────
    // Prevent storing the same address twice. Match on the normalized
    // combination of (label + street + building + district + city).
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const isDuplicate = get().addresses.some((existing) =>
      normalize(existing.label)    === normalize(form.label)    &&
      normalize(existing.street)   === normalize(form.street)   &&
      normalize(existing.building) === normalize(form.building) &&
      normalize(existing.district) === normalize(form.district) &&
      normalize(existing.city)     === normalize(form.city),
    );
    if (isDuplicate) {
      throw new Error("duplicate_address");
    }

    // Optimistic: if setting as default, unset others locally
    if (form.is_default) {
      set((s) => ({
        addresses: s.addresses.map((a) => ({ ...a, is_default: false })),
      }));
    }

    // Geocode the address to get coordinates for delivery zone lookup
    const coords = await geocodeAddress({
      street:   form.street,
      building: form.building,
      district: form.district,
      city:     form.city,
    });

    const formWithCoords: AddressFormData = {
      ...form,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    };

    const created = await createAddress(userId, formWithCoords);
    set((s) => ({ addresses: [created, ...s.addresses] }));
    return created;
  },

  update: async (id, userId, form) => {
    // Snapshot for revert
    const prev = get().addresses;

    // Optimistic update
    set((s) => ({
      _userId: userId,
      addresses: s.addresses.map((a) => {
        if (a.id === id) return { ...a, ...form };
        if (form.is_default) return { ...a, is_default: false };
        return a;
      }),
    }));
    try {
      // Re-geocode if any address fields changed
      const addressFields: (keyof AddressFormData)[] = ["street", "building", "district", "city"];
      const hasAddressChange = addressFields.some((k) => k in form);
      let formWithCoords = form;
      if (hasAddressChange && form.street && form.district && form.city) {
        const coords = await geocodeAddress({
          street:   form.street,
          building: form.building ?? "",
          district: form.district,
          city:     form.city,
        });
        if (coords) {
          formWithCoords = { ...form, lat: coords.lat, lng: coords.lng };
        }
      }
      await updateAddress(id, userId, formWithCoords);
    } catch {
      // Revert to snapshot on failure
      set({ addresses: prev });
    }
  },

  remove: async (id) => {
    const prev = get().addresses;
    set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) }));
    try {
      const userId = get()._userId;
      if (!userId) throw new Error("user_required");
      await deleteAddress(id, userId);
    } catch {
      set({ addresses: prev });
    }
  },

  setDefault: async (id, userId) => {
    set((s) => ({
      _userId: userId,
      addresses: s.addresses.map((a) => ({
        ...a,
        is_default: a.id === id,
      })),
    }));
    try {
      await setDefaultAddress(id, userId);
    } catch {
      // Revert using cached userId
      const cachedUserId = get()._userId;
      if (cachedUserId) {
        const addresses = await fetchAddresses(cachedUserId).catch(() => null);
        if (addresses) set({ addresses });
      }
    }
  },

  reset: () => set({ addresses: [], loading: false, error: null, _userId: null }),
}));

export const selectDefaultAddress = (s: AddressState) =>
  s.addresses.find((a) => a.is_default) ?? null;
