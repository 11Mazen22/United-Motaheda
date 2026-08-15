/**
 * WorkbenchScreen — pharmacist dashboard (2026 full visual redesign).
 *
 * This was a flat grey grid. Now it's a proper premium pharmacist dashboard:
 *   • Deep navy header with greeting + gradient
 *   • 4 KPI cards in a 2×2 grid with colour-coded icons, large numbers, labels
 *   • Horizontal quick-action strip with icon tiles
 *   • "Order Queue" section with real order cards
 *   • Realtime via usePharmacistRealtimeSync (mounted in layout)
 */

import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient }    from "expo-linear-gradient";
import { useRouter }         from "expo-router";
import { Ionicons }          from "@expo/vector-icons";
import { useTranslation }    from "react-i18next";
import { useQueryClient }    from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { kit }                    from "@pharmacy/ui-native";
import { theme }                  from "@pharmacy/design-tokens";
import { useAuth }                from "@/features/auth";
import { edgeEnd, flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { usePharmacistOrderQueue, usePharmacistDashboard } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys }  from "../hooks/queryKeys";
import { OrderQueueCard }       from "../components/OrderQueueCard";
import { StatCard }             from "../components/StatCard";
import EmptyState from "@/components/EmptyState";
import type { PharmacistOrder } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Quick action tile ────────────────────────────────────────────────────────

