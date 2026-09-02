/**
 * DriverEarningsScreen — real earnings history and breakdown.
 *
 * The backend (DriverEarning table, listMyEarnings()) already tracks the
 * full breakdown per delivery -- base fee, distance fee, tip, bonus, paid
 * status -- but nothing in the app ever surfaced it beyond a single "today's
 * total" number on the dashboard. Standard gig-app feature (Uber/Careem-
 * style earnings history) that was fully wired on the data side and simply
 * never got a screen.
 */
import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, Card, Chip, EmptyState, SkeletonCard, Button, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { fmtN } from "@/utils/format";
import { useMyDriverProfile, useMyEarnings } from "../hooks/useDriverProfile";
import { computeWeeklyEarnings, computeStreakDays } from "../lib/driverMetrics";
import { WeeklyEarningsChart } from "../components/WeeklyEarningsChart";
import type { DriverEarningRecord } from "../api";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Period = "today" | "week" | "all";

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function groupByDay(records: DriverEarningRecord[]): { key: string; date: Date; items: DriverEarningRecord[]; total: number }[] {
  const map = new Map<string, DriverEarningRecord[]>();
  for (const r of records) {
    const k = dayKey(r.earnedAt);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      date: new Date(items[0].earnedAt),
      items,
      total: items.reduce((sum, i) => sum + i.totalAmount, 0),
    }));
}

function formatDayLabel(date: Date, t: ReturnType<typeof useTranslation>["t"], locale: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return t("driver.earningsToday", "Today");
  if (isSameDay(date, yesterday)) return t("driver.earningsYesterday", "Yesterday");
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
}

