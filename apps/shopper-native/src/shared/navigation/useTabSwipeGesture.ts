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
 *
 * V2 — animated glide (refines the feel, not the architecture):
 * The current screen's content now visibly tracks the finger with rubber-band
 * resistance while dragging (via the returned `animatedStyle` — apply it to
 * an Animated.View wrapping the screen's root), then on release either glides
 * the rest of the way with an eased "confirm" motion before the tab actually
 * switches, or springs back with natural deceleration if the drag didn't
 * qualify. There is no adjacent-screen content to slide in (that would need a
 * real pager), so the confirm motion is intentionally short — just enough to
 * read as "gliding to a decision" rather than "instantly teleporting."
 */
import { Platform, type ViewStyle } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { isRtl } from "@/utils/layout";

export const TAB_ORDER = ["index", "meds", "products", "orders", "profile"] as const;

export type TabRouteName = (typeof TAB_ORDER)[number];

const IS_RTL = isRtl();

// Deliberate-swipe thresholds — tuned so a small/accidental horizontal
// brush during vertical scrolling doesn't trigger a tab change. Slightly
// more conservative than a hair-trigger tap, so an intentional gesture is
// required before anything commits.
const TRANSLATE_THRESHOLD = 72;
const VELOCITY_THRESHOLD  = 620;

// How far the live drag is allowed to visually track the finger before
// rubber-band resistance takes over — keeps the preview readable without
// ever fully detaching the screen (there's no adjacent content behind it).
const MAX_DRAG_PREVIEW = 64;
// How far the "confirm" glide travels past that before the tab switches —
// a short, eased flourish rather than a full off-screen slide.
const CONFIRM_TRAVEL   = 46;

const SNAP_BACK_SPRING = { damping: 20, stiffness: 260, mass: 0.9 } as const;
const CONFIRM_EASING   = Easing.out(Easing.cubic);
const CONFIRM_DURATION = 200;

/** Maps a TAB_ORDER entry to the actual expo-router href for that tab. */
function tabHref(name: TabRouteName): string {
  return name === "index" ? "/(tabs)" : `/(customer)/(tabs)/${name}`;
}

function triggerHaptic() {
  if (Platform.OS !== "web") {
    Haptics.selectionAsync().catch(() => {});
  }
}

function navigateTo(targetIndex: number) {
  const targetName = TAB_ORDER[targetIndex];
  triggerHaptic();
  router.navigate(tabHref(targetName) as any);
}

/** Rubber-band resistance — approaches `max` asymptotically, never exceeds it. */
function rubberBand(raw: number, max: number): number {
  "worklet";
  const sign = raw < 0 ? -1 : 1;
  return sign * max * (1 - Math.exp(-Math.abs(raw) / (max * 1.4)));
}

export interface TabSwipeGesture {
  gesture:       ReturnType<typeof Gesture.Pan>;
  animatedStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
}

/**
 * Builds a horizontal swipe gesture for switching between the 5 main tabs.
 * Apply the returned `animatedStyle` to an Animated.View wrapping the
 * screen's root content (inside the GestureDetector) so the glide is visible.
 *
 * @param currentRoute  The current route name — must be one of TAB_ORDER.
 */
export function useTabSwipeGesture(currentRoute: TabRouteName): TabSwipeGesture {
  const currentIndex = TAB_ORDER.indexOf(currentRoute);
  const translateX   = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      "worklet";
      translateX.value = rubberBand(e.translationX, MAX_DRAG_PREVIEW);
    })
    .onEnd((e) => {
      "worklet";
      const qualifies =
        Math.abs(e.translationX) > TRANSLATE_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

      if (!qualifies) {
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        return;
      }

      // translationX very negative == swipe left (finger moves toward the left edge).
      const swipedLeft = e.translationX < 0;

      // RTL direction mapping:
      // With forceRTL active, the gesture coordinate system is NOT mirrored —
      // physical finger movement still maps to positive/negative translationX
      // in the same physical direction. But the TAB ORDER reads right-to-left
      // in Arabic (tab 0 = rightmost position, tab 4 = leftmost). So:
      //   Swipe left  (translationX < 0) in LTR → advance to next tab (higher index)
      //   Swipe left  (translationX < 0) in RTL → go back to previous tab (lower index)
      //   Swipe right (translationX > 0) in LTR → go back to previous tab (lower index)
      //   Swipe right (translationX > 0) in RTL → advance to next tab (higher index)
      const delta = IS_RTL ? (swipedLeft ? -1 : 1) : (swipedLeft ? 1 : -1);

      const rawTarget   = currentIndex + delta;
      const targetIndex = Math.max(0, Math.min(TAB_ORDER.length - 1, rawTarget));

      if (targetIndex === currentIndex) {
        // Already at the end of the row — settle back rather than glide
        // toward a switch that can't happen.
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        return;
      }

      // Glide the rest of the way with a deliberate ease-out (deceleration),
      // then switch tabs and reset — the freshly-focused screen mounts at
      // rest, so there's no visible snap.
      const travelDir = swipedLeft ? -1 : 1;
      translateX.value = withTiming(
        travelDir * CONFIRM_TRAVEL,
        { duration: CONFIRM_DURATION, easing: CONFIRM_EASING },
        (finished) => {
          if (finished) translateX.value = 0;
        },
      );
      runOnJS(navigateTo)(targetIndex);
    });

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { gesture, animatedStyle };
}
