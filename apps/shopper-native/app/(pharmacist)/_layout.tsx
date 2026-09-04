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

import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/features/auth";
import { claimPostSignOutNavigation } from "@/features/auth/postSignOutNav";
import { usePharmacistRealtimeSync } from "@/features/pharmacist";

export default function PharmacistLayout() {
  const router = useRouter();
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

  // Guards the imperative redirect below, separately from decidedAccessRef.
  // expo-router's <Redirect> fires router.replace() from a useFocusEffect
  // whose dependency is a fresh inline callback on every render of
  // <Redirect> — so it re-fires on every re-render where this screen is
  // still focused, not just once. Once the real navigation is at all slow
  // to take over focus (which a throttled one is, by definition), every
  // re-render in between re-issues the same replace() call, and the
  // resulting burst is what trips the browser's own rapid-navigation
  // throttle — which delays the transition further, feeding the same loop
  // (see (driver)/_layout.tsx's matching guard for the full incident).
  // Calling router.replace() ourselves is the fix -- but a per-instance ref
  // guard on its own turned out not to be enough (see
  // claimPostSignOutNavigation's doc: a remount of this exact layout gets a
  // fresh ref, and that's what a stale/queued auth event bouncing the user
  // back here mid-sign-out was doing). claimPostSignOutNavigation is module
  // state, so it survives exactly that remount.
  // No dependency array: this must re-check on every render (decidedAccessRef
  // is a ref, not state, so there's nothing reactive to key an effect off
  // of), but hasLeftRef ensures the replace() call inside only ever actually
  // fires once. Mirrors the "leave" condition of both <Redirect> sites below
  // combined.
  //
  // The replace() call is deferred one macrotask via setTimeout rather than
  // called synchronously. Reproduced live on (driver)/_layout.tsx's matching
  // guard: this layout's Stack contains its own nested (tabs) navigator with
  // several screens -- calling replace() synchronously here unmounts that
  // whole subtree within the same React commit that's still flushing other
  // pending updates, and each unmounting screen's cleanup
  // (@react-navigation/core's SceneView clears the options it registered on
  // its parent navigator on unmount) triggers a parent state update. Enough
  // of those cascading synchronously in one commit trips React's own
  // "Maximum update depth exceeded" (error #185) — confirmed via the
  // captured stack, which is entirely inside react-navigation's
  // clearOptions/options-getter machinery, no application code in it at
  // all. Deferring by one tick lets React fully settle the current commit
  // before the heavy nested-unmount transition begins, without changing
  // what navigates or how many times (still guarded to exactly once).
  const shouldLeave =
    decidedAccessRef.current === false ||
    (decidedAccessRef.current === true && !user && !loading);

  // ROOT CAUSE FOUND (2026-09-04), after two prior attempts (permanent latch
  // -> 1s cooldown -> unconditional watchdog) all failed to fix a hang
  // reproduced live on a real device: this effect and the watchdog below it
  // both had NO dependency array, so React re-ran (and re-cleaned-up) both
  // of them on EVERY render of this component, not just when shouldLeave
  // actually changed. usePharmacistRealtimeSync above keeps re-rendering
  // this layout for as long as it's mounted with a defined id (channel
  // reconnects, presence updates, etc.) — once shouldLeave went true and the
  // "leaving" blank view rendered, the layout is STILL mounted (it hasn't
  // navigated away yet, that's the whole problem), so those re-renders kept
  // happening. Each one re-ran the watchdog's useEffect body, whose own
  // cleanup (`clearTimeout(id)`) fired first and cancelled whatever was left
  // of the previous 2500ms countdown — so the timer was perpetually reset
  // to 0 and could structurally never reach 2500ms, no matter how long the
  // hang was left alone. This wasn't a race that happened to lose; it was a
  // countdown that could never finish. Keying both effects on the *value*
  // of shouldLeave (a plain boolean, stable across re-renders where it
  // doesn't change) instead of leaving them with no dependency array fixes
  // this at the actual mechanism -- confirmed by reasoning through the
  // effect-cleanup order above, not just retried and hoped. Mirrors the
  // identical fix in (driver)/_layout.tsx.
  useEffect(() => {
    if (shouldLeave && claimPostSignOutNavigation()) {
      setTimeout(() => router.replace("/" as never), 0);
    }
  }, [shouldLeave]);

  const watchdogFiredRef = useRef(false);
  useEffect(() => {
    if (!shouldLeave || watchdogFiredRef.current) return;
    const id = setTimeout(() => {
      watchdogFiredRef.current = true;
      router.replace("/" as never);
    }, 2500);
    return () => clearTimeout(id);
  }, [shouldLeave]);

  // If the user actively signs out, user becomes null. Kick them back to the
  // customer app (guest mode) immediately. Gated on decidedAccessRef already
  // having resolved once -- without that, this misfires on a transient
  // null-user/not-loading frame during startup (confirmed live: right after
  // the native restart a language switch triggers, before the restored
  // session repopulates `user`) and bounces a real pharmacist to the
  // customer tabs before their role has even loaded. Once this layout
  // unmounts via that wrong redirect, `user` resolving correctly afterwards
  // can't undo it -- there's no one left mounted to notice.
  //
  // Redirects to "/" (the app root), not "/(tabs)" directly -- confirmed
  // live that "/(tabs)" chains straight into (customer)/(tabs)/_layout.tsx's
  // own independent role-redirect guard, so a sign-out fired two separate
  // "decide where this user belongs" evaluations back to back, producing a
  // real navigation storm (see (driver)/_layout.tsx's matching fix for the
  // full incident). index.tsx already makes this decision exactly once per
  // mount; routing through it instead of duplicating the logic here closes
  // the loop instead of chaining it.
  if (decidedAccessRef.current !== null && !user && !loading) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  if (decidedAccessRef.current === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0E7E74" />
      </View>
    );
  }

  if (decidedAccessRef.current === false) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
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
