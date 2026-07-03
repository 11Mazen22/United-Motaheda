/**
 * useTabSwipeGesture — lightweight swipe-left/right gesture to switch between
 * the app's 5 main bottom-tab screens, in addition to the existing tap-to-switch
 * on the bottom tab bar.
 *
 * Deliberately NOT a pager-view / tab-view rewrite: this just builds a
 * Gesture.Pan() that coexists with each screen's own vertical ScrollView/FlatList
 * (activates only past a horizontal threshold, yields to vertical scrolling),
 * and on a qualifying swipe calls router.navigate() to hop to the adjacent tab.
 * React Navigation keeps inactive tab screens mounted, so this preserves scroll
 * position / state on both the origin and target screens automatically.
 */
import { Platform } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { isRtl } from "@/utils/layout";

export const TAB_ORDER = ["index", "meds", "products", "orders", "profile"] as const;

export type TabRouteName = (typeof TAB_ORDER)[number];

const IS_RTL = isRtl();

// Deliberate-swipe thresholds — tuned so a small/accidental horizontal
// brush during vertical scrolling doesn't trigger a tab change.
const TRANSLATE_THRESHOLD = 60;
const VELOCITY_THRESHOLD = 500;

/** Maps a TAB_ORDER entry to the actual expo-router href for that tab. */
function tabHref(name: TabRouteName): string {
  return name === "index" ? "/(tabs)" : `/(tabs)/${name}`;
}

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync().catch(() => {});
  }
}

function handleSwipeEnd(currentIndex: number, targetIndex: number) {
  if (targetIndex === currentIndex) return;
  if (targetIndex < 0 || targetIndex > TAB_ORDER.length - 1) return;

  const targetName = TAB_ORDER[targetIndex];
  triggerHaptic();
  router.navigate(tabHref(targetName) as any);
}

/**
 * Builds a horizontal swipe gesture for switching between the 5 main tabs.
 *
 * @param currentRoute  The current route name — must be one of TAB_ORDER.
 */
export function useTabSwipeGesture(currentRoute: TabRouteName) {
  const currentIndex = TAB_ORDER.indexOf(currentRoute);

  const gesture = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onEnd((e) => {
      "worklet";
      const qualifies =
        Math.abs(e.translationX) > TRANSLATE_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (!qualifies) return;

      // translationX very negative == swipe left (finger moves toward the left edge).
      const swipedLeft = e.translationX < 0;

      // RTL direction mapping (matches CategoryStrip's arrow-button convention):
      //  Not RTL: swipe left  -> next tab (index + 1); swipe right -> previous tab (index - 1)
      //  RTL:     swipe left  -> previous tab (index - 1); swipe right -> next tab (index + 1)
      let delta: number;
      if (IS_RTL) {
        delta = swipedLeft ? -1 : 1;
      } else {
        delta = swipedLeft ? 1 : -1;
      }

      const rawTarget = currentIndex + delta;
      const targetIndex = Math.max(0, Math.min(TAB_ORDER.length - 1, rawTarget));

      runOnJS(handleSwipeEnd)(currentIndex, targetIndex);
    });

  return gesture;
}
