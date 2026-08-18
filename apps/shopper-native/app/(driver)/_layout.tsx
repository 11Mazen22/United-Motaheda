import React from "react";
import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/features/auth";
import { useDriverRealtimeSync } from "@/features/driver";

/**
 * Defense-in-depth: app/index.tsx already routes drivers here and everyone
 * else to (tabs), but that's a one-time decision at launch. If a non-driver
 * session somehow lands on a (driver) route directly (a stale deep link, a
 * role change mid-session, manual URL entry on web), bounce them out rather
 * than trust the entry redirect alone.
 */
export default function DriverLayout() {
  const { user, loading } = useAuth();
  // Mounted once for the whole driver section, mirroring how
  // useNotificationSync is mounted once at the app root — one realtime
  // channel pair for the lifetime of the driver session, not per-screen.
  useDriverRealtimeSync(user?.role === "driver" ? user.id : undefined);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  if (!user || user.role !== "driver") {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="map" />
      <Stack.Screen name="offers" />
      <Stack.Screen name="offer/[assignmentId]" />
      <Stack.Screen name="delivery/[orderId]" />
      <Stack.Screen name="issue/[orderId]" />
    </Stack>
  );
}
