import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_KEY } from "@/lib/onboardingKey";
import { useAuth } from "@/features/auth";

type Target = "/(tabs)" | "/(driver)" | "/(pharmacist)" | "/onboarding";

export default function Entry() {
  const { user, loading: authLoading } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

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
  if (onboardingSeen === null || authLoading) {
    // White to match the SplashOverlay handoff (was navy → caused a brief
    // dark flash between splash fade-out and the redirect target mounting).
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  const target: Target = !onboardingSeen
    ? "/onboarding"
    : user?.role === "driver"
      ? "/(driver)"
      : user?.role === "pharmacist"
        ? "/(pharmacist)"
        : "/(tabs)";

  // Cast: expo-router's generated route types haven't picked up the new
  // (driver) group's routes at the time of this typecheck run (typegen
  // regenerates on next `expo start`/build) — same pattern already used for
  // dynamic push targets elsewhere in this app (e.g. root _layout.tsx's
  // PushBootstrap).
  return <Redirect href={target as never} />;
}
