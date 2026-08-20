import os

rx_code = '''import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import { Screen, Text as UIText, kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { usePharmacistOrderQueue, usePharmacistDashboard, useAllPrescriptions } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { OrderQueueCard } from "../components/OrderQueueCard";
import EmptyState from "@/components/EmptyState";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function WorkbenchScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'prescriptions'>('orders');

  const queueQ = usePharmacistOrderQueue();
  const statsQ = usePharmacistDashboard();
  const rxQ = useAllPrescriptions("pending_review");

  const stats = statsQ.data;
  const orders = queueQ.data ?? [];
  const pendingRx = rxQ.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
      qc.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  return (
    <View style={s.container}>
      {/* Pro Dashboard Header */}
      <View style={s.header}>
        <View style={[s.headerTop, { flexDirection: flexRow(IS_RTL) }]}>
          <View>
            <UIText style={s.greeting}>STATION 01 • ACTIVE</UIText>
            <UIText style={s.title}>Pharmacist Workbench</UIText>
          </View>
          <View style={s.avatar}>
            <UIText style={{ color: 'white', fontFamily: 'Cairo_700Bold' }}>{user?.name?.[0] ?? 'P'}</UIText>
          </View>
        </View>

        {/* Tactical Metric Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricsScroll}>
          <View style={[s.metricCard, { borderLeftColor: kit.color.danger }]}>
            <UIText style={s.metricValue}>{stats?.pendingOrders ?? 0}</UIText>
            <UIText style={s.metricLabel}>Pending Orders</UIText>
          </View>
          <View style={[s.metricCard, { borderLeftColor: kit.color.warning }]}>
            <UIText style={s.metricValue}>{stats?.processingOrders ?? 0}</UIText>
            <UIText style={s.metricLabel}>Processing</UIText>
          </View>
          <View style={[s.metricCard, { borderLeftColor: kit.color.brand }]}>
            <UIText style={s.metricValue}>{pendingRx.length}</UIText>
            <UIText style={s.metricLabel}>Rx Reviews</UIText>
          </View>
        </ScrollView>
      </View>

      {/* Segmented Control */}
      <View style={s.segmentContainer}>
        <Pressable style={[s.segmentBtn, activeTab === 'orders' && s.segmentActive]} onPress={() => setActiveTab('orders')}>
          <UIText style={[s.segmentText, activeTab === 'orders' && { color: 'white' }]}>Order Queue</UIText>
          {orders.length > 0 && (
            <View style={s.badge}><UIText style={s.badgeText}>{orders.length}</UIText></View>
          )}
        </Pressable>
        <Pressable style={[s.segmentBtn, activeTab === 'prescriptions' && s.segmentActive]} onPress={() => setActiveTab('prescriptions')}>
          <UIText style={[s.segmentText, activeTab === 'prescriptions' && { color: 'white' }]}>Prescriptions</UIText>
          {pendingRx.length > 0 && (
            <View style={[s.badge, { backgroundColor: kit.color.danger }]}><UIText style={s.badgeText}>{pendingRx.length}</UIText></View>
          )}
        </Pressable>
      </View>

      {/* Data Feed */}
      <ScrollView 
        style={s.feed} 
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'orders' ? (
          orders.length === 0 ? (
             <EmptyState icon="checkmark-circle-outline" title="Queue Clear" message="No pending orders to process." />
          ) : (
            orders.map((o, i) => (
              <Animated.View key={o.id} entering={SlideInRight.delay(i * 50).springify()}>
                <OrderQueueCard order={o} onPress={() => router.push(/(pharmacist)/orders/)} />
              </Animated.View>
            ))
          )
        ) : (
          pendingRx.length === 0 ? (
            <EmptyState icon="document-text-outline" title="No Prescriptions" message="All prescriptions have been reviewed." />
          ) : (
            pendingRx.map((rx, i) => (
              <Animated.View key={rx.id} entering={SlideInRight.delay(i * 50).springify()}>
                <Pressable style={s.rxCard} onPress={() => router.push(/(pharmacist)/prescriptions/)}>
                  <View style={s.rxIcon}><Ionicons name="document-text" size={24} color={kit.color.brand} /></View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <UIText style={s.rxTitle}>{rx.patientName}</UIText>
                    <UIText style={s.rxSub}>Submitted: {new Date(rx.createdAt).toLocaleTimeString()}</UIText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={kit.color.inkSoft} />
                </Pressable>
              </Animated.View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: 'white', paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTop: { paddingHorizontal: 24, justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#64748b', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 24, fontFamily: 'Cairo_900Black', color: '#0f172a' },
  avatar: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  metricsScroll: { paddingHorizontal: 16, gap: 12 },
  metricCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderRadius: 12, padding: 16, width: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  metricValue: { fontSize: 28, fontFamily: 'Cairo_800ExtraBold', color: '#0f172a', marginBottom: 4 },
  metricLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: '#64748b' },
  segmentContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', margin: 16, borderRadius: 8, padding: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 6 },
  segmentActive: { backgroundColor: '#0f172a', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segmentText: { fontFamily: 'Cairo_700Bold', color: '#64748b', fontSize: 14 },
  badge: { backgroundColor: '#3b82f6', borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: 'white', fontSize: 10, fontFamily: 'Cairo_800ExtraBold' },
  feed: { flex: 1 },
  rxCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  rxIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  rxTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', color: '#0f172a' },
  rxSub: { fontSize: 13, fontFamily: 'Cairo_500Medium', color: '#64748b', marginTop: 2 }
});
'''

with open('apps/shopper-native/src/features/pharmacist/screens/WorkbenchScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(rx_code)

