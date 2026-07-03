import React from "react";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { PrescriptionsList } from "@/features/prescriptions";
import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

/**
 * Meds tab — the care hub (PRODUCT_BLUEPRINT §1 IA · §4.7).
 *
 * V2 promotes medication management from a buried stack route to a first-class
 * tab destination. Primary content is the prescription roster (PrescriptionsList,
 * which owns its AppHeader + add-Rx CTA + pull-to-refresh). The Reminders /
 * Family / Insurance segments attach here as their routes land.
 */
export default function MedsTab(): React.ReactElement {
  const { gesture, animatedStyle } = useTabSwipeGesture("meds");
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <PrescriptionsList />
      </Animated.View>
    </GestureDetector>
  );
}
