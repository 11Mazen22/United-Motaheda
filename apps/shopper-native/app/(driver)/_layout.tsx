import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
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
  // Locks the access decision the first time it's resolved. Without this,
  // isDriverRole is recomputed live from `user` on every render, and on a
  // churning connection `user` genuinely flips role between "driver" and
  // "customer" a few times a second as onAuthStateChange keeps refiring —
  // each flip toggled shouldBounce, which mounted/bounced/remounted this
  // layout in a tight loop and crashed with "Maximum update depth exceeded".
  // A role can't legitimately change mid-session without a fresh sign-in
  // remounting this whole tree anyway, so deciding once is safe, not stale.
  const decidedAccessRef = useRef<boolean | null>(null);

  // A network hiccup (or the profile query's own bounded timeout — see
  // getMyDriverProfile) settles into isError, not isLoading, once retries
  // are exhausted. That's "we don't know", not "not a live driver" — bouncing
  // a real driver to the customer tabs on a connectivity blip (which is
  // exactly the class of failure this whole app has been fighting on this
  // connection) silently shows them the wrong app. Keep retrying quietly
  // instead of ever treating an error as a confirmed bad status.
  useEffect(() => {
    if (!isDriverRole || !profileQuery.isError) return;
    const id = setTimeout(() => void profileQuery.refetch(), 5000);
    return () => clearTimeout(id);
  }, [isDriverRole, profileQuery.isError, profileQuery.refetch]);

  const stillDeciding = loading || (isDriverRole && (profileQuery.isLoading || profileQuery.isError));
  const hasLiveDriverProfile = Boolean(profileQuery.data && LIVE_DRIVER_STATUSES.has(profileQuery.data.status));

  if (decidedAccessRef.current === null && !stillDeciding) {
    decidedAccessRef.current = Boolean(user) && isDriverRole && hasLiveDriverProfile;
  }
  if (decidedAccessRef.current === null) {
    // This can legitimately sit here for a while: the retry-forever effect
    // above deliberately never gives up on a driver's profile fetch rather
    // than risk bouncing a real driver to the customer tabs over a
    // connectivity blip. Unlike index.tsx's own blank hand-off view (which
    // is always brief and hidden behind SplashOverlay's own fixed-length
    // animation), this state has no such time limit and no overlay masking
    // it once the splash has already exited — a bare white view here reads
    // as a frozen/crashed app rather than "still checking your account".
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
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="offer/[assignmentId]" />
      <Stack.Screen name="delivery/[orderId]" />
      <Stack.Screen name="issue/[orderId]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="driver-notifications" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
