import React from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { OrdersScreen } from "@/features/orders";
import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

/**
 * Tab entry — uses the same OrdersScreen body as the top-level /orders route,
 * but suppresses the back-button header since the tab bar provides navigation.
 */
export default function OrdersTab(): React.ReactElement {
  const gesture = useTabSwipeGesture("orders");
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>
        <OrdersScreen showBack={false} />
      </View>
    </GestureDetector>
  );
}
