import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/features/auth";
import { useDriverRealtimeSync, useMyDriverProfile } from "@/features/driver";

// Longer than the DriverProfile query's own 20s abort timeout (see
// getMyDriverProfile) so a legitimately slow-but-succeeding request gets to
// finish before this surfaces an error over it.
const STUCK_TIMEOUT_MS = 24_000;

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
  const [stuck, setStuck] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // If the user actively signs out, user becomes null. Kick them back to the
  // customer app (guest mode) immediately. This bypasses the locked decidedAccessRef
  // because a real sign out should always eject them.
  if (!user && !loading) {
    return <Redirect href={"/(tabs)" as never} />;
  }

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

  // The retry-forever effect above deliberately never gives up on a driver's
  // profile fetch rather than risk bouncing a real driver to the customer
  // tabs over a connectivity blip -- but "retry forever" with a bare spinner
  // and zero feedback is indistinguishable from a frozen/crashed app once it
  // runs past a few seconds. Surface the actual failure after a bounded
  // wait instead of hiding it forever behind silent retries.
  useEffect(() => {
    if (decidedAccessRef.current !== null) { setStuck(false); return; }
    const id = setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [attempt]);

  const lastErrorRef = useRef<string | null>(null);
  if (profileQuery.error?.message) {
    lastErrorRef.current = profileQuery.error.message;
  }

  if (decidedAccessRef.current === null) {
    if (stuck) {
      return (
        <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#0F1724", textAlign: "center" }}>
            {"تعذّر تحميل حسابك كسائق\nCouldn't load your driver account"}
          </Text>
          {lastErrorRef.current ? (
            <View style={{ alignSelf: "stretch", padding: 12, borderRadius: 12, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text selectable style={{ fontSize: 11, color: "#334155" }}>{lastErrorRef.current}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => { setStuck(false); setAttempt((n) => n + 1); void profileQuery.refetch(); }}
            style={{ backgroundColor: "#0891B2", paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, marginTop: 8 }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{"↺  إعادة المحاولة / Retry"}</Text>
          </Pressable>
        </View>
      );
    }
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
      <Stack.Screen name="earnings" />
      <Stack.Screen name="driver-notifications" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
