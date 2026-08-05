/**
 * AnalyticsDashboardScreen — live KPI dashboard for the pharmacist.
 *
 * Sections:
 *   1. Today's headline metrics (orders, revenue, cancellations)
 *   2. Order funnel — count per status in the active queue
 *   3. Prescription pipeline — pending / approved / rejected today
 *   4. Inventory health — low-stock count, out-of-stock count
 *   5. Hourly order bar chart (lightweight SVG-free bar built with View)
 *
 * Data sources: all existing pharmacist API queries — no new endpoints needed.
 * Auto-refreshes every 60 s (matches usePharmacistDashboard refetchInterval).
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient }  from "expo-linear-gradient";
import { Ionicons }        from "@expo/vector-icons";
import { useTranslation }  from "react-i18next";
import { useQueryClient }  from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Screen, Text as UIText } from "@/shared/ui";
import { kit }                    from "@/shared/kit";
import { theme }                  from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }            from "@/utils/format";

import { usePharmacistDashboard, usePharmacistOrderQueue, useAllPrescriptions } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  icon,
  iconColor = kit.color.accentDeep,
  iconBg = kit.color.accentTint,
  caption,
}: {
  label:      string;
  value:      string | number;
  icon:       React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  iconBg?:    string;
  caption?:   string;
}) {
  return (
    <View style={[mr.root, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[mr.iconWell, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }}>
          {label}
        </UIText>
        {caption && (
          <UIText variant="caption" color="muted" style={{ textAlign: TEXT_START }}>
            {caption}
          </UIText>
        )}
      </View>
      <UIText style={mr.value}>{value}</UIText>
    </View>
  );
}

const mr = StyleSheet.create({
  root:    { alignItems: "center", gap: 12, paddingVertical: 8 },
  iconWell:{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  value:   { fontSize: 16, fontFamily: theme.fonts.black, color: kit.color.ink },
});

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  title, icon, children, delay = 0,
}: {
  title:    string;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  delay?:   number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={sc.root}>
      <View style={[sc.header, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={sc.iconWell}>
          <Ionicons name={icon} size={14} color={kit.color.accentDeep} />
        </View>
        <UIText variant="card-title" style={{ textAlign: TEXT_START }}>{title}</UIText>
      </View>
      <View style={sc.body}>{children}</View>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  root: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },
  header: {
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: kit.inset.card,
    paddingTop:        14,
    paddingBottom:     10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  iconWell: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: kit.color.accentTint,
    alignItems: "center", justifyContent: "center",
  },
  body: {
    paddingHorizontal: kit.inset.card,
    paddingBottom:     kit.inset.card,
  },
});

// ─── Simple bar chart ─────────────────────────────────────────────────────────

function MiniBarChart({
  data,
  label,
}: {
  data:  number[];
  label: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <View style={bc.root}>
      <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginBottom: 8 }}>
        {label}
      </UIText>
      <View style={[bc.bars, { flexDirection: flexRow(IS_RTL) }]}>
        {data.map((v, i) => (
          <View key={i} style={bc.barCol}>
            <View style={bc.barTrack}>
              <View
                style={[
                  bc.barFill,
                  { height: `${Math.round((v / max) * 100)}%` as `${number}%` },
                ]}
              />
            </View>
            <UIText style={bc.barLabel}>{i + 8}h</UIText>
          </View>
        ))}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  root:     { marginTop: 10 },
  bars:     { alignItems: "flex-end", gap: 4, height: 60 },
  barCol:   { flex: 1, alignItems: "center", gap: 3 },
  barTrack: { flex: 1, width: "80%", backgroundColor: kit.color.well, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill:  { backgroundColor: kit.color.accent, borderRadius: 4 },
  barLabel: { fontSize: 8, fontFamily: theme.fonts.bold, color: kit.color.inkFaint },
});

// ─── BigKpi card ─────────────────────────────────────────────────────────────

function BigKpi({
  value, label, icon, iconColor, iconBg,
}: {
  value: number | string; label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string; iconBg: string;
}) {
  return (
    <View style={bk.card}>
      <View style={[bk.iconWell, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <UIText style={bk.value}>{value}</UIText>
      <UIText style={bk.label}>{label}</UIText>
    </View>
  );
}

const bk = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: kit.color.surface, borderRadius: kit.radius.xl,
    padding: 16, gap: 8, borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.card,
  },
  iconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 28, lineHeight: 34, fontFamily: theme.fonts.black, color: kit.color.ink, includeFontPadding: false },
  label: { fontSize: 12, fontFamily: theme.fonts.bold, color: kit.color.inkSoft, textAlign: TEXT_START, includeFontPadding: false },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AnalyticsDashboardScreen(): React.ReactElement {
  const { t }       = useTranslation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const dashboardQuery = usePharmacistDashboard();
  const queueQuery     = usePharmacistOrderQueue();
  const rxQuery        = useAllPrescriptions();

  const stats  = dashboardQuery.data;
  const orders = queueQuery.data ?? [];
  const rxList = rxQuery.data ?? [];

  const queueRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  const rxPending  = rxList.filter((rx) => rx.reviewStatus === "pending_review").length;
  const rxApproved = rxList.filter((rx) => rx.reviewStatus === "approved").length;
  const rxRejected = rxList.filter((rx) => rx.reviewStatus === "rejected").length;

  const hourlyData = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 8;
    return orders.filter((o) => new Date(o.createdAt).getHours() === hour).length;
  });

  const funnelData: { status: string; count: number; color: string }[] = [
    { status: t("pharmacist.statusPending"),         count: orders.filter((o) => o.status === "pending").length,          color: kit.color.warn },
    { status: t("pharmacist.statusVerification"),    count: orders.filter((o) => o.status === "verification").length,     color: "#7C3AED"      },
    { status: t("pharmacist.statusPaymentPending"),  count: orders.filter((o) => o.status === "payment_pending").length,  color: "#B45309"      },
    { status: t("pharmacist.statusPaymentApproved"), count: orders.filter((o) => o.status === "payment_approved").length, color: kit.color.success },
    { status: t("pharmacist.statusPreparing"),       count: orders.filter((o) => o.status === "preparing").length,        color: kit.color.accentDeep },
    { status: t("pharmacist.statusReady"),           count: orders.filter((o) => o.status === "ready").length,            color: kit.color.accent },
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

  const isLoading = dashboardQuery.isLoading || queueQuery.isLoading;

  return (
    <Screen edgeTop background={kit.color.canvas}>
      {/* Header with teal gradient */}
      <LinearGradient
        colors={[kit.color.accentDeep, kit.color.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.headerGradient}
      >
        <View style={s.headerInner}>
          <UIText style={s.headerTitle}>
            {t("pharmacist.analyticsTitle", "لوحة التحليلات")}
          </UIText>
          <UIText style={s.headerSub}>
            {t("pharmacist.analyticsSubtitle", "تحديث تلقائي كل دقيقة")}
          </UIText>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={kit.color.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={kit.color.accent}
            />
          }
        >
          {/* ── Headline KPIs — 2×2 ─────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(0).duration(280)} style={s.kpiRow}>
            <BigKpi
              value={stats?.activeOrders ?? 0}
              label={t("pharmacist.statActiveOrders")}
              icon="bag-handle-outline"
              iconColor={kit.color.accentDeep}
              iconBg={kit.color.accentTint}
            />
            <BigKpi
              value={formatPrice(queueRevenue)}
              label={t("pharmacist.analyticsRevenue", "قيمة الطلبات")}
              icon="cash-outline"
              iconColor={kit.color.success}
              iconBg={kit.color.successTint}
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(40).duration(280)} style={[s.kpiRow, { marginTop: 10 }]}>
            <BigKpi
              value={stats?.deliveredToday ?? 0}
              label={t("pharmacist.statDeliveredToday", "تم التوصيل اليوم")}
              icon="checkmark-circle-outline"
              iconColor={kit.color.success}
              iconBg={kit.color.successTint}
            />
            <BigKpi
              value={stats?.cancelledToday ?? 0}
              label={t("pharmacist.statCancelledToday", "ملغاة اليوم")}
              icon="close-circle-outline"
              iconColor={kit.color.danger}
              iconBg={kit.color.dangerTint}
            />
          </Animated.View>

          {/* ── Order funnel ─────────────────────────────────────────── */}
          {funnelData.length > 0 && (
            <Section
              title={t("pharmacist.analyticsFunnel", "توزيع الطلبات حسب الحالة")}
              icon="git-branch-outline"
              delay={80}
            >
              {funnelData.map((d, i) => (
                <View key={d.status}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={[s.funnelRow, { flexDirection: flexRow(IS_RTL) }]}>
                    <View style={[s.funnelDot, { backgroundColor: d.color }]} />
                    <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
                      {d.status}
                    </UIText>
                    <UIText style={[s.funnelCount, { color: d.color }]}>{d.count}</UIText>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {/* ── Prescription pipeline ───────────────────────────────── */}
          <Section
            title={t("pharmacist.analyticsPrescriptions", "حالة الوصفات")}
            icon="document-text-outline"
            delay={120}
          >
            <MetricRow label={t("pharmacist.rxPending")}  value={rxPending}  icon="time-outline"             iconColor={kit.color.warn}    iconBg={kit.color.warnTint} />
            <View style={s.divider} />
            <MetricRow label={t("pharmacist.rxApproved")} value={rxApproved} icon="checkmark-circle-outline" iconColor={kit.color.success}  iconBg={kit.color.successTint} />
            <View style={s.divider} />
            <MetricRow label={t("pharmacist.rxRejected")} value={rxRejected} icon="close-circle-outline"     iconColor={kit.color.danger}   iconBg={kit.color.dangerTint} />
          </Section>

          {/* ── Inventory health ─────────────────────────────────────── */}
          <Section
            title={t("pharmacist.analyticsInventory", "صحة المخزون")}
            icon="cube-outline"
            delay={160}
          >
            <MetricRow
              label={t("pharmacist.statLowStock")}
              value={stats?.lowStockCount ?? 0}
              icon="alert-circle-outline"
              iconColor={kit.color.danger}
              iconBg={kit.color.dangerTint}
              caption={t("pharmacist.analyticsLowStockCaption", "مخزون أقل من 5 وحدات")}
            />
          </Section>

          {/* ── Hourly bar chart ─────────────────────────────────────── */}
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

          <UIText
            variant="caption"
            color="muted"
            style={{ textAlign: "center", marginTop: 8 }}
          >
            {t("pharmacist.analyticsLastUpdated", "آخر تحديث: الآن")}
          </UIText>
        </ScrollView>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  centered:       { flex: 1, alignItems: "center", justifyContent: "center" },
  headerGradient: { overflow: "hidden" },
  headerInner: {
    paddingHorizontal: kit.inset.screen,
    paddingVertical:   18,
    gap:               4,
  },
  headerTitle: {
    fontSize:           20,
    lineHeight:         26,
    fontFamily:         theme.fonts.black,
    color:              "#FFFFFF",
    letterSpacing:      -0.3,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  headerSub: {
    fontSize:           12,
    lineHeight:         16,
    fontFamily:         theme.fonts.regular,
    color:              "rgba(255,255,255,0.75)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  scroll:      { paddingHorizontal: kit.inset.screen, paddingBottom: 60, gap: 14, paddingTop: 8 },
  kpiRow:      { flexDirection: flexRow(IS_RTL), gap: 10, marginHorizontal: 0 },
  funnelRow:   { alignItems: "center", gap: 10, paddingVertical: 8 },
  funnelDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  funnelCount: { fontSize: 16, fontFamily: theme.fonts.black },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: kit.color.line, marginVertical: 2 },
});
