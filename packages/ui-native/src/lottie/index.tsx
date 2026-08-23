import React, { useEffect, useRef } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import LottieView, { type AnimationObject } from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";

export type LottieSource = AnimationObject | { uri: string } | string;

export interface LottieMomentProps {
  source: LottieSource;
  loop?: boolean;
  autoPlay?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Rendered instead of the animation when the viewer prefers reduced motion. */
  fallback?: React.ReactNode;
}

/**
 * Thin, theme-agnostic wrapper around `lottie-react-native` for loading /
 * success / celebration micro-animations (A9). No bundled preset library
 * yet — sources are supplied per screen as real motion assets are designed,
 * rather than invented speculatively ahead of a screen's own spec (Part C).
 */
export function LottieMoment({ source, loop = false, autoPlay = true, size = 96, style, fallback = null }: LottieMomentProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const ref = useRef<LottieView>(null);

  useEffect(() => {
    if (!reducedMotion && autoPlay) ref.current?.play();
  }, [reducedMotion, autoPlay]);

  if (reducedMotion) return <>{fallback}</>;
  return <LottieView ref={ref} source={source} loop={loop} autoPlay={autoPlay} style={[{ width: size, height: size }, style]} />;
}
