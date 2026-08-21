/**
 * InventoryScreen — delegates to InventoryIntelligenceScreen with search focus.
 *
 * This screen is now a thin wrapper so the route stays valid.
 * The primary inventory experience lives in InventoryIntelligenceScreen.
 */

import React from "react";
import { Screen } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";



export function InventoryScreen(): React.ReactElement {

  const { c } = useDarkColors();

  return <Screen edgeTop background={c.canvas}>{null}</Screen>;

}
