import os

driver_code = '''import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Switch, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring, interpolateColor, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii } from '@pharmacy/ui-native/courier-tokens';
import { SkeletonCard, showToast } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore, type AvailableOrder } from '@/stores/orders.store';
import { Text as UIText } from "@pharmacy/ui-native";

const { width } = Dimensions.get('window');

function OrderCard({ order, onAccept, onSkip, accepting, skipping }: any) {
  const paymentMethod = order.paymentMethod?.toLowerCase();
  const isCash = paymentMethod === 'cod' || paymentMethod === 'cash';
  const distance = order.distanceToCustomerMeters != null
    ? order.distanceToCustomerMeters > 1000
      ? ${(order.distanceToCustomerMeters / 1000).toFixed(1)} km
      : ${Math.round(order.distanceToCustomerMeters)} m
    : '—';

  return (
    <Animated.View entering={FadeInDown.springify()} style={s.orderCard}>
      <View style={s.orderHeader}>
        <View style={s.orderTimeWrap}>
          <Ionicons name="time" size={16} color="#00ffcc" />
          <UIText style={{ color: '#00ffcc', fontFamily: 'Cairo_700Bold', marginLeft: 6 }}>{distance}</UIText>
        </View>
        <UIText style={{ color: 'white', fontFamily: 'Cairo_800ExtraBold', fontSize: 18 }}>{order.earningsFormatted ?? 'EGP --'}</UIText>
      </View>

      <View style={s.orderLocations}>
        <View style={s.locRow}>
          <View style={[s.dot, { backgroundColor: '#3b82f6' }]} />
          <UIText style={{ color: '#94a3b8', marginLeft: 12, flex: 1 }} numberOfLines={1}>Pharmacy: {order.pharmacyName}</UIText>
        </View>
        <View style={s.locLine} />
        <View style={s.locRow}>
          <View style={[s.dot, { backgroundColor: '#ef4444' }]} />
          <UIText style={{ color: 'white', marginLeft: 12, flex: 1 }} numberOfLines={2}>{order.shippingAddress?.street}, {order.shippingAddress?.district}</UIText>
        </View>
      </View>

      <View style={s.actionRow}>
        <Pressable style={s.skipBtn} onPress={() => onSkip(order.id)} disabled={skipping || accepting}>
          <UIText style={{ color: '#94a3b8', fontFamily: 'Cairo_600SemiBold' }}>Decline</UIText>
        </Pressable>
        <Pressable style={s.acceptBtn} onPress={() => onAccept(order.id)} disabled={accepting || skipping}>
          <LinearGradient colors={['#00ffcc', '#00bfa5']} style={StyleSheet.absoluteFillObject} borderRadius={100} />
          <UIText style={{ color: '#020617', fontFamily: 'Cairo_800ExtraBold', fontSize: 16 }}>Accept Order</UIText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function DriverDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setOnlineStatus } = useAuthStore();
  const isOnline = user?.driverProfile?.isOnline ?? false;
  
  const activeDeliveryId = useOrdersStore((s) => s.activeDeliveryId);
  const availableOrders = useOrdersStore((s) => s.availableOrders);
  const fetchAvailableOrders = useOrdersStore((s) => s.fetchAvailableOrders);
  
  const { isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['availableOrders'],
    queryFn: fetchAvailableOrders,
    enabled: isOnline && !activeDeliveryId,
    refetchInterval: isOnline && !activeDeliveryId ? 10000 : false,
  });

  const toggleMutation = useMutation({
    mutationFn: async (online: boolean) => driverApi.updateStatus(online),
    onSuccess: (_, vars) => setOnlineStatus(vars),
    onError: () => showToast('Failed to change status', 'error'),
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => driverApi.acceptOrder(id),
    onSuccess: (res) => {
      useOrdersStore.getState().setActiveDelivery(res);
      router.push('/(tabs)/delivery');
    },
    onError: () => showToast('Order no longer available', 'error'),
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => driverApi.skipOrder(id),
    onSuccess: () => refetch(),
  });

  const animStatus = useSharedValue(isOnline ? 1 : 0);
  useEffect(() => {
    animStatus.value = withSpring(isOnline ? 1 : 0, { damping: 15 });
  }, [isOnline]);

  const headerBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(animStatus.value, [0, 1], ['#0f172a', '#022c22'])
  }));

  return (
    <View style={s.container}>
      {/* Tactical Header */}
      <Animated.View style={[s.header, headerBg]}>
        <SafeAreaView edges={['top']} />
        <View style={s.headerInner}>
          <View>
            <UIText style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'Cairo_600SemiBold', textTransform: 'uppercase', letterSpacing: 2 }}>
              {isOnline ? 'Online & Searching' : 'Offline'}
            </UIText>
            <UIText style={{ color: 'white', fontSize: 28, fontFamily: 'Cairo_900Black' }}>
              {user?.driverProfile?.totalEarnings ?? 'EGP 0.00'}
            </UIText>
          </View>
          <View style={s.toggleContainer}>
            <Switch
              value={isOnline}
              onValueChange={(val) => toggleMutation.mutate(val)}
              trackColor={{ false: '#334155', true: '#00ffcc' }}
              thumbColor="white"
              disabled={toggleMutation.isPending || activeDeliveryId != null}
            />
          </View>
        </View>

        {activeDeliveryId && (
          <Pressable style={s.activeBanner} onPress={() => router.push('/(tabs)/delivery')}>
            <View style={s.pulseDot} />
            <UIText style={{ color: 'white', fontFamily: 'Cairo_700Bold', flex: 1, marginLeft: 12 }}>Active Delivery in Progress</UIText>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </Pressable>
        )}
      </Animated.View>

      {/* Main Feed */}
      <View style={s.feed}>
        {!isOnline ? (
          <View style={s.emptyState}>
            <Ionicons name="power" size={64} color="#334155" />
            <UIText style={s.emptyTitle}>You are offline</UIText>
            <UIText style={s.emptySub}>Go online to start receiving orders in your area.</UIText>
          </View>
        ) : activeDeliveryId ? (
          <View style={s.emptyState}>
            <Ionicons name="navigate" size={64} color="#00ffcc" />
            <UIText style={s.emptyTitle}>Delivery Active</UIText>
            <UIText style={s.emptySub}>Complete your current route.</UIText>
          </View>
        ) : (
          <FlatList
            data={availableOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.listContent}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00ffcc" />}
            renderItem={({ item }) => (
              <OrderCard 
                order={item} 
                onAccept={(id: string) => acceptMutation.mutate(id)} 
                onSkip={(id: string) => skipMutation.mutate(id)} 
                accepting={acceptMutation.isPending && acceptMutation.variables === item.id}
                skipping={skipMutation.isPending && skipMutation.variables === item.id}
              />
            )}
            ListEmptyComponent={
              isLoading ? (
                <View style={{ gap: 16 }}>
                  <SkeletonCard />
                  <SkeletonCard />
                </View>
              ) : (
                <View style={s.emptyState}>
                  <Ionicons name="radar" size={64} color="#00ffcc" style={{ opacity: 0.5 }} />
                  <UIText style={s.emptyTitle}>Scanning Area</UIText>
                  <UIText style={s.emptySub}>Waiting for new orders nearby...</UIText>
                </View>
              )
            }
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: 24, overflow: 'hidden' },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  toggleContainer: { transform: [{ scale: 1.2 }] },
  activeBanner: { flexDirection: 'row', backgroundColor: 'rgba(0,255,204,0.15)', marginHorizontal: 24, marginTop: 24, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,255,204,0.3)' },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00ffcc' },
  feed: { flex: 1, paddingTop: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, gap: 16 },
  orderCard: { backgroundColor: '#0f172a', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  orderTimeWrap: { flexDirection: 'row', backgroundColor: 'rgba(0,255,204,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, alignItems: 'center' },
  orderLocations: { marginLeft: 8, marginBottom: 24 },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  locLine: { width: 2, height: 24, backgroundColor: '#334155', marginLeft: 3, marginVertical: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  skipBtn: { flex: 1, backgroundColor: '#1e293b', paddingVertical: 14, borderRadius: 100, alignItems: 'center' },
  acceptBtn: { flex: 2, paddingVertical: 14, borderRadius: 100, alignItems: 'center', overflow: 'hidden' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: 'white', fontSize: 24, fontFamily: 'Cairo_800ExtraBold', marginTop: 24, marginBottom: 8 },
  emptySub: { color: '#94a3b8', textAlign: 'center', fontSize: 16, fontFamily: 'Cairo_500Medium' }
});
'''

with open('apps/courier-mobile/app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.write(driver_code)

