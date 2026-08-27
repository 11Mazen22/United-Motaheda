import React, { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_KEY } from "@/lib/onboardingKey";
import { useAuth } from "@/features/auth";

// Below this, stay blank to match SplashOverlay's handoff without a flash on
// the common fast path. Past it, this hand-off is no longer "brief" (session
// resolution + role lookup are bounded up to ~13s combined on a bad
// connection — see AuthProvider's getSession/attachRole timeout comments),
// so a bare blank view here reads as a frozen app rather than "still
// signing you in". Reported today as "blank page when signing in as a
// driver" for exactly this reason.
const SPINNER_DELAY_MS = 700;

type Target = "/(tabs)" | "/(driver)" | "/(pharmacist)" | "/onboarding";

export default function Entry() {
  const { user, loading: authLoading } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  // Decided once and only once. Without this, every later auth-state churn
  // (a token refresh, a flaky realtime reconnect) recomputes `target` and
  // fires a brand new navigation — enough of those in a row and the
  // browser's own rapid-navigation throttling kicks in and the redirect
  // never lands, leaving the app looking permanently stuck on this blank
  // view even though the state underneath is fine.
  const decidedTarget = useRef<Target | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => {
        if (cancelled) return;
        setOnboardingSeen(v === "1");
      })
      .catch(() => {
        if (cancelled) return;
        setOnboardingSeen(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Wait for BOTH onboarding-seen and auth+role resolution before deciding
  // the target — this app has a lazy/guest-mode auth flow (index.tsx never
  // used to depend on auth at all), but a driver account must never flash
  // the customer tabs before redirecting into the driver section.
  if (decidedTarget.current === null && !(onboardingSeen === null || authLoading)) {
    decidedTarget.current = !onboardingSeen
      ? "/onboarding"
      : user?.role === "driver"
        ? "/(driver)"
        : user?.role === "pharmacist"
          ? "/(pharmacist)"
          : "/(tabs)";
  }

  if (decidedTarget.current !== null) {
    // Cast: expo-router's generated route types haven't picked up the new
    // (driver) group's routes at the time of this typecheck run (typegen
    // regenerates on next `expo start`/build) — same pattern already used
    // for dynamic push targets elsewhere in this app (e.g. root
    // _layout.tsx's PushBootstrap).
    return <Redirect href={decidedTarget.current as never} />;
  }

  // White to match the SplashOverlay handoff (was navy → caused a brief dark
  // flash between splash fade-out and the redirect target mounting).
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
      {showSpinner ? <ActivityIndicator size="large" color="#0E7E74" /> : null}
    </View>
  );
}
