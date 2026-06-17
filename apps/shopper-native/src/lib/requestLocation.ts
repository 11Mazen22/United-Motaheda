/**
 * requestAndStoreLocation — ask for GPS and store coordinates.
 *
 * Uses the standard Web Geolocation API (navigator.geolocation) which
 * works on both web browsers and React Native / Expo without requiring
 * any extra package. Called once after login/register so the delivery
 * context has real coordinates from the first cart session.
 */

import { useLocationStore } from "@/features/delivery/locationStore";

export function requestAndStoreLocation(): void {
  // Geolocation API is only available on web and in some React Native environments
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (!nav || !(nav as any).geolocation) return;

  (nav as any).geolocation.getCurrentPosition(
    (position: any) => {
      useLocationStore.getState().setCoordinates({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      useLocationStore.getState().setPermission("granted");
    },
    () => {
      useLocationStore.getState().setPermission("denied");
    },
    {
      enableHighAccuracy: true,
      timeout:            8_000,
      maximumAge:         60_000,
    },
  );
}
