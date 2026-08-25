import React from "react";
import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/features/auth";
import { useDriverRealtimeSync, useMyDriverProfile } from "@/features/driver";

const LIVE_DRIVER_STATUSES = new Set(["APPROVED", "ACTIVE"]);

/**
 * Defense-in-depth: app/index.tsx already routes drivers here and everyone
 * else to (tabs), but that's a one-time decision at launch. If a non-driver
 * session somehow lands on a (driver) route directly (a stale deep link, a
 * role change mid-session, manual URL entry on web), bounce them out rather
 * than trust the entry redirect alone.
 *
 * profiles.role === 'driver' alone is not sufficient: an admin can still
 * flip that role directly via shopper-web's UsersManager.tsx with zero
 * vetting (a known, currently-unclosed gap on that side). The real gate is
 * DriverProfile.status — role only ever becomes 'driver' for real once
 * (on first approval, see admin-operations.service.ts's approveDriver),
 * but checking status too means a raw role flip with no approved
 * DriverProfile still can't reach these screens.
 */
export default function DriverLayout() {
  const { user, loading } = useAuth();
  const isDriverRole = user?.role === "driver";
  const profileQuery = useMyDriverProfile(isDriverRole ? user?.id : undefined);
  // Mounted once for the whole driver section, mirroring how
  // useNotificationSync is mounted once at the app root — one realtime
  // channel pair for the lifetime of the driver session, not per-screen.
  useDriverRealtimeSync(isDriverRole ? user.id : undefined);

  if (loading || (isDriverRole && profileQuery.isLoading)) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  const hasLiveDriverProfile = Boolean(profileQuery.data && LIVE_DRIVER_STATUSES.has(profileQuery.data.status));

  if (!user || !isDriverRole || !hasLiveDriverProfile) {
    return <Redirect href={"/(tabs)" as never} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="offer/[assignmentId]" />
      <Stack.Screen name="delivery/[orderId]" />
      <Stack.Screen name="issue/[orderId]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="driver-notifications" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
