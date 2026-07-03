import React from "react";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { OrdersScreen } from "@/features/orders";
import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

/**
 * Tab entry — uses the same OrdersScreen body as the top-level /orders route,
 * but suppresses the back-button header since the tab bar provides navigation.
 */
export default function OrdersTab(): React.ReactElement {
  const { gesture, animatedStyle } = useTabSwipeGesture("orders");
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <OrdersScreen showBack={false} />
      </Animated.View>
    </GestureDetector>
  );
}
