/**
 * DriverApplicationEntry — the single "become a driver" entry point.
 * Decides between the application form and the status screen based on
 * whether the caller already has a DriverProfile row, so callers (the
 * customer profile menu) don't need to know which state to route to.
 */
import React from "react";
import { View } from "react-native";
import { Screen } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { useMyDriverProfile } from "../hooks/useDriverProfile";
import { DriverApplicationScreen } from "./DriverApplicationScreen";
import { DriverApplicationPendingScreen } from "./DriverApplicationPendingScreen";

export function DriverApplicationEntry(): React.ReactElement {
  const { user } = useAuth();
  const profileQuery = useMyDriverProfile(user?.id);

  if (profileQuery.isLoading) {
    return <Screen edgeTop><View style={{ flex: 1 }} /></Screen>;
  }

  return profileQuery.data ? <DriverApplicationPendingScreen /> : <DriverApplicationScreen />;
}
