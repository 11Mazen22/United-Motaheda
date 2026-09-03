import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
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
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  // Decided once and only once. Without this, every later auth-state churn
  // (a token refresh, a flaky realtime reconnect) recomputes `target` and
  // fires a brand new navigation — enough of those in a row and the
  // browser's own rapid-navigation throttling kicks in and the redirect
  // never lands, leaving the app looking permanently stuck on this blank
  // view even though the state underneath is fine.
  const decidedTarget = useRef<Target | null>(null);
  // Guards the actual navigation call itself, separately from decidedTarget.
  // expo-router's <Redirect> fires router.replace() from a useFocusEffect
  // whose dependency is a fresh inline callback on every render of
  // <Redirect> — so it re-fires on every re-render where the screen is
  // still focused, not just once. Once the *target* route is at all slow to
  // actually take over focus (which throttled navigations are, by
  // definition), every re-render in between re-issues the same replace()
  // call, and the resulting burst is what trips the browser's own
  // rapid-navigation throttle — which then delays the real transition even
  // further, feeding the same loop. Confirmed live: repeated aborted
  // `HEAD /` requests and climbing "Throttling navigation" warnings that
  // never settle. Calling router.replace() ourselves, gated by this ref, is
  // the only way to guarantee it fires at most once regardless of how many
  // times this component re-renders afterward.
  const hasNavigatedRef = useRef(false);
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

  // No dependency array: this must re-check on every render (decidedTarget
  // is a ref, not state, so there's nothing reactive to key an effect off
  // of), but hasNavigatedRef ensures the replace() call inside only ever
  // actually fires once. See hasNavigatedRef's declaration for why a plain
  // <Redirect> here isn't safe.
  useEffect(() => {
    if (decidedTarget.current !== null && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      // Cast: expo-router's generated route types haven't picked up the new
      // (driver) group's routes at the time of this typecheck run (typegen
      // regenerates on next `expo start`/build) — same pattern already used
      // for dynamic push targets elsewhere in this app (e.g. root
      // _layout.tsx's PushBootstrap).
      router.replace(decidedTarget.current as never);
    }
  });

  if (decidedTarget.current !== null) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  // White to match the SplashOverlay handoff (was navy → caused a brief dark
  // flash between splash fade-out and the redirect target mounting).
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
      {showSpinner ? <ActivityIndicator size="large" color="#0E7E74" /> : null}
    </View>
  );
}
