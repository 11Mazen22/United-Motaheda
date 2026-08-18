/**
 * WorkbenchScreen — pharmacist dashboard (2026 engineering quality pass).
 *
 * Improvements from previous version:
 *   • Unified 2×2 KPI grid — 4 cards in a single flexWrap grid
 *     instead of two disconnected 2-card rows
 *   • `deliveredToday` metric displayed — it was fetched but never shown
 *   • Prescription attention: uses danger color when pendingPrescriptions > 0,
 *     based purely on real backend data (no invented thresholds)
 *   • Skeleton KPI tiles replace '…' text during initial load
 *   • Compact header: live-status pill moved inline next to the greeting
 *     to reclaim ~20px of vertical space without losing the status signal
 *   • Quick-action strip: 5 tiles in a fixed 2-row layout (3+2) to prevent
 *     wrap inconsistency on narrow phones. Tiles use fixed width, not flex:1.
 *   • `StatCard` style prop now uses proper `StyleProp<ViewStyle>` type
 *   • RTL/LTR correct throughout
 *   • Existing data fetching, realtime sync, pull-to-refresh all preserved
 */

import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient }    from "expo-linear-gradient";
import { useRouter }         from "expo-router";
import { Ionicons }          from "@expo/vector-icons";
import { useTranslation }    from "react-i18next";
import { useQueryClient }    from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { kit }                    from "@pharmacy/ui-native";
import { theme }                  from "@pharmacy/design-tokens";
import { useAuth }                from "@/features/auth";
import { edgeEnd, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout }        from "@/utils/responsive";
import { Skeleton }               from "@/components/ui/Skeleton";

import { usePharmacistOrderQueue, usePharmacistDashboard } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys }  from "../hooks/queryKeys";
import { OrderQueueCard }       from "../components/OrderQueueCard";
import { StatCard }             from "../components/StatCard";
import EmptyState from "@/components/EmptyState";
import type { PharmacistOrder } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Quick action tile ────────────────────────────────────────────────────────

interface QuickTileProps {
  icon:    React.ComponentProps<typeof Ionicons>["name"];
  label:   string;
  onPress: () => void;
  badge?:  number;
}

function QuickTile({ icon, label, onPress, badge }: QuickTileProps) {
  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [qt.tile, pressed && qt.tilePressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={qt.iconWrap}>
        <View style={qt.iconBox}>
          <Ionicons name={icon} size={22} color={kit.color.accentDeep} />
        </View>
        {badge != null && badge > 0 && (
          <View style={qt.badge}>
            <UIText style={qt.badgeText}>{badge > 9 ? "9+" : badge}</UIText>
          </View>
        )}
      </View>
      <UIText style={qt.label} numberOfLines={1}>{label}</UIText>
    </Pressable>
  );
}

const qt = StyleSheet.create({
  tile: {
    alignItems:      "center",
    gap:             8,
    width:           72,      // fixed width — prevents flex-wrap inconsistency
    paddingVertical: 4,
  },
  tilePressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  iconWrap:    { position: "relative" },
  iconBox: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.accentDeep + "22",
  },
  badge: {
    position:          "absolute",
    top:               -4,
    [edgeEnd(IS_RTL)]: -4,
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    backgroundColor:   kit.color.danger,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 4,
    borderWidth:       2,
    borderColor:       kit.color.surface,
  },
  badgeText: {
    color:              "#fff",
    fontSize:           9,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
  },
  label: {
    fontSize:           11,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
});

