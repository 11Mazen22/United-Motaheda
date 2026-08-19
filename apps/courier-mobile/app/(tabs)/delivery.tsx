import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '@pharmacy/ui-native/courier-tokens';
import { Card, Button, showToast } from '@pharmacy/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useOrdersStore, type ActiveDelivery, type DeliveryStatus } from '@/stores/orders.store';

// Maps status to the next logical step and its label
const STATUS_TRANSITIONS: Partial<Record<DeliveryStatus, { next: DeliveryStatus; label: string; icon: any; color: string }>> = {
  ACCEPTED:             { next: 'EN_ROUTE_TO_PICKUP',   label: 'Start heading to Pharmacy', icon: 'navigate', color: colors.primary },
  EN_ROUTE_TO_PICKUP:   { next: 'ARRIVED_AT_PHARMACY',  label: 'Arrived at Pharmacy', icon: 'location', color: colors.primary },
  ARRIVED_AT_PHARMACY:  { next: 'PICKED_UP',            label: 'Confirm Pickup', icon: 'cube', color: colors.info },
  PICKED_UP:            { next: 'EN_ROUTE_TO_CUSTOMER', label: 'Start heading to Customer', icon: 'navigate', color: colors.primary },
  EN_ROUTE_TO_CUSTOMER: { next: 'ARRIVED_AT_CUSTOMER',  label: 'Arrived at Customer', icon: 'location', color: colors.primary },
  ARRIVED_AT_CUSTOMER:  { next: 'DELIVERED',            label: 'Complete Delivery', icon: 'checkmark-circle', color: colors.success },
};

