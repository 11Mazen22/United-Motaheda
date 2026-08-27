/**
 * ArrivalOverlay — "bloom & iris" arrival sequence (V3).
 *
 * Sits as absoluteFillObject above the fully-rendered HomeScreen. The app is
 * already assembled beneath — the overlay IS the experience. When the
 * sequence completes the overlay is gone and the app is revealed.
 *
 * Replaces the previous "logo flies to the header corner" choreography
 * (dated, and the landing math had to track the header's exact pixel
 * position). This version never moves the logo anywhere — it holds centre
 * stage, blooms into a soft ambient glow, breathes once, then the screen
 * opens around it via an expanding-circle iris wipe centred on the logo
 * itself. The header's own logo (already part of HomeScreen underneath) is
 * simply there once revealed — no landing choreography needed.
 *
 * Phase 1 (T=0–120ms):    Hold — opaque canvas, nothing moves.
 * Phase 2 (T=120ms):      Glow blooms in, logo scales/fades in at centre.
 * Phase 3 (T=780ms):      Shine sweep crosses the logo; one soft breath pulse.
 * Phase 4 (T=1200ms):     Iris wipe — a circle centred on the logo shrinks
 *                         from full-screen coverage to zero, revealing the
 *                         app underneath as it closes; logo/glow fade out
 *                         together with it so nothing is left hanging.
 * Handoff (T≈1750ms).
 *
 * On reduced motion: calls onComplete immediately, no animation.
 */

import React, { memo, useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppLogo } from "@/shared/components/AppLogo";

import { useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { onSplashExited } from "@/shared/splashBridge";

const LOGO_PX = 84;
const LOGO_HALF = LOGO_PX / 2;

export interface ArrivalOverlayProps {
  topInset: number;
  onComplete: () => void;
}

// ── Ambient glow — three soft concentric circles, no gradient dependency ────

const GlowRing = memo(function GlowRing({
  size,
  color,
  opacity,
  scale,
  centerX,
  centerY,
}: {
  size: number;
  color: string;
  opacity: ReturnType<typeof useSharedValue<number>>;
  scale: ReturnType<typeof useSharedValue<number>>;
  centerX: number;
  centerY: number;
}) {
  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        anim,
        {
          position: "absolute",
          top: centerY - size / 2,
          start: centerX - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
});

export function ArrivalOverlay({ onComplete }: ArrivalOverlayProps) {
  const { theme } = useTheme();
  // Read the *live* window size on every render — this overlay renders on
  // the web build inside a browser tab, where the viewport at the moment
  // this module first evaluates (previously captured once via
  // Dimensions.get("window") at module scope) is not reliably the actual
  // current viewport. A stale/wrong center here doesn't just look off by a
  // few pixels — the whole iris + glow + logo composition renders centred
  // on the wrong point, so only whatever corner happens to overlap the real
  // viewport is visible.
  const { width: W, height: H } = useWindowDimensions();
  const CENTER_X = W / 2;
  const CENTER_Y = H / 2;
  // Diameter needed for a circle centred on screen-middle to fully cover every
  // corner — the screen's diagonal, plus a small margin for safety.
  const IRIS_MAX = Math.hypot(W, H) * 1.15;
  const s = useMemo(() => getStyles(theme, CENTER_X, CENTER_Y), [theme, CENTER_X, CENTER_Y]);
  const reduced = useReducedMotion() ?? false;

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.6);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.62);
  const logoRotate = useSharedValue(-6);

  const shineX = useSharedValue(-1); // -1..2, animated across the logo
  const shineOpacity = useSharedValue(0);

  const irisSize = useSharedValue(IRIS_MAX);
  const irisOpacity = useSharedValue(1); // backdrop behind the iris circle

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => ids.push(setTimeout(fn, ms));

    const unsub = onSplashExited(() => {
      if (reduced) {
        onComplete();
        return;
      }

      // Phase 2 — T=120ms: glow blooms, logo materialises
      at(() => {
        glowOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
        glowScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
        logoOpacity.value = withTiming(1, { duration: 320 });
        logoScale.value = withSpring(1, { damping: 13, stiffness: 140 });
        logoRotate.value = withSpring(0, { damping: 13, stiffness: 140 });
      }, 120);

      // Phase 3 — T=780ms: shine sweep + one breath pulse
      at(() => {
        shineOpacity.value = withSequence(withTiming(0.9, { duration: 120 }), withDelay(280, withTiming(0, { duration: 200 })));
        shineX.value = withTiming(2, { duration: 600, easing: Easing.out(Easing.quad) });
        logoScale.value = withSequence(
          withTiming(1.05, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        );
      }, 780);

      // Phase 4 — T=1200ms: iris wipe closes in on the logo, revealing Home
      at(() => {
        irisSize.value = withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) });
        logoOpacity.value = withDelay(280, withTiming(0, { duration: 200 }));
        glowOpacity.value = withDelay(200, withTiming(0, { duration: 280 }));
      }, 1200);

      // Handoff — T=1780ms
      at(() => {
        irisOpacity.value = 0;
        onComplete();
      }, 1780);
    });

    return () => {
      unsub();
      ids.forEach(clearTimeout);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(logoOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(logoRotate);
      cancelAnimation(shineOpacity);
      cancelAnimation(shineX);
      cancelAnimation(irisSize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const backdropAnim = useAnimatedStyle(() => ({ opacity: irisOpacity.value }));
  const irisAnim = useAnimatedStyle(() => ({
    width: irisSize.value,
    height: irisSize.value,
    borderRadius: irisSize.value / 2,
    top: CENTER_Y - irisSize.value / 2,
    start: CENTER_X - irisSize.value / 2,
  }));
  const logoWrapAnim = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));
  const shineAnim = useAnimatedStyle(() => ({
    opacity: shineOpacity.value,
    transform: [{ translateX: shineX.value * LOGO_PX }, { rotate: "20deg" }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, s.root, backdropAnim]} pointerEvents="none">
      {/* Iris — a circle centred on the logo that shrinks to reveal the app
          underneath. Everything the user sees (glow + logo) lives inside it
          so it all recedes together instead of the overlay just fading flat. */}
      <Animated.View style={[s.iris, irisAnim]}>
        <GlowRing size={340} color={`${theme.colors.brand.primary}1F`} opacity={glowOpacity} scale={glowScale} centerX={CENTER_X} centerY={CENTER_Y} />
        <GlowRing size={230} color={`${theme.colors.brand.primary}26`} opacity={glowOpacity} scale={glowScale} centerX={CENTER_X} centerY={CENTER_Y} />
        <GlowRing size={140} color={theme.colors.brand.primaryLight} opacity={glowOpacity} scale={glowScale} centerX={CENTER_X} centerY={CENTER_Y} />

        <Animated.View style={[s.logoTile, logoWrapAnim, theme.shadows[4]]}>
          <AppLogo size={LOGO_PX} />
          <Animated.View pointerEvents="none" style={[s.shine, shineAnim]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function getStyles(theme: NativeTheme, centerX: number, centerY: number) {
  return StyleSheet.create({
    root: {
      backgroundColor: theme.colors.canvas.background,
      zIndex: 999,
    },
    iris: {
      position: "absolute",
      backgroundColor: theme.colors.canvas.background,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    logoTile: {
      position: "absolute",
      top: centerY - LOGO_HALF,
      start: centerX - LOGO_HALF,
      width: LOGO_PX,
      height: LOGO_PX,
      borderRadius: Math.round(LOGO_PX * 0.24),
      overflow: "hidden",
    },
    shine: {
      position: "absolute",
      top: -LOGO_PX * 0.6,
      start: -LOGO_PX * 0.15,
      width: LOGO_PX * 0.4,
      height: LOGO_PX * 2.2,
      backgroundColor: "rgba(255,255,255,0.55)",
    },
  });
}
