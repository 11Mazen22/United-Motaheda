/**
 * responsive.ts — Device-aware layout utilities.
 *
 * Uses useWindowDimensions() so values update on orientation changes and
 * on Android foldables / split-screen without requiring an app restart.
 *
 * Breakpoints (logical pixels):
 *   phone       < 600    → 2 product columns, 16 px padding
 *   tablet      600–899  → 3 product columns, 24 px padding
 *   large tablet ≥ 900   → 4 product columns, 32 px padding
 */

import { useWindowDimensions } from "react-native";

export interface ScreenLayout {
  width:         number;
  height:        number;
  isTablet:      boolean;
  isLargeTablet: boolean;
  numColumns:    number;
  pagePad:       number;
  itemGap:       number;
}

export function useScreenLayout(): ScreenLayout {
  const { width, height } = useWindowDimensions();

  const isTablet      = width >= 600;
  const isLargeTablet = width >= 900;

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    numColumns: isLargeTablet ? 4 : isTablet ? 3 : 2,
    pagePad:    isLargeTablet ? 32 : isTablet ? 24 : 16,
    itemGap:    isTablet ? 12 : 8,
  };
}