// ─── KPI Skeleton tile ────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <View style={sk.card}>
      <Skeleton width={36} height={36} radius={12} />
      <Skeleton width={52} height={26} radius={8} style={{ marginTop: 8 }} />
      <Skeleton width={80} height={12} radius={4} style={{ marginTop: 4 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    padding:         14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
    minWidth:        100,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export function WorkbenchScreen(): React.ReactElement {
  const { t }          = useTranslation();
  const router         = useRouter();
  const { user }       = useAuth();
  const qc             = useQueryClient();
  const { pagePad }    = useScreenLayout();
  const listRef        = useRef<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const queueQ = usePharmacistOrderQueue();
  const statsQ = usePharmacistDashboard();
  const stats  = statsQ.data;
  const orders = queueQ.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
        qc.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const goOrder = useCallback(
    (order: PharmacistOrder) => router.push(`/(pharmacist)/order/${order.id}` as never),
    [router],
  );

  const firstName = user?.name?.split(" ")[0] ?? "";

  // Prescription attention — visible urgency only when there are pending items
  const hasPendingRx = (stats?.pendingPrescriptions ?? 0) > 0;
  const rxIconColor  = hasPendingRx ? kit.color.danger  : "#7C3AED";
  const rxIconBg     = hasPendingRx ? kit.color.dangerTint : "#F5F3FF";

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <FlashList
        ref={listRef}
        data={orders}
        overrideItemLayout={(layout: any) => {
          layout.size = 140;
        }}
        keyExtractor={(o) => o.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.listContent, { paddingHorizontal: pagePad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            colors={[kit.color.accent]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Hero header ──────────────────────────────────────── */}
            <LinearGradient
              colors={["#0A1220", "#0E2230"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.hero, { paddingHorizontal: pagePad }]}
            >
              {/* Decorative orb */}
              <View style={s.heroOrb} pointerEvents="none" />

              {/* Top row: eyebrow + greeting + live pill + actions */}
              <View style={[s.heroTop, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* Eyebrow + live pill — inline for compactness */}
                  <View style={[s.eyebrowRow, { flexDirection: flexRow(IS_RTL) }]}>
                    <UIText style={s.heroEyebrow}>
                      {t("pharmacist.eyebrow", "لوحة الصيدلاني")}
                    </UIText>
                    <View style={[s.livePill, { flexDirection: flexRow(IS_RTL) }]}>
                      <View style={s.liveDot} />
                      <UIText style={s.liveText}>
                        {t("pharmacist.liveUpdates", "متصل")}
                      </UIText>
                    </View>
                  </View>
                  <UIText style={s.heroGreeting} numberOfLines={1}>
                    {t("pharmacist.greeting", { name: firstName })}
                  </UIText>
                </View>

                {/* Header action buttons */}
                <View style={[s.heroActions, { flexDirection: flexRow(IS_RTL) }]}>
                  <Pressable
                    onPress={() => router.push("/(pharmacist)/notifications" as never)}
                    style={s.heroIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t("pharmacist.notifications")}
                  >
                    <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.75)" />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/(pharmacist)/profile" as never)}
                    style={s.heroIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t("pharmacist.profileTitle")}
                  >
                    <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.75)" />
                  </Pressable>
                </View>
              </View>
            </LinearGradient>

            {/* ── KPI Grid — unified 2×2 layout ───────────────────── */}
            <Animated.View
              entering={FadeInDown.delay(0).duration(320)}
              style={[s.kpiGrid, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}
            >
              {statsQ.isLoading ? (
                <>
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </>
              ) : (
                <>
                  {/* Active orders — primary metric */}
                  <StatCard
                    value={stats?.activeOrders ?? 0}
                    label={t("pharmacist.statActiveOrders")}
                    icon="bag-handle-outline"
                    iconColor={kit.color.accentDeep}
                    iconBg={kit.color.accentTint}
                    onPress={() => listRef.current?.scrollToOffset({ offset: 520, animated: true })}
                  />

                  {/* Pending prescriptions — danger color when any pending */}
                  <StatCard
                    value={stats?.pendingPrescriptions ?? 0}
                    label={t("pharmacist.statPendingRx")}
                    icon="document-text-outline"
                    iconColor={rxIconColor}
                    iconBg={rxIconBg}
                    onPress={() => router.push("/(pharmacist)/prescriptions" as never)}
                  />

                  {/* Preparing — operational throughput */}
                  <StatCard
                    value={stats?.preparing ?? 0}
                    label={t("pharmacist.statPreparing")}
                    icon="construct-outline"
                    iconColor={kit.color.warn}
                    iconBg={kit.color.warnTint}
                  />

                  {/* Delivered today — from PharmacistDashboardStats.deliveredToday */}
                  <StatCard
                    value={stats?.deliveredToday ?? 0}
                    label={t("pharmacist.analyticsDeliveredToday")}
                    icon="checkmark-circle-outline"
                    iconColor={kit.color.success}
                    iconBg={kit.color.successTint}
                  />
                </>
              )}
            </Animated.View>

            {/* ── Quick actions — 2 rows of tiles ─────────────────── */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(320)}
              style={[s.quickCard, { marginHorizontal: pagePad }]}
            >
              {/* Row 1: 3 primary actions */}
              <View style={[s.quickRow, { flexDirection: flexRow(IS_RTL) }]}>
                <QuickTile
                  icon="document-text-outline"
                  label={t("pharmacist.qaPrescriptions")}
                  badge={stats?.pendingPrescriptions}
                  onPress={() => router.push("/(pharmacist)/prescriptions" as never)}
                />
                <QuickTile
                  icon="barcode-outline"
                  label={t("pharmacist.qaScanner")}
                  onPress={() => router.push("/(pharmacist)/scanner" as never)}
                />
                <QuickTile
                  icon="cube-outline"
                  label={t("pharmacist.qaInventory")}
                  onPress={() => router.push("/(pharmacist)/inventory" as never)}
                />
              </View>

              {/* Hairline divider */}
              <View style={s.quickDivider} />

              {/* Row 2: 2 secondary actions */}
              <View style={[s.quickRow, { flexDirection: flexRow(IS_RTL), justifyContent: "center" }]}>
                <QuickTile
                  icon="bar-chart-outline"
                  label={t("pharmacist.qaAnalytics")}
                  onPress={() => router.push("/(pharmacist)/analytics" as never)}
                />
                <QuickTile
                  icon="person-outline"
                  label={t("pharmacist.qaProfile")}
                  onPress={() => router.push("/(pharmacist)/profile" as never)}
                />
              </View>
            </Animated.View>

            {/* ── Queue header ─────────────────────────────────────── */}
            <View style={[s.queueHeader, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
              <UIText style={s.queueTitle}>
                {t("pharmacist.orderQueueTitle")}
              </UIText>
              <View style={s.queueBadge}>
                <UIText style={s.queueBadgeText}>{orders.length}</UIText>
              </View>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
            <OrderQueueCard order={item} onPress={() => goOrder(item)} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          queueQ.isLoading ? (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={kit.color.accent} />
            </View>
          ) : queueQ.isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title={t("errors.network")}
              subtitle={t("pharmacist.emptyRetryHint")}
              actionLabel={t("common.retry")}
              onAction={onRefresh}
            />
          ) : (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={t("pharmacist.emptyQueueTitle")}
              subtitle={t("pharmacist.emptyQueueBody")}
            />
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  listContent: {
    paddingBottom: 48,
    gap:           10,
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    paddingTop:    20,
    paddingBottom: 24,
    gap:           10,
    overflow:      "hidden",
    // negative margin to bleed to screen edges despite FlatList horizontal padding
    marginHorizontal: -kit.inset.screen,
  },
  heroOrb: {
    position:        "absolute",
    top:             -60,
    [edgeEnd(IS_RTL)]: -60,
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: "rgba(14,126,116,0.12)",
  },
  heroTop: {
    alignItems: "center",
    gap:        12,
  },

  // Eyebrow row with inline live pill
  eyebrowRow: {
    alignItems: "center",
    gap:        8,
    marginBottom: 4,
  },
  heroEyebrow: {
    fontSize:           11,
    lineHeight:         16,
    fontFamily:         theme.fonts.bold,
    color:              "rgba(45,212,192,0.85)",
    letterSpacing:      1.2,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  livePill: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   "rgba(34,197,94,0.15)",
    borderRadius:      999,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       "rgba(34,197,94,0.25)",
  },
  liveDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: "#22C55E",
  },
  liveText: {
    fontSize:           10,
    fontFamily:         theme.fonts.bold,
    color:              "rgba(34,197,94,0.9)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  heroGreeting: {
    fontSize:           24,
    lineHeight:         30,
    fontFamily:         theme.fonts.black,
    color:              "#FFFFFF",
    letterSpacing:      -0.4,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  heroActions: {
    gap:        4,
    flexShrink: 0,
  },
  heroIconBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.14)",
  },

  // ── KPI Grid — unified 2×2 ─────────────────────────────────────────────────
  kpiGrid: {
    flexWrap:  "wrap",
    gap:       10,
    marginTop: 16,
  },

  // ── Quick actions ──────────────────────────────────────────────────────────
  quickCard: {
    marginTop:         16,
    paddingVertical:   16,
    paddingHorizontal: 8,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.xl,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.card,
    gap:               0,
  },
  quickRow: {
    justifyContent: "space-around",
    alignItems:     "center",
  },
  quickDivider: {
    height:            StyleSheet.hairlineWidth,
    backgroundColor:   kit.color.line,
    marginVertical:    12,
    marginHorizontal:  8,
  },

  // ── Queue header ───────────────────────────────────────────────────────────
  queueHeader: {
    alignItems:   "center",
    marginTop:    28,
    marginBottom: 12,
    gap:          10,
  },
  queueTitle: {
    flex:               1,
    fontSize:           20,
    lineHeight:         26,
    fontFamily:         theme.fonts.black,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  queueBadge: {
    minWidth:          26,
    height:            26,
    borderRadius:      13,
    backgroundColor:   kit.color.accentTint,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 8,
    borderWidth:       1,
    borderColor:       kit.color.accentDeep + "30",
  },
  queueBadgeText: {
    fontSize:           12,
    fontFamily:         theme.fonts.black,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Empty ──────────────────────────────────────────────────────────────────
  empty: {
    alignItems:        "center",
    paddingTop:        52,
    paddingBottom:     40,
  },
});