function QuickTile({
  icon, label, onPress, badge,
}: {
  icon:    React.ComponentProps<typeof Ionicons>["name"];
  label:   string;
  onPress: () => void;
  badge?:  number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [qt.tile, pressed && qt.tilePressed]}
      accessibilityRole="button"
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
    alignItems: "center",
    gap:        8,
    flex:       1,
    paddingVertical: 4,
  },
  tilePressed: { opacity: 0.75 },
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export function WorkbenchScreen(): React.ReactElement {
  const { t }                = useTranslation();
  const router               = useRouter();
  const { user }             = useAuth();
  const qc                   = useQueryClient();
  const listRef              = useRef<FlatList<PharmacistOrder>>(null);
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

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <FlatList
        ref={listRef}
        data={orders}
        keyExtractor={(o) => o.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
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
            {/* ── Hero header ───────────────────────────────────────── */}
            <LinearGradient
              colors={["#0A1220", "#0E2230"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              {/* Decorative orb */}
              <View style={s.heroOrb} pointerEvents="none" />

              {/* Top row: greeting + actions */}
              <View style={[s.heroTop, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={{ flex: 1 }}>
                  <UIText style={s.heroEyebrow}>
                    {t("pharmacist.eyebrow", "لوحة الصيدلاني")}
                  </UIText>
                  <UIText style={s.heroGreeting}>
                    {t("pharmacist.greeting", { name: firstName })}
                  </UIText>
                </View>
                <View style={[s.heroActions, { flexDirection: flexRow(IS_RTL) }]}>
                  <Pressable
                    onPress={() => router.push("/(pharmacist)/notifications" as never)}
                    style={s.heroIconBtn}
                  >
                    <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.75)" />
                  </Pressable>
                  <Pressable onPress={() => router.push("/(pharmacist)/profile" as never)} style={s.heroIconBtn}>
                    <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.75)" />
                  </Pressable>
                </View>
              </View>

              {/* Live indicator */}
              <View style={[s.liveRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.liveDot} />
                <UIText style={s.liveText}>
                  {t("pharmacist.liveUpdates", "تحديث فوري · متصل")}
                </UIText>
              </View>
            </LinearGradient>

            {/* ── KPI Grid ──────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(0).duration(320)} style={[s.kpiGrid, { flexDirection: flexRow(IS_RTL) }]}>
              <StatCard
                value={statsQ.isLoading ? '…' : stats?.activeOrders ?? 0}
                label={t("pharmacist.statActiveOrders")}
                icon="bag-handle-outline"
                iconColor={kit.color.accentDeep}
                iconBg={kit.color.accentTint}
                style={statsQ.isLoading ? { opacity: 0.65 } : undefined}
                onPress={() => listRef.current?.scrollToOffset({ offset: 520, animated: true })}
              />
              <StatCard
                value={statsQ.isLoading ? '…' : stats?.pendingPrescriptions ?? 0}
                label={t("pharmacist.statPendingRx")}
                icon="document-text-outline"
                iconColor="#7C3AED"
                iconBg="#F5F3FF"
                style={statsQ.isLoading ? { opacity: 0.65 } : undefined}
                onPress={() => router.push("/(pharmacist)/prescriptions" as never)}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(50).duration(320)} style={[s.kpiGrid, { flexDirection: flexRow(IS_RTL) }]}>
              <StatCard
                value={statsQ.isLoading ? '…' : stats?.preparing ?? 0}
                label={t("pharmacist.statPreparing")}
                icon="construct-outline"
                iconColor={kit.color.accentDeep}
                iconBg={kit.color.accentTint}
                style={statsQ.isLoading ? { opacity: 0.65 } : undefined}
              />
              <StatCard
                value={statsQ.isLoading ? '…' : stats?.lowStockCount ?? 0}
                label={t("pharmacist.statLowStock")}
                icon="alert-circle-outline"
                iconColor={kit.color.danger}
                iconBg={kit.color.dangerTint}
                style={statsQ.isLoading ? { opacity: 0.65 } : undefined}
                onPress={() => router.push("/(pharmacist)/inventory" as never)}
              />
            </Animated.View>

            {/* ── Quick actions ─────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(100).duration(320)} style={s.quickCard}>
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
            </Animated.View>

            {/* ── Queue header ──────────────────────────────────────── */}
            <View style={[s.queueHeader, { flexDirection: flexRow(IS_RTL) }]}>
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
    paddingBottom:     48,
    paddingHorizontal: kit.inset.screen,
    gap:               10,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: kit.inset.screen,
    paddingTop:        20,
    paddingBottom:     24,
    gap:               12,
    overflow:          "hidden",
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
  heroGreeting: {
    fontSize:           26,
    lineHeight:         32,
    fontFamily:         theme.fonts.black,
    color:              "#FFFFFF",
    letterSpacing:      -0.4,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          2,
  },
  heroActions: {
    gap:       4,
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
  liveRow: {
    alignItems: "center",
    gap:        6,
  },
  liveDot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: "#22C55E",
  },
  liveText: {
    fontSize:           11,
    fontFamily:         theme.fonts.bold,
    color:              "rgba(255,255,255,0.55)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── KPI ───────────────────────────────────────────────────────────────────
  kpiGrid: {
    gap:               10,
    paddingHorizontal: kit.inset.screen,
    marginTop:         14,
  },

  // ── Quick actions ─────────────────────────────────────────────────────────
  quickCard: {
    flexDirection:   flexRow(IS_RTL),
    justifyContent:  "space-between",
    marginHorizontal: kit.inset.screen,
    marginTop:       14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexWrap:        "wrap",
    rowGap:          12,
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },

  // ── Queue header ──────────────────────────────────────────────────────────
  queueHeader: {
    alignItems:        "center",
    paddingHorizontal: kit.inset.screen,
    marginTop:         24,
    marginBottom:      12,
    gap:               10,
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

  // ── List padding wrapper ──────────────────────────────────────────────────
  // FlatList items are wrapped in paddingHorizontal via renderItem or via
  // contentContainerStyle; OrderQueueCard already has its own card style.
  // We add horizontal padding in the FlatList's contentContainerStyle.

  // ── Empty ─────────────────────────────────────────────────────────────────
  empty: {
    alignItems:    "center",
    paddingTop:    52,
    paddingBottom: 40,
    paddingHorizontal: kit.inset.screen,
  },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  retryBtn: {
    marginTop:         12,
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.accentTint,
  },
});
