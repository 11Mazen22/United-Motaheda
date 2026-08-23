import React from "react";
import Svg, { Circle, Path, type SvgProps } from "react-native-svg";
import { useTheme } from "../theme";

export interface EmptyIllustrationProps extends Omit<SvgProps, "width" | "height"> {
  size?: number;
}

/**
 * Calm, brand-teal line-art motif for "nothing here yet" moments — a capsule
 * resting inside a soft dashed ring. Theme-aware so one asset covers light
 * and dark instead of shipping two image sets. Replaces placeholder glyphs
 * (e.g. a literal "∅" character) used as empty-state art today.
 */
export function EmptyIllustration({ size = 96, ...props }: EmptyIllustrationProps): React.ReactElement {
  const { theme } = useTheme();
  const ring = theme.colors.brand.primaryLight;
  const ink = theme.colors.brand.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...props}>
      <Circle cx={48} cy={48} r={44} stroke={ring} strokeWidth={2} strokeDasharray="4 6" />
      <Path
        d="M33 41.5 54.5 63a10 10 0 0 0 14.14-14.14L47.14 27.36A10 10 0 0 0 33 41.5Z"
        stroke={ink}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m40.5 34 21.5 21.5" stroke={ink} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