function StatusStepper({ currentStatus }: { currentStatus: DeliveryStatus }) {
  const steps = [
    { key: 'ACCEPTED', label: 'Accepted' },
    { key: 'PICKED_UP', label: 'Picked Up' },
    { key: 'EN_ROUTE_TO_CUSTOMER', label: 'On Way' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  let currentIdx = steps.findIndex(s => s.key === currentStatus);
  if (currentStatus === 'EN_ROUTE_TO_PICKUP' || currentStatus === 'ARRIVED_AT_PHARMACY') currentIdx = 0;
  if (currentStatus === 'ARRIVED_AT_CUSTOMER') currentIdx = 2;

  return (
    <View style={ss.wrap}>
      {steps.map((step, idx) => {
        const isPast = idx <= currentIdx;
        const isLast = idx === steps.length - 1;
        return (
          <View key={step.key} style={ss.stepWrap}>
            <View style={[ss.dot, isPast ? ss.dotPast : ss.dotFuture]} />
            {!isLast && <View style={[ss.line, isPast ? ss.linePast : ss.lineFuture]} />}
            <Text style={[ss.label, isPast ? ss.labelPast : ss.labelFuture]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ss = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], marginVertical: spacing[4] },
  stepWrap: { flex: 1, alignItems: 'center', position: 'relative' },
  dot: { width: 14, height: 14, borderRadius: 7, zIndex: 2 },
  dotPast: { backgroundColor: colors.primary },
  dotFuture: { backgroundColor: colors.border, borderWidth: 2, borderColor: colors.surfaceAlt },
  line: { position: 'absolute', top: 6, left: '50%', width: '100%', height: 2, zIndex: 1 },
  linePast: { backgroundColor: colors.primary },
  lineFuture: { backgroundColor: colors.border },
  label: { fontSize: 10, fontFamily: typography.medium, marginTop: 4, textAlign: 'center' },
  labelPast: { color: colors.ink },
  labelFuture: { color: colors.inkFaint },
});

export default function DeliveryScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeDelivery, setActiveDelivery } = useOrdersStore();

  const updateMutation = useMutation({
    mutationFn: (newStatus: DeliveryStatus) => ((...args: any[]) => {})(activeDelivery!.id, newStatus),
    onSuccess: (res, newStatus) => {
      showToast('Status updated!', 'success');
      qc.invalidateQueries({ queryKey: ['delivery', 'active'] });
      
      if (newStatus === 'DELIVERED') {
        setActiveDelivery(null);
        router.push('/(tabs)');
      }
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message ?? 'Failed to update status', 'error');
    },
  });

  if (!activeDelivery) {
    return (
      <ErrorBoundary>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.header}>
            <Text style={s.orderId}>Active Delivery</Text>
          </View>
          <ScrollView contentContainerStyle={s.emptyWrap}>
            <Ionicons name="cube-outline" size={64} color={colors.inkFaint} />
            <Text style={s.emptyTitle}>No Active Delivery</Text>
            <Text style={s.emptyDesc}>When you accept an order, it will appear here.</Text>
            <Button title="Go to Orders" onPress={() => router.push('/(tabs)')} style={{ marginTop: spacing[4] }} />
          </ScrollView>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  const isCash = activeDelivery.order.paymentMethod?.toLowerCase() === 'cod' || activeDelivery.order.paymentMethod?.toLowerCase() === 'cash';
  const transition = STATUS_TRANSITIONS[activeDelivery.status];

  const handleNextStatus = () => {
    if (transition) {
      updateMutation.mutate(transition.next);
    }
  };

  const openMap = () => router.push('/(tabs)/map');

  const openPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => showToast('Failed to open dialer', 'error'));
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Delivery #{activeDelivery.order.id.slice(-6).toUpperCase()}</Text>
          <TouchableOpacity onPress={openMap} style={s.mapBtn}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <Text style={s.mapBtnText}>Map</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          
          <StatusStepper currentStatus={activeDelivery.status} />

          {/* Earnings Card */}
          <Card style={s.earningsCard} elevation="sm">
            <View style={s.earningsHeader}>
              <Text style={s.earningsLabel}>Estimated Earnings</Text>
              <Text style={s.earningsValue}>{parseFloat(activeDelivery.estimatedEarnings).toFixed(0)} EGP</Text>
            </View>
            <View style={s.earningsDivider} />
            <View style={s.paymentRow}>
              <View style={[s.paymentBadge, isCash ? s.payBadgeCash : s.payBadgeCard]}>
                <Ionicons name={isCash ? 'cash-outline' : 'card-outline'} size={14} color={isCash ? colors.warning : colors.info} />
                <Text style={[s.paymentText, isCash ? s.payTextCash : s.payTextCard]}>{isCash ? 'Cash on Delivery' : 'Paid by Card'}</Text>
              </View>
              {isCash && (
                <Text style={s.collectAmount}>Collect: {parseFloat(activeDelivery.order.total).toFixed(2)} EGP</Text>
              )}
            </View>
          </Card>

          {/* Pharmacy Info */}
          <Card style={s.infoCard} elevation="sm">
            <View style={s.infoHeader}>
              <Ionicons name="medical" size={20} color={colors.info} />
              <Text style={s.infoTitle}>Pickup</Text>
            </View>
            <Text style={s.nameText}>{activeDelivery.pharmacyName}</Text>
            <Text style={s.addressText}>{activeDelivery.pharmacyAddress}</Text>
            <View style={s.actionsRow}>
              <Button 
                title="Call Pharmacy" 
                variant="outline" 
                size="sm" 
                leftIcon={<Ionicons name="call" size={16} color={colors.primary} />} 
                onPress={() => openPhone(activeDelivery.pharmacyName ?? '')}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          {/* Customer Info */}
          <Card style={s.infoCard} elevation="sm">
            <View style={s.infoHeader}>
              <Ionicons name="person" size={20} color={colors.primary} />
              <Text style={s.infoTitle}>Drop-off</Text>
            </View>
            <Text style={s.nameText}>{activeDelivery.order.customerName}</Text>
            <Text style={s.addressText}>{activeDelivery.order.customerAddress}</Text>
            
            {activeDelivery.order.note ? (
              <View style={s.noteBox}>
                <Ionicons name="information-circle" size={16} color={colors.warning} />
                <Text style={s.noteText}>{activeDelivery.order.note}</Text>
              </View>
            ) : null}

            <View style={s.actionsRow}>
              <Button 
                title="Call Customer" 
                variant="outline" 
                size="sm" 
                leftIcon={<Ionicons name="call" size={16} color={colors.primary} />} 
                onPress={() => openPhone(activeDelivery.order.customerPhone ?? '')}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          {/* Order Details */}
          <Card style={s.infoCard} elevation="sm">
            <Text style={s.infoTitle}>Order Items</Text>
            <View style={s.itemsRow}>
              <Ionicons name="cube-outline" size={18} color={colors.inkMuted} />
              <Text style={s.itemsText}>{activeDelivery.order.itemCount} Items</Text>
            </View>
            <Text style={s.totalText}>Order Total: {parseFloat(activeDelivery.order.total).toFixed(2)} EGP</Text>
          </Card>

          {/* Spacer */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Action Button */}
        {transition && (
          <View style={s.actionFooter}>
            <TouchableOpacity 
              style={[s.mainBtn, { backgroundColor: transition.color }]} 
              onPress={handleNextStatus}
              disabled={updateMutation.isPending}
            >
              <Ionicons name={transition.icon} size={24} color={colors.white} />
              <Text style={s.mainBtnText}>{updateMutation.isPending ? 'Updating...' : transition.label}</Text>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[4], backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  headerTitle: { fontFamily: typography.black, fontSize: typography.lg, color: colors.ink },
  orderId: { fontFamily: typography.black, fontSize: typography.lg, color: colors.ink },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.full },
  mapBtnText: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.primary },
  
  scroll: { padding: spacing[4], gap: spacing[4] },
  
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
  emptyTitle: { fontFamily: typography.black, fontSize: typography.xl, color: colors.ink },
  emptyDesc: { fontFamily: typography.regular, fontSize: typography.sm, color: colors.inkMuted, textAlign: 'center' },

  earningsCard: { padding: spacing[4], backgroundColor: colors.surface },
  earningsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earningsLabel: { fontFamily: typography.semibold, fontSize: typography.sm, color: colors.inkMuted },
  earningsValue: { fontFamily: typography.black, fontSize: typography.xl, color: colors.primary },
  earningsDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing[3] },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  payBadgeCash: { backgroundColor: '#FEF9C3' },
  payBadgeCard: { backgroundColor: '#EFF6FF' },
  paymentText: { fontFamily: typography.bold, fontSize: typography.xs },
  payTextCash: { color: colors.warning },
  payTextCard: { color: colors.info },
  collectAmount: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.error },

  infoCard: { padding: spacing[4], gap: spacing[2] },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  infoTitle: { fontFamily: typography.bold, fontSize: typography.base, color: colors.ink },
  nameText: { fontFamily: typography.bold, fontSize: typography.lg, color: colors.ink },
  addressText: { fontFamily: typography.regular, fontSize: typography.sm, color: colors.inkMuted, lineHeight: 20 },
  
  noteBox: { flexDirection: 'row', gap: spacing[2], backgroundColor: '#FEF9C3', padding: spacing[3], borderRadius: radii.md, marginTop: spacing[2] },
  noteText: { flex: 1, fontFamily: typography.regular, fontSize: typography.sm, color: '#854D0E' },

  actionsRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },

  itemsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  itemsText: { fontFamily: typography.medium, fontSize: typography.sm, color: colors.ink },
  totalText: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.ink, marginTop: spacing[2] },

  actionFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing[5], backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderSoft, ...shadows.lg },
  mainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[4], borderRadius: radii.xl },
  mainBtnText: { fontFamily: typography.bold, fontSize: typography.lg, color: colors.white },
});
