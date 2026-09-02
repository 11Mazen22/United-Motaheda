/**
 * WeeklyEarningsChart — bar+trend chart for the last 7 days of earnings.
 * Used on DriverEarningsScreen. Rebuilt from an earlier draft that had zero
 * i18n (hardcoded "TODAY"/"YEST"/"NO EARNINGS YET") and no RTL awareness in
 * an app that's bilingual and RTL everywhere else — both fixed here: day
 * order follows reading direction (oldest day starts at the reading edge,
 * today at the far end), and every label goes through t().
 */
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Svg, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "@pharmacy/ui-native";
import { isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

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

export function WeeklyEarningsChart({ data, height = 120 }: Props): React.ReactElement {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";
  const padding = { top: 10, right: 8, bottom: 26, left: 8 };
  const chartWidth = 300;
  const chartHeight = height - padding.top - padding.bottom;

  // RTL: reverse the day sequence so the reading edge (right, in Arabic)
  // shows the OLDEST day and the far edge shows today -- matching how a
  // week naturally reads right-to-left, rather than a mirror of the LTR
  // chart with labels that no longer match "oldest -> newest" order.
  const orderedData = useMemo(() => (IS_RTL ? [...data].reverse() : data), [data]);

  const { points, maxVal, peakIndex } = useMemo(() => {
    if (orderedData.length === 0) return { points: "", maxVal: 0, peakIndex: -1 };
    const values = orderedData.map((d) => d.total);
    const max = Math.max(...values, 1);
    const stepX = chartWidth / Math.max(orderedData.length - 1, 1);
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
      <View style={[styles.container, { height }]}>
        <Svg width={chartWidth} height={height}>
          <Rect x={0} y={0} width={chartWidth} height={height} fill={theme.colors.canvas.surfaceMuted} rx={14} />
          <SvgText x={chartWidth / 2} y={height / 2} fill={theme.colors.text.muted} fontSize={12} fontWeight="700" textAnchor="middle">
            {t("driver.earningsEmptyTitle", "No earnings yet")}
          </SvgText>
        </Svg>
      </View>
    );
  }

  const barWidth = (chartWidth / orderedData.length) * 0.5;
  const barGap = (chartWidth / orderedData.length) * 0.5;

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={chartWidth} height={height}>
        <Rect x={0} y={0} width={chartWidth} height={height} fill={theme.colors.canvas.surfaceMuted} rx={14} />

        {orderedData.map((d, i) => {
          const barHeight = maxVal > 0 ? (d.total / maxVal) * (chartHeight - 8) : 0;
          const x = padding.left + i * (chartWidth / orderedData.length) + barGap / 2;
          const y = padding.top + chartHeight - barHeight;
          const isPeak = i === peakIndex;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, d.total > 0 ? 3 : 0)}
              rx={4}
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

        {orderedData.map((d, i) => {
          const x = padding.left + i * (chartWidth / orderedData.length) + (chartWidth / orderedData.length) / 2;
          const y = height - 8;
          return (
            <SvgText
              key={i}
              x={x}
              y={y}
              fill={theme.colors.text.muted}
              fontSize={10}
              fontWeight="700"
              textAnchor="middle"
            >
              {dayLabel(d.date, t, locale)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// Exported so the screen can show "best day: {label} — {amount}" as real
// text (not baked into the SVG, so it stays accessible/selectable).
export function bestDayFromWeek(data: DailyEarning[]): { label: string; total: number } | null {
  if (data.length === 0) return null;
  const best = data.reduce((max, d) => (d.total > max.total ? d : max), data[0]);
  if (best.total <= 0) return null;
  return { label: best.date.toDateString(), total: best.total };
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
