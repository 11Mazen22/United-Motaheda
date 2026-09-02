/**
 * DriverEarningsScreen — real earnings history and breakdown.
 *
 * Backed by DriverEarning (posted by post_driver_earning_on_delivery the
 * moment an order reaches 'delivered' with an assigned driver) and that same
 * trigger's DriverProfile aggregate updates (totalEarnings, totalDeliveries,
 * completionRate) -- both written in one transaction, so the lifetime
 * figures shown here can never drift from the per-delivery rows below them.
 */
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { gradients, theme as legacyTheme } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, Card, Chip, EmptyState, SkeletonCard, Button, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice, fmtN } from "@/utils/format";
import { useCountUp } from "@/shared/hooks/useCountUp";
import { useMyDriverProfile, useMyEarnings } from "../hooks/useDriverProfile";
import { computeWeeklyEarnings, computeStreakDays } from "../lib/driverMetrics";
import { WeeklyEarningsChart, bestDayFromWeek } from "../components/WeeklyEarningsChart";
import { EarningsBreakdownDonut } from "../components/EarningsBreakdownDonut";
import type { DriverEarningRecord } from "../api";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Period = "today" | "week" | "all";

const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000];
function nextMilestone(count: number): { target: number; remaining: number } | null {
  const next = MILESTONES.find((m) => m > count);
  return next ? { target: next, remaining: next - count } : null;
}

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
      <View style={[s.rowAccent, { backgroundColor: theme.colors.brand.primary }]} />
      <View style={[s.rowTop, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[s.rowIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
          <Ionicons name="bicycle-outline" size={16} color={theme.colors.brand.primaryDark} />
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
          <UIText variant="card-title" weight="black" style={{ color: theme.colors.brand.primaryDark }}>{formatPrice(record.totalAmount)}</UIText>
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

function InsightCard({
  icon, label, value, sub, theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  sub?: string;
  theme: NativeTheme;
}) {
  return (
    <View style={[s.insightCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
      <View style={[s.insightIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
        <Ionicons name={icon} size={16} color={theme.colors.brand.primaryDark} />
      </View>
      <UIText variant="caption" color="secondary" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 8 }}>{label}</UIText>
      <UIText variant="card-title" weight="black" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 2 }}>{value}</UIText>
      {sub ? <UIText variant="eyebrow" color="muted" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 2 }}>{sub}</UIText> : null}
    </View>
  );
}

function MilestoneCard({
  totalDeliveries, theme, t,
}: {
  totalDeliveries: number;
  theme: NativeTheme;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const milestone = nextMilestone(totalDeliveries);
  return (
    <View style={[s.insightCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
      <View style={[s.insightIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
        <Ionicons name="flag-outline" size={16} color={theme.colors.brand.primaryDark} />
      </View>
      <UIText variant="caption" color="secondary" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 8 }}>
        {t("driver.earningsInsightNextMilestone", "Next milestone")}
      </UIText>
      {milestone ? (
        <>
          <UIText variant="card-title" weight="black" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 2 }}>
            {milestone.target}
          </UIText>
          <UIText variant="eyebrow" color="muted" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 2 }}>
            {t("driver.earningsMilestoneRemaining", "{{count}} to go", { count: milestone.remaining })}
          </UIText>
          <View style={[s.milestoneTrack, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
            <View style={[s.milestoneFill, { width: `${Math.min(100, (totalDeliveries / milestone.target) * 100)}%`, backgroundColor: theme.colors.brand.primary }]} />
          </View>
        </>
      ) : (
        <UIText variant="card-title" weight="black" numberOfLines={2} style={{ textAlign: TEXT_START, marginTop: 2 }}>
          {t("driver.earningsMilestoneAllReached", "All milestones reached")}
        </UIText>
      )}
    </View>
  );
}

export function DriverEarningsScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
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
  const animatedTotal = useCountUp(totalAmount);
  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  // Paid/pending always splits the SAME totalAmount shown above (scoped to
  // the active filter), so the two figures below always sum back to it --
  // "how much of this period's total is still owed to me" rather than a
  // second, differently-scoped number sitting next to the first.
  const paidTotal = useMemo(() => filtered.filter((r) => r.isPaid).reduce((sum, r) => sum + r.totalAmount, 0), [filtered]);
  const pendingTotal = totalAmount - paidTotal;

  // Weekly trend, streak, and every "lifetime" figure below are always the
  // real all-time picture regardless of the active filter chip -- "how am I
  // trending" and "how many have I ever done" are fixed-window questions,
  // not ones that should reset to a single bar when the driver taps "Today".
  const weeklyChartData = useMemo(
    () => computeWeeklyEarnings(all).map((d) => ({ date: new Date(d.date), total: d.total })),
    [all],
  );
  const streakDays = useMemo(() => computeStreakDays(all), [all]);
  const bestDay = useMemo(() => bestDayFromWeek(weeklyChartData), [weeklyChartData]);

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
      { key: "base", value: totals.base, label: t("driver.earningsBaseFee", "Base fee"), icon: "bicycle-outline" as const, color: theme.colors.brand.primary },
      { key: "distance", value: totals.distance, label: t("driver.earningsDistanceFee", "Distance"), icon: "navigate-outline" as const, color: theme.colors.brand.primaryDark },
      { key: "tip", value: totals.tip, label: t("driver.earningsTip", "Tip"), icon: "heart-outline" as const, color: theme.colors.status.success },
      { key: "bonus", value: totals.bonus, label: t("driver.earningsBonus", "Bonus"), icon: "gift-outline" as const, color: "#FFD166" },
    ].filter((b) => b.value > 0);
  }, [filtered, t, theme]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([profileQuery.refetch(), earningsQuery.refetch()]);
    setRefreshing(false);
  };

  const isLoading = profileQuery.isLoading || earningsQuery.isLoading;
  const isError = profileQuery.isError || earningsQuery.isError;
  const totalDeliveries = profileQuery.data?.totalDeliveries ?? 0;
  const lifetimeEarnings = profileQuery.data?.totalEarnings ?? 0;

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingHorizontal: pagePad }]}
      >
        <Animated.View entering={FadeIn.duration(280)}>
          <View style={[s.heroTopRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable
              onPress={() => router.back()}
              style={s.heroIconWell}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              hitSlop={8}
            >
              <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={20} color="#fff" />
            </Pressable>
            <UIText style={s.heroTitle} numberOfLines={1}>{t("driver.earningsTitle", "Earnings")}</UIText>
            <View style={s.heroIconWell}>
              <Ionicons name="wallet" size={18} color="#fff" />
            </View>
          </View>

          <UIText style={s.heroTotal} numberOfLines={1}>{formatPrice(Math.round(animatedTotal))}</UIText>

          <View style={[s.splitRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.splitCell}>
              <View style={[s.splitDot, { backgroundColor: "#FFD166" }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <UIText style={s.splitVal} numberOfLines={1}>{formatPrice(pendingTotal)}</UIText>
                <UIText style={s.splitLbl} numberOfLines={1}>{t("driver.earningsPending", "Pending")}</UIText>
              </View>
            </View>
            <View style={s.splitCell}>
              <View style={[s.splitDot, { backgroundColor: "#7FE8B8" }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <UIText style={s.splitVal} numberOfLines={1}>{formatPrice(paidTotal)}</UIText>
                <UIText style={s.splitLbl} numberOfLines={1}>{t("driver.earningsPaid", "Paid")}</UIText>
              </View>
            </View>
          </View>

          <View style={[s.metaRow, { flexDirection: flexRow(IS_RTL) }]}>
            <UIText style={s.metaText} numberOfLines={1}>
              {t("driver.earningsMetaSummary", "{{count}} deliveries · avg {{amount}}", {
                count: filtered.length,
                amount: filtered.length > 0 ? formatPrice(totalAmount / filtered.length) : formatPrice(0),
              })}
            </UIText>
            {streakDays > 1 && (
              <View style={[s.streakPill, { flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="flame" size={12} color="#FFD166" />
                <UIText style={s.streakText}>
                  {t("driver.earningsStreak", "{{count}}-day streak", { count: streakDays })}
                </UIText>
              </View>
            )}
          </View>
        </Animated.View>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: flexRow(IS_RTL), gap: 10, paddingEnd: pagePad - 16 }}
              >
                <InsightCard
                  theme={theme}
                  icon="trophy-outline"
                  label={t("driver.earningsInsightBestDay", "Best day")}
                  value={bestDay ? formatDayLabel(bestDay.date, t, locale) : t("driver.earningsNoDataYet", "Not yet")}
                  sub={bestDay ? formatPrice(bestDay.total) : undefined}
                />
                <InsightCard
                  theme={theme}
                  icon="infinite-outline"
                  label={t("driver.lifetimeEarnings", "Lifetime earnings")}
                  value={formatPrice(lifetimeEarnings)}
                />
                <InsightCard
                  theme={theme}
                  icon="bicycle-outline"
                  label={t("driver.earningsInsightLifetimeDeliveries", "Lifetime deliveries")}
                  value={fmtN(totalDeliveries)}
                />
                <MilestoneCard theme={theme} t={t} totalDeliveries={totalDeliveries} />
              </ScrollView>

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
                  <View style={[s.breakdownLayout, { flexDirection: flexRow(IS_RTL) }]}>
                    <EarningsBreakdownDonut items={breakdown} total={totalAmount} />
                    <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                      {breakdown.map((b) => {
                        const pct = totalAmount > 0 ? Math.round((b.value / totalAmount) * 100) : 0;
                        return (
                          <View key={b.key} style={[s.legendRow, { flexDirection: flexRow(IS_RTL) }]}>
                            <View style={[s.legendDot, { backgroundColor: b.color }]} />
                            <UIText variant="body-sm" style={{ flex: 1, minWidth: 0, textAlign: TEXT_START }} numberOfLines={1}>
                              {b.label}
                            </UIText>
                            <UIText variant="caption" color="secondary" numberOfLines={1}>{pct}%</UIText>
                          </View>
                        );
                      })}
                    </View>
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
  heroIconWell: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", flexShrink: 0 },
  heroTitle: { flex: 1, minWidth: 0, textAlign: "center", fontSize: 17, lineHeight: 22, fontFamily: legacyTheme.fonts.extrabold, color: "#fff" },
  heroTotal: { fontSize: 38, lineHeight: 44, fontFamily: legacyTheme.fonts.black, color: "#fff", marginTop: 12, textAlign: TEXT_START },
  splitRow: { gap: 10, marginTop: 14 },
  splitCell: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.10)" },
  splitDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  splitVal: { fontSize: 13, lineHeight: 17, fontFamily: legacyTheme.fonts.extrabold, color: "#fff" },
  splitLbl: { fontSize: 10, lineHeight: 14, fontFamily: legacyTheme.fonts.bold, color: "rgba(255,255,255,0.78)" },
  metaRow: { alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  metaText: { flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 16, fontFamily: legacyTheme.fonts.bold, color: "rgba(255,255,255,0.82)", textAlign: TEXT_START },
  streakPill: {
    alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: "rgba(255,209,102,0.18)",
    flexShrink: 0,
  },
  streakText: { fontSize: 11, lineHeight: 15, fontFamily: legacyTheme.fonts.extrabold, color: "#FFD166" },
  filterRow: { gap: 8, paddingVertical: 12 },
  listContent: { paddingBottom: 48 },
  dayHeader: { alignItems: "center", justifyContent: "space-between", marginBottom: 8 },

  insightCard: { width: 140, padding: 12, borderRadius: 16, borderWidth: 1 },
  insightIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  milestoneTrack: { height: 5, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  milestoneFill: { height: "100%", borderRadius: 3 },

  breakdownLayout: { alignItems: "center", gap: 16 },
  legendRow: { alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  row: { borderRadius: 14, borderWidth: 1, padding: 12, overflow: "hidden" },
  rowAccent: { position: "absolute", top: 0, bottom: 0, start: 0, width: 4 },
  rowTop: { alignItems: "center", gap: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  paidPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, marginTop: 3 },
});