function EarningRow({ record, theme }: { record: DriverEarningRecord; theme: NativeTheme }) {
  const { t } = useTranslation();
  const breakdown = [
    { key: "base", value: record.baseFee, label: t("driver.earningsBaseFee", "Base fee") },
    { key: "distance", value: record.distanceFee, label: t("driver.earningsDistanceFee", "Distance") },
    { key: "tip", value: record.tipAmount, label: t("driver.earningsTip", "Tip") },
    { key: "bonus", value: record.bonusAmount, label: t("driver.earningsBonus", "Bonus") },
  ].filter((b) => b.value > 0);

  return (
    <View style={[s.row, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
      <View style={[s.rowTop, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[s.rowIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
          <Ionicons name="bicycle-outline" size={16} color={theme.colors.brand.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UIText variant="card-title" numberOfLines={1} style={{ textAlign: TEXT_START }}>#{record.deliveryId.slice(-8).toUpperCase()}</UIText>
          {breakdown.length > 0 && (
            <UIText variant="caption" color="secondary" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 1 }}>
              {breakdown.map((b) => `${b.label} ${formatPrice(b.value)}`).join(" · ")}
            </UIText>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <UIText variant="card-title" weight="black" style={{ color: theme.colors.brand.primary }}>{formatPrice(record.totalAmount)}</UIText>
          <View style={[s.paidPill, { backgroundColor: record.isPaid ? theme.colors.statusSoft.success.bg : theme.colors.statusSoft.warning.bg }]}>
            <UIText variant="eyebrow" style={{ color: record.isPaid ? theme.colors.statusSoft.success.text : theme.colors.statusSoft.warning.text }}>
              {record.isPaid ? t("driver.earningsPaid", "Paid") : t("driver.earningsPending", "Pending")}
            </UIText>
          </View>
        </View>
      </View>
    </View>
  );
}

export function DriverEarningsScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { pagePad, isTablet } = useScreenLayout();
  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";
  const [period, setPeriod] = useState<Period>("week");
  const [refreshing, setRefreshing] = useState(false);

  const profileQuery = useMyDriverProfile(user?.id);
  const earningsQuery = useMyEarnings(profileQuery.data?.id);
  const all = earningsQuery.data ?? [];

  const filtered = useMemo(() => {
    if (period === "all") return all;
    const now = Date.now();
    const cutoff = period === "today" ? new Date().setHours(0, 0, 0, 0) : now - 7 * 86_400_000;
    return all.filter((r) => new Date(r.earnedAt).getTime() >= cutoff);
  }, [all, period]);

  const totalAmount = filtered.reduce((sum, r) => sum + r.totalAmount, 0);
  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  // Weekly trend is always the real last 7 days regardless of the active
  // filter chip -- "how am I trending" is a fixed-window question, not one
  // that should reset to a single bar when the driver taps "Today".
  const weeklyChartData = useMemo(
    () => computeWeeklyEarnings(all).map((d) => ({ date: new Date(d.date), total: d.total })),
    [all],
  );
  const streakDays = useMemo(() => computeStreakDays(all), [all]);

  // Breakdown DOES respect the active filter -- "where did this week's
  // money come from" is naturally scoped to whatever period is selected.
  const breakdown = useMemo(() => {
    const totals = { base: 0, distance: 0, tip: 0, bonus: 0 };
    for (const r of filtered) {
      totals.base += r.baseFee;
      totals.distance += r.distanceFee;
      totals.tip += r.tipAmount;
      totals.bonus += r.bonusAmount;
    }
    return [
      { key: "base", value: totals.base, label: t("driver.earningsBaseFee", "Base fee"), icon: "bicycle-outline" as const },
      { key: "distance", value: totals.distance, label: t("driver.earningsDistanceFee", "Distance"), icon: "navigate-outline" as const },
      { key: "tip", value: totals.tip, label: t("driver.earningsTip", "Tip"), icon: "heart-outline" as const },
      { key: "bonus", value: totals.bonus, label: t("driver.earningsBonus", "Bonus"), icon: "gift-outline" as const },
    ].filter((b) => b.value > 0);
  }, [filtered, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([profileQuery.refetch(), earningsQuery.refetch()]);
    setRefreshing(false);
  };

  const isLoading = profileQuery.isLoading || earningsQuery.isLoading;
  const isError = profileQuery.isError || earningsQuery.isError;

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingHorizontal: pagePad }]}
      >
        <View style={[s.heroTopRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="eyebrow" style={s.heroEyebrow}>{t("driver.earningsEyebrow", "Your Earnings")}</UIText>
            <UIText variant="screen-title" style={{ color: "#fff" }}>{t("driver.earningsTitle", "Earnings")}</UIText>
          </View>
          <View style={s.heroIconWell}>
            <Ionicons name="wallet" size={20} color="#fff" />
          </View>
        </View>

        <UIText style={s.heroTotal} numberOfLines={1}>{formatPrice(totalAmount)}</UIText>

        <View style={[s.statsRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.statCell}>
            <UIText style={s.statVal}>{fmtN(filtered.length)}</UIText>
            <UIText style={s.statLbl} numberOfLines={1}>{t("driver.earningsDeliveriesLabel", "Deliveries")}</UIText>
          </View>
          <View style={s.statCell}>
            <UIText style={s.statVal}>{filtered.length > 0 ? formatPrice(totalAmount / filtered.length) : "—"}</UIText>
            <UIText style={s.statLbl} numberOfLines={1}>{t("driver.earningsAvgLabel", "Avg / delivery")}</UIText>
          </View>
        </View>

        {streakDays > 1 && (
          <View style={[s.streakPill, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="flame" size={14} color="#FFD166" />
            <UIText style={s.streakText}>
              {t("driver.earningsStreak", "{{count}}-day streak", { count: streakDays })}
            </UIText>
          </View>
        )}
      </LinearGradient>

      <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL), paddingHorizontal: pagePad }]}>
        <Chip label={t("driver.earningsFilterToday", "Today")} selected={period === "today"} selectable onPress={() => setPeriod("today")} />
        <Chip label={t("driver.earningsFilterWeek", "This week")} selected={period === "week"} selectable onPress={() => setPeriod("week")} />
        <Chip label={t("driver.earningsFilterAll", "All time")} selected={period === "all"} selectable onPress={() => setPeriod("all")} />
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: pagePad, gap: 10 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : isError ? (
        <View style={{ paddingHorizontal: pagePad, paddingTop: 60, alignItems: "center" }}>
          <UIText variant="h6" style={{ textAlign: "center", marginBottom: 8 }}>{t("errors.network")}</UIText>
          <Button label={t("common.retry")} onPress={onRefresh} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(sec) => sec.key}
          contentContainerStyle={[
            s.listContent,
            { paddingHorizontal: pagePad },
            isTablet && { maxWidth: 720, alignSelf: "center", width: "100%" },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          renderItem={({ item: sec, index: secIndex }) => (
            <View style={{ marginBottom: 18 }}>
              <View style={[s.dayHeader, { flexDirection: flexRow(IS_RTL) }]}>
                <UIText variant="card-title" style={{ textAlign: TEXT_START }}>{formatDayLabel(sec.date, t, locale)}</UIText>
                <UIText variant="caption" weight="bold" style={{ color: theme.colors.brand.primaryDark }}>{formatPrice(sec.total)}</UIText>
              </View>
              <View style={{ gap: 8 }}>
                {sec.items.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(secIndex * 3 + i, 10) * 40).duration(240)}>
                    <EarningRow record={r} theme={theme} />
                  </Animated.View>
                ))}
              </View>
            </View>
          )}
          ListHeaderComponent={
            <View style={{ gap: 14, marginBottom: 20 }}>
              <Card padding="md" elevation="sm">
                <UIText variant="eyebrow" color="tertiary" style={{ textAlign: TEXT_START, marginBottom: 10 }}>
                  {t("driver.earningsWeeklyTrend", "Last 7 days")}
                </UIText>
                <WeeklyEarningsChart data={weeklyChartData} />
              </Card>

              {breakdown.length > 0 && (
                <Card padding="md" elevation="sm">
                  <UIText variant="eyebrow" color="tertiary" style={{ textAlign: TEXT_START, marginBottom: 10 }}>
                    {t("driver.earningsBreakdownTitle", "Where it came from")}
                  </UIText>
                  <View style={{ gap: 10 }}>
                    {breakdown.map((b) => {
                      const pct = totalAmount > 0 ? Math.round((b.value / totalAmount) * 100) : 0;
                      return (
                        <View key={b.key} style={[s.breakdownRow, { flexDirection: flexRow(IS_RTL) }]}>
                          <View style={[s.breakdownIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
                            <Ionicons name={b.icon} size={14} color={theme.colors.brand.primaryDark} />
                          </View>
                          <UIText variant="body-sm" style={{ flex: 1, minWidth: 0, textAlign: TEXT_START }} numberOfLines={1}>
                            {b.label}
                          </UIText>
                          <View style={[s.breakdownTrack, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                            <View style={[s.breakdownFill, { width: `${pct}%`, backgroundColor: theme.colors.brand.primary }]} />
                          </View>
                          <UIText variant="body-sm" weight="bold" style={{ width: 68, textAlign: IS_RTL ? "left" : "right" }} numberOfLines={1}>
                            {formatPrice(b.value)}
                          </UIText>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title={t("driver.earningsEmptyTitle", "No earnings yet")}
              subtitle={t("driver.earningsEmptySubtitle", "Completed deliveries will show up here with a full breakdown.")}
            />
          }
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 12, paddingBottom: 18, gap: 4 },
  heroTopRow: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroEyebrow: { color: "rgba(255,255,255,0.78)", letterSpacing: 1, marginBottom: 2 },
  heroIconWell: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", flexShrink: 0 },
  heroTotal: { fontSize: 36, lineHeight: 42, fontWeight: "900", color: "#fff", marginTop: 6 },
  statsRow: { gap: 10, marginTop: 16 },
  statCell: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", gap: 2 },
  statVal: { fontSize: 17, fontWeight: "800", color: "#fff" },
  streakPill: {
    alignSelf: "flex-start",
    alignItems: "center", gap: 6,
    marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(255,209,102,0.18)",
  },
  streakText: { fontSize: 12, fontWeight: "800", color: "#FFD166" },
  breakdownRow: { alignItems: "center", gap: 8 },
  breakdownIcon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  breakdownTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  breakdownFill: { height: "100%", borderRadius: 3 },
  statLbl: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.8)", textAlign: "center" },
  filterRow: { gap: 8, paddingVertical: 12 },
  listContent: { paddingBottom: 48 },
  dayHeader: { alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  row: { borderRadius: 14, borderWidth: 1, padding: 12 },
  rowTop: { alignItems: "center", gap: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  paidPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, marginTop: 3 },
});
