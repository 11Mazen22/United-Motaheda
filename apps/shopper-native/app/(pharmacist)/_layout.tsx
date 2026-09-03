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
 *   (tabs)             — tab bar: index (Workbench), orders (workspace),
 *                        prescriptions (queue), inventory, analytics, profile
 *   order/[id]         — PharmacistOrderDetail (stack-pushed over the tabs)
 *   prescription/[id]  — PrescriptionDetailScreen (stack-pushed over the tabs)
 *   refills            — RefillsScreen (reached from Prescriptions' header)
 *   returns            — ReturnsQueueScreen (reached from Orders' header)
 *   return/[id]        — ReturnInspectionScreen (stack-pushed from Orders' return banner)
 *   scanner            — BarcodeScannerScreen (full-screen, no tab bar)
 *   notifications      — NotificationCenterScreen (pharmacist-scoped, full-screen)
 *
 * Not every route above appears in the Stack.Screen list below -- Expo
 * Router auto-discovers file-based routes regardless; an explicit entry is
 * only needed to override screenOptions for that one screen.
 */

import React, { useRef } from "react";
import { ActivityIndicator, View } from "react-native";
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

  // Locks the access decision the first time it resolves. Without this,
  // hasAccess is recomputed live from `user?.role` on every render, and on a
  // churning connection `user` can flip role a few times a second as
  // onAuthStateChange keeps refiring — each flip toggles the Redirect below,
  // bouncing between here and (tabs) in a tight loop and crashing with
  // "Maximum update depth exceeded". Mirrors (driver)/_layout.tsx's
  // decidedAccessRef, which exists to prevent exactly this on that side; a
  // role can't legitimately change mid-session without a fresh sign-in
  // remounting this whole tree anyway, so deciding once is safe, not stale.
  const decidedAccessRef = useRef<boolean | null>(null);
  if (decidedAccessRef.current === null && !loading) {
    decidedAccessRef.current =
      Boolean(user) &&
      (user?.role === "pharmacist" || user?.role === "admin" || user?.role === "manager");
  }

  // If the user actively signs out, user becomes null. Kick them back to the
  // customer app (guest mode) immediately. Gated on decidedAccessRef already
  // having resolved once -- without that, this misfires on a transient
  // null-user/not-loading frame during startup (confirmed live: right after
  // the native restart a language switch triggers, before the restored
  // session repopulates `user`) and bounces a real pharmacist to the
  // customer tabs before their role has even loaded. Once this layout
  // unmounts via that wrong redirect, `user` resolving correctly afterwards
  // can't undo it -- there's no one left mounted to notice.
  if (decidedAccessRef.current !== null && !user && !loading) {
    return <Redirect href={"/(tabs)" as never} />;
  }

  if (decidedAccessRef.current === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0E7E74" />
      </View>
    );
  }

  if (decidedAccessRef.current === false) {
    return <Redirect href={"/(tabs)" as never} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="(tabs)"             options={{ animation: "fade" }} />
      <Stack.Screen name="order/[id]"         />
      <Stack.Screen name="prescription/[id]"  />
      <Stack.Screen name="refills"            />
      <Stack.Screen name="scanner"            />
      <Stack.Screen name="pharmacist-notifications" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
