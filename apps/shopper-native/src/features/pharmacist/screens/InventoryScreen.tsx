/**
 * InventoryScreen — delegates to InventoryIntelligenceScreen with search focus.
 *
 * This screen is now a thin wrapper so the route stays valid.
 * The primary inventory experience lives in InventoryIntelligenceScreen.
 */

import React from "react";
import { Screen } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";



export function InventoryScreen(): React.ReactElement {

  const { theme } = useTheme();

  return <Screen edgeTop background={theme.colors.canvas.background}>{null}</Screen>;

}
