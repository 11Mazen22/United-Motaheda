/**
 * WeeklyEarningsChart — bar+trend chart for the last 7 days of earnings.
 * Used on DriverEarningsScreen. Day labels are rendered as native Text, not
 * react-native-svg's SvgText: SvgText doesn't apply the OS's Arabic
 * contextual shaping/bidi reordering, so day names like "الأحد" rendered as
 * garbled fragments on-device in RTL — confirmed on a real device, not
 * visible from code review alone. Native Text handles this correctly, so
 * only the bars/trend line (no text) stay inside the SVG.
 */
import React, { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Svg, Polyline, Rect } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();
const CHART_WIDTH = 300;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface DailyEarning {
  date: Date;
  total: number;
}

interface Props {
  data: DailyEarning[];
  height?: number;
}

function dayLabel(date: Date, t: ReturnType<typeof useTranslation>["t"], locale: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t("driver.earningsToday", "Today");
  if (date.toDateString() === yesterday.toDateString()) return t("driver.earningsYesterday", "Yesterday");
  return date.toLocaleDateString(locale, { weekday: "short" });
}

function AnimatedBar({
  x, y, width, height, delay, fill, opacity,
}: {
  x: number; y: number; width: number; height: number; delay: number; fill: string; opacity: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [delay, height, progress]);

  const animatedProps = useAnimatedProps(() => {
    const h = height * progress.value;
    return { height: h, y: y + (height - h) } as Partial<React.ComponentProps<typeof Rect>>;
  });

  return <AnimatedRect x={x} width={width} rx={4} fill={fill} opacity={opacity} animatedProps={animatedProps} />;
}

export function WeeklyEarningsChart({ data, height = 160 }: Props): React.ReactElement {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";
  const padding = { top: 10, left: 8 };
  const chartHeight = height - padding.top;

  // RTL: reverse the day sequence so the reading edge (right, in Arabic)
  // shows the OLDEST day and the far edge shows today -- matching how a
  // week naturally reads right-to-left, rather than a mirror of the LTR
  // chart with labels that no longer match "oldest -> newest" order.
  const orderedData = useMemo(() => (IS_RTL ? [...data].reverse() : data), [data]);

  const { points, maxVal, peakIndex } = useMemo(() => {
    if (orderedData.length === 0) return { points: "", maxVal: 0, peakIndex: -1 };
    const values = orderedData.map((d) => d.total);
    const max = Math.max(...values, 1);
    const stepX = CHART_WIDTH / Math.max(orderedData.length - 1, 1);
    const pts = orderedData
      .map((d, i) => {
        const x = i * stepX;
        const y = chartHeight - (d.total / max) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");
    const peak = values.every((v) => v === 0) ? -1 : values.indexOf(Math.max(...values));
    return { points: pts, maxVal: max, peakIndex: peak };
  }, [orderedData, chartHeight]);

  if (orderedData.length === 0 || maxVal === 0) {
    return (
      <View style={[styles.emptyBox, { height, backgroundColor: theme.colors.canvas.surfaceMuted }]}>
        <UIText variant="caption" color="muted" weight="bold">
          {t("driver.earningsEmptyTitle", "No earnings yet")}
        </UIText>
      </View>
    );
  }

  const barWidth = (CHART_WIDTH / orderedData.length) * 0.5;
  const barGap = (CHART_WIDTH / orderedData.length) * 0.5;

  return (
    <View style={styles.wrap}>
      <Svg width={CHART_WIDTH} height={height}>
        <Rect x={0} y={0} width={CHART_WIDTH} height={height} fill={theme.colors.canvas.surfaceMuted} rx={14} />

        {orderedData.map((d, i) => {
          const barHeight = maxVal > 0 ? (d.total / maxVal) * (chartHeight - 8) : 0;
          const x = padding.left + i * (CHART_WIDTH / orderedData.length) + barGap / 2;
          const y = padding.top + chartHeight - barHeight;
          const isPeak = i === peakIndex;
          return (
            <AnimatedBar
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, d.total > 0 ? 3 : 0)}
              delay={i * 55}
              fill={isPeak ? theme.colors.brand.primaryDark : d.total > 0 ? theme.colors.brand.primary : theme.colors.border.default}
              opacity={d.total > 0 ? 1 : 0.5}
            />
          );
        })}

        {points ? (
          <Polyline
            points={points}
            fill="none"
            stroke={theme.colors.brand.primaryDark}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
          />
        ) : null}
      </Svg>

      <View style={[styles.labelRow, { flexDirection: flexRow(IS_RTL) }]}>
        {orderedData.map((d, i) => (
          <View key={i} style={styles.labelCell}>
            <UIText variant="eyebrow" color="muted" numberOfLines={1}>
              {dayLabel(d.date, t, locale)}
            </UIText>
          </View>
        ))}
      </View>
    </View>
  );
}

// Exported so the screen can surface "best day this week" as real, formatted
// text -- returns the raw Date so the caller formats it with its own
// locale-aware day-label logic instead of baking a non-localized string here.
export function bestDayFromWeek(data: DailyEarning[]): { date: Date; total: number } | null {
  if (data.length === 0) return null;
  const best = data.reduce((max, d) => (d.total > max.total ? d : max), data[0]);
  if (best.total <= 0) return null;
  return { date: best.date, total: best.total };
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  emptyBox: { width: CHART_WIDTH, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  labelRow: { width: CHART_WIDTH, marginTop: 8 },
  labelCell: { flex: 1, alignItems: "center" },
});
