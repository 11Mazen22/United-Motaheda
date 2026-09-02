/**
 * EarningsBreakdownDonut — ring chart for the base/distance/tip/bonus split
 * on DriverEarningsScreen. The total in the center is native Text (never
 * SvgText — see WeeklyEarningsChart's note on why SVG text breaks Arabic
 * shaping on-device).
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { Circle, G, Svg } from "react-native-svg";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { formatPrice } from "@/utils/format";

interface DonutItem {
  key: string;
  value: number;
  color: string;
}

interface Props {
  items: DonutItem[];
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function EarningsBreakdownDonut({ items, total, size = 128, strokeWidth = 18 }: Props): React.ReactElement {
  const { theme } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const innerDiameter = size - strokeWidth * 2 - 8;

  let cumulative = 0;
  const segments = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const frac = total > 0 ? item.value / total : 0;
      const segLen = frac * circumference;
      const dashoffset = -cumulative;
      cumulative += segLen;
      return { ...item, segLen, dashoffset };
    });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.canvas.surfaceMuted} strokeWidth={strokeWidth} fill="none" />
          {segments.map((seg) => (
            <Circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.segLen} ${Math.max(circumference - seg.segLen, 0)}`}
              strokeDashoffset={seg.dashoffset}
              fill="none"
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      <View style={[styles.centerOverlay, { width: innerDiameter }]} pointerEvents="none">
        <UIText variant="caption" weight="black" numberOfLines={1} style={{ textAlign: "center" }}>
          {formatPrice(total)}
        </UIText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  centerOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
