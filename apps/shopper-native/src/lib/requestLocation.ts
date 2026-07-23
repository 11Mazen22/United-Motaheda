/**
 * requestAndStoreLocation — ask for GPS and store coordinates.
 *
 * Uses Expo Location on native for reliable foreground permission handling
 * and falls back to the browser Geolocation API on web.
 */

import { Platform } from "react-native";
import * as ExpoLocation from "expo-location";
import { useLocationStore } from "@/features/delivery/locationStore";

export async function requestAndStoreLocation(): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (!nav || !(nav as GeolocationNavigator).geolocation) return false;

      return await new Promise<boolean>((resolve) => {
        nav.geolocation.getCurrentPosition(
          (position) => {
            useLocationStore.getState().setCoordinates({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            useLocationStore.getState().setPermission("granted");
            resolve(true);
          },
          () => {
            useLocationStore.getState().setPermission("denied");
            resolve(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 8_000,
            maximumAge: 60_000,
          },
        );
      });
    }

    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      useLocationStore.getState().setPermission("denied");
      return false;
    }

    const position = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });

    useLocationStore.getState().setCoordinates({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
    useLocationStore.getState().setPermission("granted");
    return true;
  } catch {
    useLocationStore.getState().setPermission("denied");
    return false;
  }
}
