/**
 * ArrivalOverlay — cinematic 5-phase arrival sequence (V2).
 *
 * Sits as absoluteFillObject above the fully-rendered HomeScreen.
 * The app is already assembled beneath — the overlay IS the experience.
 * When the sequence completes the overlay dissolves, revealing the app.
 *
 * Phase 1 (T=0–150ms):   Hold / freeze — opaque canvas, nothing moves.
 * Phase 2 (T=150ms):     Spatial expansion — env contracts to 1:1, particles emerge.
 * Phase 3 (T=350ms):     Brand anchor — logo materialises at screen centre.
 * Phase 4 (T=950ms):     Interface construction — logo travels to header,
 *                         construction sweep traces the surface edge.
 * Phase 5 (T=1600ms):    Dissolve — overlay fades, HomeScreen revealed.
 *
 * On reduced motion: calls onComplete immediately, no animation.
 */

import React, { memo, useEffect, useState } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppLogo }        from "@/shared/components/AppLogo";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { onSplashExited } from "@/shared/splashBridge";
import { isRtl }          from "@/utils/layout";

const IS_RTL  = isRtl();
const { width: W, height: H } = Dimensions.get("window");
const PAGE_H  = legacyTheme.layout.pagePaddingH; // 20

const LOGO_PX   = 80;
const LOGO_HALF = LOGO_PX / 2; // 40

// ── Particle field ────────────────────────────────────────────────────────────

interface ParticleDef {
  x:     number;  // left edge as fraction of W
  y:     number;  // top edge as fraction of H
  size:  number;
  delay: number;
  color: string;
}

const PARTICLES: ParticleDef[] = [
  { x: 0.04, y: 0.06, size: 110, delay: 60,  color: theme.colors.brand.primaryLight  },
  { x: 0.74, y: 0.04, size: 150, delay: 100, color: `${theme.colors.status.warning}1A`    },
  { x: 0.08, y: 0.70, size:  90, delay: 140, color: theme.colors.brand.primaryLight  },
  { x: 0.68, y: 0.60, size: 120, delay:  80, color: `${theme.colors.status.success}1A` },
  { x: 0.38, y: 0.84, size:  95, delay: 180, color: theme.colors.brand.primaryLight  },
  { x: 0.87, y: 0.36, size:  75, delay: 220, color: `${theme.colors.status.error}1A`  },
  { x: 0.01, y: 0.42, size: 130, delay:  40, color: theme.colors.brand.primaryLight  },
  { x: 0.60, y: 0.16, size:  70, delay: 160, color: `${theme.colors.status.warning}1A`    },
];

// ── AmbientParticle ───────────────────────────────────────────────────────────

interface AmbientParticleProps {
  def:       ParticleDef;
  triggered: boolean;
  fadingOut: boolean;
}

const AmbientParticle = memo(function AmbientParticle({
  def,
  triggered,
  fadingOut,
}: AmbientParticleProps) {
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0.5);

  useEffect(() => {
    if (!triggered) return;
    const tid = setTimeout(() => {
      opacity.value = withTiming(0.7,  { duration: 600 });
      scale.value   = withSpring(1.0,  { damping: 14, stiffness: 80 });
    }, def.delay);
    return () => {
      clearTimeout(tid);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [triggered]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fadingOut) return;
    opacity.value = withTiming(0,   { duration: 400 });
    scale.value   = withTiming(0.4, { duration: 400 });
  }, [fadingOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        anim,
        {
          position:        "absolute",
          start: def.x * W,
          top:             def.y * H,
          width:           def.size,
          height:          def.size,
          borderRadius:    def.size / 2,
          backgroundColor: def.color,
        },
      ]}
      pointerEvents="none"
    />
  );
});

// ── ArrivalOverlay ────────────────────────────────────────────────────────────

export interface ArrivalOverlayProps {
  topInset:   number;
  onComplete: () => void;
}

