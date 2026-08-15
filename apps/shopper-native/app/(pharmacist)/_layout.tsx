/**
 * Pharmacist Layout — root of the pharmacist experience.
 *
 * Role guard mirrors (driver)/_layout.tsx exactly:
 *   - Non-pharmacist sessions are bounced to /(tabs)
 *   - Mounts usePharmacistRealtimeSync once for the session lifetime so a
 *     single realtime channel pair covers all pharmacist screens
 *   - Stack navigator with the full set of pharmacist routes
 *
 * Routes:
 *   index              — WorkbenchScreen (dashboard + order queue)
 *   order/[id]         — PharmacistOrderDetail
 *   prescriptions      — PrescriptionQueueScreen
 *   prescription/[id]  — PrescriptionDetailScreen
 *   inventory          — InventoryScreen
 *   search             — GlobalSearchScreen
 *   notifications      — NotificationCenterScreen (pharmacist-scoped)
 *   profile            — PharmacistProfileScreen
 */

import React from "react";
import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/features/auth";
import { usePharmacistRealtimeSync } from "@/features/pharmacist";

export default function PharmacistLayout() {
  const { user, loading } = useAuth();

  // Mount realtime sync once for the lifetime of the pharmacist session.
  // Same pattern as (driver)/_layout.tsx with useDriverRealtimeSync.
  usePharmacistRealtimeSync(
    user?.role === "pharmacist" || user?.role === "admin" || user?.role === "manager"
      ? user.id
      : undefined,
  );

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  // Non-pharmacist sessions have no business here.
  // admin and manager also get access — they can see the pharmacist workbench.
  const hasAccess =
    user?.role === "pharmacist" ||
    user?.role === "admin" ||
    user?.role === "manager";

  if (!user || !hasAccess) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index"              options={{ animation: "fade" }} />
      {/* Promote analytics higher in the stack so it's easier to deep-link */}
      <Stack.Screen name="analytics"          options={{ animation: "fade" }} />
      <Stack.Screen name="order/[id]"         />
      <Stack.Screen name="prescriptions"      />
      <Stack.Screen name="prescription/[id]"  />
      <Stack.Screen name="inventory"          />
      <Stack.Screen name="scanner"            />
      <Stack.Screen name="search"             />
      <Stack.Screen name="notifications"      options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="profile"            />
    </Stack>
  );
}
