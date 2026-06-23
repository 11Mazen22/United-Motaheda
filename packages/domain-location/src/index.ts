import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getApiClient } from "@pharmacy/api-client";
import { emitWorkflowEvent, queryKeys } from "@pharmacy/domain-core";
import type { CartSnapshot, Coordinates } from "@pharmacy/types";
import type { DeliveryStatus } from "@pharmacy/contracts";

type LocationState = {
  coordinates: Coordinates | null;
  permission: "idle" | "granted" | "denied";
  selectedArea: string;
  selectedBranchId: string;
  setCoordinates: (coordinates: Coordinates) => void;
  setPermission: (permission: LocationState["permission"]) => void;
  setSelectedArea: (area: string) => void;
  setSelectedBranchId: (branchId: string) => void;
};

const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      coordinates: null,
      permission: "idle",
      selectedArea: "",
      selectedBranchId: "",
      setCoordinates: (coordinates) => set({ coordinates }),
      setPermission: (permission) => set({ permission }),
      setSelectedArea: (selectedArea) => set({ selectedArea }),
      setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),
    }),
    {
      name: "pharmacy-location-v1",
      storage:
        typeof window === "undefined"
          ? undefined
          : createJSONStorage(() => localStorage),
      partialize: (state) => ({
        coordinates: state.coordinates,
        permission: state.permission,
        selectedArea: state.selectedArea,
        selectedBranchId: state.selectedBranchId,
      }),
    },
  ),
);

function buildSignature(
  cart: CartSnapshot,
  coordinates: Coordinates | null,
  label?: string,
  requestedBranchId?: string,
) {
  const itemSignature = cart.items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join("|");

  if (!coordinates) {
    return `no-coordinates:${requestedBranchId ?? ""}:${label ?? ""}:${itemSignature}`;
  }

  // Round to 4 decimal places (~11 m accuracy) so GPS jitter and repeated
  // WiFi triangulation calls don't produce new query keys on every tick.
  const lat = Math.round(coordinates.lat * 10_000) / 10_000;
  const lng = Math.round(coordinates.lng * 10_000) / 10_000;

  return `${lat}:${lng}:${requestedBranchId ?? ""}:${label ?? ""}:${itemSignature}`;
}

export function useLocationState(): LocationState;
export function useLocationState<T>(selector: (state: LocationState) => T): T;
export function useLocationState<T>(selector?: (state: LocationState) => T) {
  return selector ? useLocationStore(selector) : useLocationStore();
}

export function useBrowserLocation(enabled = true) {
  const setCoordinates = useLocationStore((state) => state.setCoordinates);
  const setPermission = useLocationStore((state) => state.setPermission);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setPermission("granted");
        emitWorkflowEvent("LocationResolved", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: "browser",
        });
      },
      () => {
        setPermission("denied");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 20_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, setCoordinates, setPermission]);
}

export function useDeliveryQuote(cart: CartSnapshot, label?: string, requestedBranchId?: string) {
  const coordinates = useLocationStore((state) => state.coordinates);
  const apiClient = useMemo(() => getApiClient(), []);
  const signature = buildSignature(cart, coordinates, label, requestedBranchId);

  const query = useQuery<DeliveryStatus>({
    queryKey: queryKeys.quote(signature),
    enabled: Boolean(coordinates) && cart.itemCount > 0,
    queryFn: async () => {
      const nextQuote = await apiClient.quoteCheckout({
        coordinates: coordinates as Coordinates,
        cart,
        label,
        requestedBranchId,
      });

      emitWorkflowEvent("AssignmentRecomputed", {
        pharmacyId: nextQuote.branch?.id ?? "unknown",
        quoteToken: nextQuote.quoteToken ?? "unknown",
      });
      emitWorkflowEvent("QuoteRefreshed", {
        fee: nextQuote.cost ?? 0,
        quoteToken: nextQuote.quoteToken ?? "unknown",
      });

      return nextQuote;
    },
  });

  return query;
}