export function ArrivalOverlay({ topInset, onComplete }: ArrivalOverlayProps) {
  const reduced = useReducedMotion() ?? false;

  const [triggered, setTriggered] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const overlayOpacity = useSharedValue(1);
  const envScale       = useSharedValue(1.04);
  const logoOpacity    = useSharedValue(0);
  const logoScale      = useSharedValue(0.6);
  const logoTransX     = useSharedValue(0);
  const logoTransY     = useSharedValue(0);
  const sweepWidth     = useSharedValue(0);
  const sweepOpacity   = useSharedValue(0);

  // Header logoOuter (60×60) centre:
  //   Y = topInset + 14 (header paddingTop) + 30 (half of 60px outer)
  //   X = leading edge padding (20) + half outer (30)
  const landX = IS_RTL ? W - PAGE_H - 30 : PAGE_H + 30;
  const landY = topInset + 44;
  const dx    = landX - W / 2;
  const dy    = landY - H / 2;

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => ids.push(setTimeout(fn, ms));

    const unsub = onSplashExited(() => {
      if (reduced) {
        onComplete();
        return;
      }

      // Phase 2 — T=150ms: environment snaps to 1:1, particles bloom
      at(() => {
        envScale.value = withTiming(1.0, {
          duration: 400,
          easing:   Easing.out(Easing.cubic),
        });
        setTriggered(true);
      }, 150);

      // Phase 3 — T=350ms: logo materialises at screen centre
      at(() => {
        logoOpacity.value = withTiming(1, { duration: 200 });
        logoScale.value   = withSpring(1.0, { damping: 14, stiffness: 120 });
      }, 350);

      // Phase 4a — T=950ms: logo travels to header landing position
      at(() => {
        logoTransX.value = withSpring(dx,  { damping: 22, stiffness: 220 });
        logoTransY.value = withSpring(dy,  { damping: 22, stiffness: 220 });
        logoScale.value  = withSpring(0.6, { damping: 22, stiffness: 220 });
      }, 950);

      // Phase 4b — T=1050ms: construction sweep traces the header surface
      at(() => {
        sweepOpacity.value = withTiming(1, { duration: 80 });
        sweepWidth.value   = withTiming(W, {
          duration: 320,
          easing:   Easing.out(Easing.cubic),
        });
      }, 1050);

      // Phase 4c — T=1400ms: sweep out, particles fade
      at(() => {
        sweepOpacity.value = withTiming(0, { duration: 250 });
        setFadingOut(true);
      }, 1400);

      // Phase 5 — T=1600ms: dissolve
      at(() => {
        overlayOpacity.value = withTiming(0, {
          duration: 450,
          easing:   Easing.inOut(Easing.cubic),
        });
      }, 1600);

      // Handoff — T=2050ms
      at(onComplete, 2050);
    });

    return () => {
      unsub();
      ids.forEach(clearTimeout);
      cancelAnimation(overlayOpacity);
      cancelAnimation(envScale);
      cancelAnimation(logoOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(logoTransX);
      cancelAnimation(logoTransY);
      cancelAnimation(sweepWidth);
      cancelAnimation(sweepOpacity);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const overlayAnim = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const envAnim     = useAnimatedStyle(() => ({
    transform: [{ scale: envScale.value }],
  }));
  const logoAnim = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [
      { translateX: logoTransX.value },
      { translateY: logoTransY.value },
      { scale:      logoScale.value  },
    ],
  }));
  const sweepAnim = useAnimatedStyle(() => ({
    opacity: sweepOpacity.value,
    width:   sweepWidth.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, s.overlay, overlayAnim]}
      pointerEvents="none"
    >
      {/* Particle field — inside env scale so they contract with the environment */}
      <Animated.View style={[StyleSheet.absoluteFillObject, envAnim]}>
        {PARTICLES.map((def, i) => (
          <AmbientParticle
            key={i}
            def={def}
            triggered={triggered}
            fadingOut={fadingOut}
          />
        ))}
      </Animated.View>

      {/* Brand anchor — logo at screen centre, travels to header */}
      <Animated.View style={[s.logoTile, logoAnim]}>
        <AppLogo size={LOGO_PX} />
      </Animated.View>

      {/* Construction sweep — traces the header baseline left→right (or right→left in RTL) */}
      <Animated.View
        style={[
          s.sweepLine,
          sweepAnim,
          IS_RTL ? { end: 0 } : { start: 0 },
          { top: landY - 0.75 },
        ]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    backgroundColor: theme.colors.canvas.background,
    zIndex:          999,
  },
  logoTile: {
    position: "absolute",
    top:      H / 2 - LOGO_HALF,
    start: W / 2 - LOGO_HALF,
    width:    LOGO_PX,
    height:   LOGO_PX,
    ...theme.shadows[3],
  },
  sweepLine: {
    position:        "absolute",
    height:          1.5,
    backgroundColor: theme.colors.brand.primary,
  },
});
