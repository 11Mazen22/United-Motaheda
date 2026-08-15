import React from "react";
import { Screen } from "@pharmacy/ui-native";
import DriverMap from "@/features/driver/screens/DriverMap";

export default function MapScreen() {
  // Reuse the driver map component for consistency; non-driver users will see
  // a generic map placeholder until a proper public map is added.
  return (
    <Screen edgeTop>
      <DriverMap />
    </Screen>
  );
}
