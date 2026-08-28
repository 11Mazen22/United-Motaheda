/**
 * AnalyticsDashboardScreen — live KPI dashboard for the pharmacist.
 *
 * Sections:
 *   1. Today's headline metrics (orders, revenue, cancellations)
 *   2. Order funnel — count per status in the active queue
 *   3. Prescription pipeline — pending / approved / rejected today
 *   4. Inventory health — low-stock count, out-of-stock count
 *   5. Hourly order bar chart (lightweight SVG-free bar built with Box)
 *
 * Data sources: all existing pharmacist API queries — no new endpoints needed.
 * Auto-refreshes every 60 s (matches usePharmacistDashboard refetchInterval).
 *
 * Header uses the shared brand gradient token (previously a flat single
 * colour repeated twice, which read as a plain bar rather than the gradient
 * hero every other pharmacist screen uses) for visual consistency across
 * the whole persona.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, useTheme, kit } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";

import { usePharmacistDashboard, usePharmacistOrderQueue, usePrescriptionStatusCounts, useTodayOrdersForAnalytics } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Metric row ──────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  icon,
  iconColor,
  iconBg,
  caption,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  iconBg?: string;
  caption?: string;
}) {
  const { theme } = useTheme();
  const resolvedIconColor = iconColor ?? theme.colors.brand.primary;
  const resolvedIconBg = iconBg ?? theme.colors.brand.primaryLight;
  const mrStyles = useMemo(() => StyleSheet.create({
    root: { alignItems: "center", gap: 12, paddingVertical: 8 },
    iconWell: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    value: { fontSize: 16, fontFamily: "Cairo_900Black", color: theme.colors.text.primary, flexShrink: 0 },
  }), [theme]);

  return (
    <View style={[mrStyles.root, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[mrStyles.iconWell, { backgroundColor: resolvedIconBg }]}>
        <Ionicons name={icon} size={16} color={resolvedIconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }} numberOfLines={1}>
          {label}
        </UIText>
        {caption && (
          <UIText variant="caption" color="muted" style={{ textAlign: TEXT_START }} numberOfLines={1}>
            {caption}
          </UIText>
        )}
      </View>
      <UIText style={mrStyles.value}>{value}</UIText>
    </View>
  );
}

// ─── Section card ────────────────────────────────────────────────────────────

function Section({
  title, icon, children, delay = 0,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  delay?: number;
}) {
  const { theme } = useTheme();
  const scStyles = useMemo(() => StyleSheet.create({
    root: {
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      ...theme.shadows[1],
    },
    header: {
      alignItems: "center",
      gap: 10,
      paddingHorizontal: kit.inset.card,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border.default,
    },
    iconWell: {
      width: 28, height: 28, borderRadius: 9,
      backgroundColor: theme.colors.brand.primaryLight,
      alignItems: "center", justifyContent: "center",
    },
    body: {
      paddingHorizontal: kit.inset.card,
      paddingBottom: kit.inset.card,
    },
  }), [theme]);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={scStyles.root}>
      <View style={[scStyles.header, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={scStyles.iconWell}>
          <Ionicons name={icon} size={14} color={theme.colors.brand.primary} />
        </View>
        <UIText variant="card-title" style={{ textAlign: TEXT_START, flex: 1, minWidth: 0 }}>{title}</UIText>
      </View>
      <View style={scStyles.body}>{children}</View>
    </Animated.View>
  );
}

// ─── Simple bar chart ────────────────────────────────────────────────────────

function MiniBarChart({
  data,
  label,
}: {
  data: number[];
  label: string;
}) {
  const { theme } = useTheme();
  const bcStyles = useMemo(() => StyleSheet.create({
    root: { marginTop: 10 },
    bars: { alignItems: "flex-end", gap: 4, height: 60 },
    barCol: { flex: 1, alignItems: "center", gap: 3 },
    barTrack: { flex: 1, width: "80%", backgroundColor: theme.colors.canvas.surfaceMuted, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
    barFill: { backgroundColor: theme.colors.brand.primary, borderRadius: 4 },
    barLabel: { fontSize: 8, fontFamily: "Cairo_700Bold", color: theme.colors.text.muted },
  }), [theme]);

  const max = Math.max(...data, 1);
  return (
    <View style={bcStyles.root}>
      <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginBottom: 8 }}>
        {label}
      </UIText>
      <View style={[bcStyles.bars, { flexDirection: flexRow(IS_RTL) }]}>
        {data.map((v, i) => (
          <View key={i} style={bcStyles.barCol}>
            <View style={bcStyles.barTrack}>
              <View style={[bcStyles.barFill, { height: `${Math.round((v / max) * 100)}%` as `${number}%` }]} />
            </View>
            <UIText style={bcStyles.barLabel}>{i + 8}h</UIText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── BigKpi card ─────────────────────────────────────────────────────────────

function BigKpi({
  value, label, icon, iconColor, iconBg,
}: {
  value: number | string; label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string; iconBg: string;
}) {
  const { theme } = useTheme();
  const bkStyles = useMemo(() => StyleSheet.create({
    card: {
      flex: 1, minWidth: 0, backgroundColor: theme.colors.canvas.surface, borderRadius: 16,
      padding: 16, gap: 8, borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1],
    },
    iconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    value: { fontSize: 24, lineHeight: 30, fontFamily: "Cairo_900Black", color: theme.colors.text.primary, includeFontPadding: false },
    label: { fontSize: 12, fontFamily: "Cairo_700Bold", color: theme.colors.text.secondary, textAlign: TEXT_START, includeFontPadding: false },
  }), [theme]);

  return (
    <View style={bkStyles.card}>
      <View style={[bkStyles.iconWell, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <UIText style={bkStyles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</UIText>
      <UIText style={bkStyles.label} numberOfLines={1}>{label}</UIText>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function AnalyticsDashboardScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { pagePad, isTablet } = useScreenLayout();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerGradient: { overflow: "hidden" },
    headerInner: {
      paddingHorizontal: pagePad,
      paddingVertical: 18,
      gap: 4,
    },
    headerTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontFamily: "Cairo_900Black",
      color: "#FFFFFF",
      letterSpacing: -0.3,
      textAlign: TEXT_START,
      includeFontPadding: false,
    },
    headerSub: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: "Cairo_400Regular",
      color: "rgba(255,255,255,0.75)",
      textAlign: TEXT_START,
      includeFontPadding: false,
    },
    scroll: { paddingHorizontal: pagePad, paddingBottom: 60, gap: 14, paddingTop: 8 },
    scrollTablet: { maxWidth: 720, alignSelf: "center", width: "100%" },
    kpiRow: { flexDirection: flexRow(IS_RTL), gap: 10, marginHorizontal: 0 },
    funnelRow: { alignItems: "center", gap: 10, paddingVertical: 8 },
    funnelDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    funnelCount: { fontSize: 16, fontFamily: "Cairo_900Black", flexShrink: 0 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginVertical: 2 },
  }), [theme, pagePad]);

  const dashboardQuery = usePharmacistDashboard();
  const queueQuery = usePharmacistOrderQueue();
  const rxCountsQuery = usePrescriptionStatusCounts();
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayOrdersQuery = useTodayOrdersForAnalytics(todayISO);

  const stats = dashboardQuery.data;
  const orders = queueQuery.data ?? [];
  // Today's revenue and hourly volume must reflect every order placed today,
  // not just the ones still sitting in the pre-dispatch queue — orders.ts's
  // getTodayOrdersForAnalytics covers the full day regardless of status, so
  // an order dispatched to a driver still counts here.
  const todayOrders = todayOrdersQuery.data ?? [];

  const queueRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);

  const rxCounts = rxCountsQuery.data;
  const rxPending = rxCounts?.pending ?? 0;
  const rxApproved = rxCounts?.approved ?? 0;
  const rxRejected = rxCounts?.rejected ?? 0;

  const hourlyData = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 8;
    return todayOrders.filter((o) => new Date(o.createdAt).getHours() === hour).length;
  });

  const funnelData: { status: string; count: number; color: string }[] = [
    { status: t("pharmacist.statusPending"), count: orders.filter((o) => o.status === "pending").length, color: theme.colors.status.warning },
    { status: t("pharmacist.statusVerification"), count: orders.filter((o) => o.status === "verification").length, color: theme.colors.brand.primary },
    { status: t("pharmacist.statusPaymentPending"), count: orders.filter((o) => o.status === "payment_pending").length, color: theme.colors.brand.primary },
    { status: t("pharmacist.statusPaymentApproved"), count: orders.filter((o) => o.status === "payment_approved").length, color: theme.colors.status.success },
    { status: t("pharmacist.statusPreparing"), count: orders.filter((o) => o.status === "preparing").length, color: theme.colors.brand.primary },
    { status: t("pharmacist.statusReady"), count: orders.filter((o) => o.status === "ready").length, color: theme.colors.brand.primary },
  ].filter((d) => d.count > 0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
        queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const isLoading = dashboardQuery.isLoading || queueQuery.isLoading || rxCountsQuery.isLoading || todayOrdersQuery.isLoading;

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      {/* Header — the real brand gradient token (matches Workbench/Orders),
          not a flat colour repeated twice. */}
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerInner}>
          <UIText style={styles.headerTitle}>
            {t("pharmacist.analyticsTitle", "لوحة التحليلات")}
          </UIText>
          <UIText style={styles.headerSub}>
            {t("pharmacist.analyticsSubtitle", "تحديث تلقائي كل دقيقة")}
          </UIText>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.brand.primary}
            />
          }
        >
          {/* Headline KPIs — 2×2 */}
          <Animated.View entering={FadeInDown.delay(0).duration(280)} style={styles.kpiRow}>
            <BigKpi
              value={stats?.activeOrders ?? 0}
              label={t("pharmacist.statActiveOrders")}
              icon="bag-handle-outline"
              iconColor={theme.colors.brand.primary}
              iconBg={theme.colors.brand.primaryLight}
            />
            <BigKpi
              value={formatPrice(queueRevenue)}
              label={t("pharmacist.analyticsRevenue", "قيمة الطلبات")}
              icon="cash-outline"
              iconColor={theme.colors.status.success}
              iconBg={`${theme.colors.status.success}1A`}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(40).duration(280)} style={[styles.kpiRow, { marginTop: 10 }]}>
            <BigKpi
              value={stats?.deliveredToday ?? 0}
              label={t("pharmacist.analyticsDeliveredToday", "تم التوصيل اليوم")}
              icon="checkmark-circle-outline"
              iconColor={theme.colors.status.success}
              iconBg={`${theme.colors.status.success}1A`}
            />
            <BigKpi
              value={stats?.cancelledToday ?? 0}
              label={t("pharmacist.analyticsCancelledToday", "ملغاة اليوم")}
              icon="close-circle-outline"
              iconColor={theme.colors.status.error}
              iconBg={`${theme.colors.status.error}1A`}
            />
          </Animated.View>

          {/* Order funnel */}
          {funnelData.length > 0 && (
            <Section
              title={t("pharmacist.analyticsFunnel", "توزيع الطلبات حسب الحالة")}
              icon="git-branch-outline"
              delay={80}
            >
              {funnelData.map((d, i) => (
                <View key={d.status}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={[styles.funnelRow, { flexDirection: flexRow(IS_RTL) }]}>
                    <View style={[styles.funnelDot, { backgroundColor: d.color }]} />
                    <UIText variant="body-sm" style={{ flex: 1, minWidth: 0, textAlign: TEXT_START }} numberOfLines={1}>
                      {d.status}
                    </UIText>
                    <UIText style={[styles.funnelCount, { color: d.color }]}>{d.count}</UIText>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {/* Prescription pipeline */}
          <Section
            title={t("pharmacist.analyticsPrescriptions", "حالة الوصفات")}
            icon="document-text-outline"
            delay={120}
          >
            <MetricRow label={t("pharmacist.rxPending")} value={rxPending} icon="time-outline" iconColor={theme.colors.status.warning} iconBg={`${theme.colors.status.warning}1A`} />
            <View style={styles.divider} />
            <MetricRow label={t("pharmacist.rxApproved")} value={rxApproved} icon="checkmark-circle-outline" iconColor={theme.colors.status.success} iconBg={`${theme.colors.status.success}1A`} />
            <View style={styles.divider} />
            <MetricRow label={t("pharmacist.rxRejected")} value={rxRejected} icon="close-circle-outline" iconColor={theme.colors.status.error} iconBg={`${theme.colors.status.error}1A`} />
          </Section>

          {/* Inventory health */}
          <Section
            title={t("pharmacist.analyticsInventory", "صحة المخزون")}
            icon="cube-outline"
            delay={160}
          >
            <MetricRow
              label={t("pharmacist.statLowStock")}
              value={stats?.lowStockCount ?? 0}
              icon="alert-circle-outline"
              iconColor={theme.colors.status.error}
              iconBg={`${theme.colors.status.error}1A`}
              caption={t("pharmacist.analyticsLowStockCaption", "مخزون أقل من 5 وحدات")}
            />
          </Section>

          {/* Hourly bar chart */}
          {hourlyData.some((v) => v > 0) && (
            <Section
              title={t("pharmacist.analyticsHourly", "الطلبات حسب الساعة (اليوم)")}
              icon="time-outline"
              delay={200}
            >
              <MiniBarChart
                data={hourlyData}
                label={t("pharmacist.analyticsHourlyLabel", "عدد الطلبات من 8ص حتى 10م")}
              />
            </Section>
          )}

          <UIText variant="caption" color="muted" style={{ textAlign: "center", marginTop: 8 }}>
            {t("pharmacist.analyticsLastUpdated", "آخر تحديث: الآن")}
          </UIText>
        </ScrollView>
      )}
    </Screen>
  );
}
