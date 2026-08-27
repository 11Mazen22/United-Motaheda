import React from "react";
import { Platform } from "react-native";
import Svg, { Circle, Path, type SvgProps } from "react-native-svg";
import { useTheme } from "../theme";

// react-native-svg's web <Svg> forwards unrecognized props straight to the
// DOM node — RN's `accessible={false}` isn't a valid raw SVG/HTML attribute,
// so it must become the real `aria-hidden` attribute on web instead.
const HIDE_PROPS = Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false as const };

export interface OfflineIllustrationProps extends Omit<SvgProps, "width" | "height"> {
  size?: number;
}

/**
 * Calm "connection lost" motif — a signal-arc glyph with a slash through it,
 * inside the same dashed ring treatment as EmptyIllustration so the two read
 * as one family. Used for network/loading-error empty states, which were
 * previously a bare Ionicon (wifi-outline/cloud-offline-outline) repeated
 * across ~7 unrelated screens.
 */
export function OfflineIllustration({ size = 96, ...props }: OfflineIllustrationProps): React.ReactElement {
  const { theme } = useTheme();
  const ring = theme.colors.canvas.surfaceMuted;
  const ink = theme.colors.status.warning;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none" {...HIDE_PROPS} {...props}>
      <Circle cx={48} cy={48} r={44} stroke={ring} strokeWidth={2} strokeDasharray="4 6" />
      <Path d="M31 44a24 24 0 0 1 34 0" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      <Path d="M38 53a13 13 0 0 1 20 0" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      <Circle cx={48} cy={64} r={3.5} fill={ink} />
      <Path d="M26 30 70 66" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}
