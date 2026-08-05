/**
 * Delivery Screen — active delivery workflow (2026 redesign).
 *
 * Matches the reference screenshots:
 *  • Header: order ID + status badge + back chevron
 *  • Active Delivery card: customer name, address, navigation + call icons
 *  • Location prep banner
 *  • Workflow stepper (horizontal)
 *  • Customer info card
 *  • Items / totals card
 *  • Floating CTA ("تأكيد الاستلام") + Report Problem link
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Platform, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, typography, spacing, radii, shadows } from '@/theme/tokens';
import { Button, showToast } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useOrdersStore, DeliveryStatus, ActiveDelivery } from '@/stores/orders.store';
import { useLocationStore } from '@/stores/location.store';

// ─── Workflow stages ──────────────────────────────────────────────────────────

const STATUS_ORDER: DeliveryStatus[] = [
  'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PHARMACY',
  'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'ARRIVED_AT_CUSTOMER', 'DELIVERED',
];

const STAGE_LABELS: Record<string, string> = {
  ACCEPTED:             'قبول',
  EN_ROUTE_TO_PICKUP:   'إلى الصيدلية',
  ARRIVED_AT_PHARMACY:  'عند الصيدلية',
  PICKED_UP:            'تم الاستلام',
  EN_ROUTE_TO_CUSTOMER: 'إلى العميل',
  ARRIVED_AT_CUSTOMER:  'عند العميل',
  DELIVERED:            'تم التوصيل',
};

const STAGE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ACCEPTED:             'checkmark-circle-outline',
  EN_ROUTE_TO_PICKUP:   'navigate-outline',
  ARRIVED_AT_PHARMACY:  'storefront-outline',
  PICKED_UP:            'bag-check-outline',
  EN_ROUTE_TO_CUSTOMER: 'car-outline',
  ARRIVED_AT_CUSTOMER:  'home-outline',
  DELIVERED:            'trophy-outline',
};


// ─── Horizontal stepper ───────────────────────────────────────────────────────

function WorkflowStepper({ status }: { status: DeliveryStatus }) {
  const idx = STATUS_ORDER.indexOf(status);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={wf.container}
    >
      {STATUS_ORDER.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={s}>
            <View style={wf.step}>
              <View style={[wf.dot, done && wf.dotDone, active && wf.dotActive]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Ionicons
                      name={STAGE_ICONS[s]}
                      size={12}
                      color={active ? '#fff' : colors.inkFaint}
                    />}
              </View>
              <Text style={[wf.label, active && wf.labelActive, done && wf.labelDone]}>
                {STAGE_LABELS[s]}
              </Text>
            </View>
            {i < STATUS_ORDER.length - 1 && (
              <View style={[wf.line, done && wf.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}

const wf = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  step: { alignItems: 'center', width: 60, gap: 4 },
  dot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.well,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotDone:   { backgroundColor: colors.success,  borderColor: colors.success },
  label: { fontSize: 9, color: colors.inkFaint, textAlign: 'center' },
  labelActive: { color: colors.primary, fontWeight: typography.bold },
  labelDone:   { color: colors.success },
  line: { width: 16, height: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 },
  lineDone: { backgroundColor: colors.success },
});


// ─── Action buttons per status ────────────────────────────────────────────────

function PrimaryActionArea({
  delivery, onAction, loading,
}: {
  delivery: ActiveDelivery;
  onAction: (action: string, extra?: any) => void;
  loading: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const location = useLocationStore();

  const pickPhoto = async () => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!r.canceled && r.assets[0]) { setProofUri(r.assets[0].uri); setShowProofModal(false); }
  };
  const pickGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!r.canceled && r.assets[0]) { setProofUri(r.assets[0].uri); setShowProofModal(false); }
  };

  const requireLocation = () => {
    if (!location.latitude || !location.longitude) {
      showToast('Waiting for GPS location…', 'warning');
      return false;
    }
    return true;
  };

  const { status } = delivery;

  const CONFIGS: Record<string, { title: string; desc: string; actionLabel: string; action: () => void; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
    ACCEPTED: {
      title: 'Order Accepted',
      desc: `Navigate to ${delivery.pharmacyName} to pick up the order.`,
      actionLabel: 'Start — Navigate to Pharmacy',
      icon: 'navigate-outline',
      action: () => onAction('en-route-pickup'),
    },
    EN_ROUTE_TO_PICKUP: {
      title: 'Heading to Pharmacy',
      desc: `Tap when you arrive at ${delivery.pharmacyName}.`,
      actionLabel: "Arrived at Pharmacy",
      icon: 'storefront-outline',
      action: () => requireLocation() && onAction('arrived-pharmacy', { currentLat: location.latitude, currentLng: location.longitude }),
    },
    ARRIVED_AT_PHARMACY: {
      title: 'At Pharmacy — Collect Order',
      desc: 'Pick up all items, then confirm.',
      actionLabel: 'Confirm Order Picked Up',
      icon: 'bag-check-outline',
      action: () => onAction('picked-up', { notes }),
    },
    PICKED_UP: {
      title: 'Order Collected!',
      desc: 'Navigate to the customer\'s address.',
      actionLabel: 'Navigate to Customer',
      icon: 'car-outline',
      action: () => onAction('en-route-customer'),
    },
    EN_ROUTE_TO_CUSTOMER: {
      title: 'Heading to Customer',
      desc: `Tap when you arrive at ${delivery.order.customerAddress}.`,
      actionLabel: "Arrived at Customer",
      icon: 'home-outline',
      action: () => requireLocation() && onAction('arrived-customer', { currentLat: location.latitude, currentLng: location.longitude }),
    },
  };

  const cfg = CONFIGS[status];
  if (!cfg && status !== 'ARRIVED_AT_CUSTOMER') return null;

  if (status === 'ARRIVED_AT_CUSTOMER') {
    return (
      <View style={ac.card}>
        <Text style={ac.title}>Complete Delivery</Text>
        <Text style={ac.desc}>Take a proof-of-delivery photo, then confirm.</Text>

        <TouchableOpacity
          style={[ac.proofBox, proofUri && ac.proofBoxFilled]}
          onPress={() => setShowProofModal(true)}
          activeOpacity={0.7}
        >
          {proofUri
            ? <Image source={{ uri: proofUri }} style={ac.proofImg} />
            : <View style={ac.proofPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={colors.primary} />
                <Text style={ac.proofPlaceholderText}>Tap to take proof photo</Text>
              </View>}
        </TouchableOpacity>

        <TextInput
          style={ac.notes}
          placeholder="Delivery notes (optional)"
          placeholderTextColor={colors.inkFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />

        <Button
          title="Complete Delivery ✓"
          onPress={() => {
            if (!proofUri) { showToast('Please take a proof photo', 'warning'); return; }
            onAction('complete', { proofUri, notes });
          }}
          loading={loading}
          fullWidth
        />

        <Modal visible={showProofModal} transparent animationType="slide">
          <View style={ac.overlay}>
            <View style={ac.sheet}>
              <Text style={ac.sheetTitle}>Proof of Delivery</Text>
              <TouchableOpacity style={ac.sheetOpt} onPress={pickPhoto}>
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
                <Text style={ac.sheetOptText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ac.sheetOpt} onPress={pickGallery}>
                <Ionicons name="images-outline" size={22} color={colors.primary} />
                <Text style={ac.sheetOptText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ac.sheetOpt, { borderTopWidth: 1, borderTopColor: colors.borderSoft }]}
                onPress={() => setShowProofModal(false)}
              >
                <Text style={[ac.sheetOptText, { color: colors.error }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={ac.card}>
      <Text style={ac.title}>{cfg.title}</Text>
      <Text style={ac.desc}>{cfg.desc}</Text>
      {status === 'ARRIVED_AT_PHARMACY' && (
        <TextInput
          style={ac.notes}
          placeholder="Pickup notes (optional)"
          placeholderTextColor={colors.inkFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />
      )}
      <Button
        title={cfg.actionLabel}
        onPress={cfg.action}
        loading={loading}
        fullWidth
        leftIcon={<Ionicons name={cfg.icon} size={18} color="#fff" />}
      />
    </View>
  );
}

const ac = StyleSheet.create({
  card: { padding: spacing[5], gap: spacing[4] },
  title: { fontSize: typography.md, fontWeight: typography.bold, color: colors.ink },
  desc: { fontSize: typography.sm, color: colors.inkMuted, lineHeight: 20 },
  notes: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.lg,
    padding: spacing[3], fontSize: typography.sm, color: colors.ink,
    textAlignVertical: 'top', minHeight: 64,
  },
  proofBox: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radii.xl, height: 150, overflow: 'hidden',
  },
  proofBoxFilled: { borderStyle: 'solid', borderColor: colors.success },
  proofImg: { width: '100%', height: '100%' },
  proofPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  proofPlaceholderText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.medium },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'], padding: spacing[5], paddingBottom: spacing[10], gap: spacing[1],
  },
  sheetTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.ink, marginBottom: spacing[3] },
  sheetOpt: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
  sheetOptText: { fontSize: typography.base, color: colors.ink },
});


// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ earnings, onDone }: { earnings: string; onDone: () => void }) {
  const scale   = useSharedValue(0);
  const opacity = useSharedValue(0);
  React.useEffect(() => {
    scale.value   = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 400 });
  }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <View style={cs.bg}>
      <Animated.View style={[cs.card, anim]}>
        <View style={cs.trophy}>
          <Ionicons name="trophy" size={52} color={colors.accent} />
        </View>
        <Text style={cs.title}>Delivery Complete!</Text>
        <Text style={cs.sub}>Great work. You've earned:</Text>
        <Text style={cs.earnings}>{parseFloat(earnings).toFixed(2)} EGP</Text>
        <Button title="Back to Orders" onPress={onDone} fullWidth size="lg" />
      </Animated.View>
    </View>
  );
}

const cs = StyleSheet.create({
  bg: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, padding: spacing[5] },
  card: {
    backgroundColor: colors.surface, borderRadius: radii['2xl'],
    padding: spacing[8], alignItems: 'center', gap: spacing[4], width: '100%', ...shadows.xl,
  },
  trophy: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#FEF9C3', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: typography['2xl'], fontWeight: typography.extrabold, color: colors.ink },
  sub:   { fontSize: typography.base, color: colors.inkMuted },
  earnings: { fontSize: typography['3xl'], fontWeight: typography.black, color: colors.primary },
});


// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DeliveryScreen() {
  const router         = useRouter();
  const qc             = useQueryClient();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const setActive      = useOrdersStore((s) => s.setActiveDelivery);
  const updateStatus   = useOrdersStore((s) => s.updateActiveDeliveryStatus);
  const [completedEarnings, setCompletedEarnings] = useState<string | null>(null);

  // Poll active delivery
  const { data } = useQuery({
    queryKey: ['delivery', 'active'],
    queryFn: driverApi.getActiveDelivery,
    refetchInterval: 10_000,
  });
  useEffect(() => {
    if (data !== undefined) setActive((data as any).activeDelivery ?? null);
  }, [data]);

  const actionMutation = useMutation({
    mutationFn: async ({ action, extra }: { action: string; extra?: any }) => {
      if (!activeDelivery) throw new Error('No active delivery');
      const oid = activeDelivery.order.id;
      switch (action) {
        case 'en-route-pickup':    return driverApi.enRouteToPickup(oid);
        case 'arrived-pharmacy':   return driverApi.arrivedPharmacy(oid, extra.currentLat, extra.currentLng);
        case 'picked-up':          return driverApi.pickedUp(oid, extra?.notes);
        case 'en-route-customer':  return driverApi.enRouteToCustomer(oid);
        case 'arrived-customer':   return driverApi.arrivedCustomer(oid, extra.currentLat, extra.currentLng);
        case 'complete': {
          let proofUrl: string | undefined;
          if (extra.proofUri) {
            const r = await driverApi.uploadDocument('vehicle', extra.proofUri);
            proofUrl = r.fileUrl;
          }
          return driverApi.completeDelivery(oid, { proofPhotoUrl: proofUrl, deliveryNotes: extra.notes });
        }
        default: throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (res: any, { action }) => {
      if (action === 'complete') {
        setActive(null);
        setCompletedEarnings(res.earnings ?? '0');
        qc.invalidateQueries({ queryKey: ['driver', 'statistics'] });
      } else {
        updateStatus(res.status);
        qc.invalidateQueries({ queryKey: ['delivery', 'active'] });
        showToast(res.message ?? 'Status updated', 'success');
      }
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Action failed', 'error'),
  });

  const handleAction = useCallback(
    (action: string, extra?: any) => actionMutation.mutate({ action, extra }),
    [actionMutation],
  );

  // Completion screen
  if (completedEarnings !== null) {
    return (
      <CompletionScreen
        earnings={completedEarnings}
        onDone={() => { setCompletedEarnings(null); router.replace('/(tabs)'); }}
      />
    );
  }

  // No active delivery
  if (!activeDelivery) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="cube-outline" size={44} color={colors.inkFaint} />
          </View>
          <Text style={s.emptyTitle}>No Active Delivery</Text>
          <Text style={s.emptyDesc}>
            Accept an order from the Orders tab to start.
          </Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={s.emptyBtnText}>View Available Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const d = activeDelivery;

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerOrderId}>#{d.order.id.slice(-8).toUpperCase()}</Text>
            <Text style={s.headerStatus}>{STAGE_LABELS[d.status] ?? d.status}</Text>
          </View>
          <View style={[s.headerBadge, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Active delivery summary card */}
          <View style={[s.section]}>
            <View style={s.activeCard}>
              <View style={s.activeCardHeader}>
                <View style={s.activeCardLabel}>
                  <View style={s.activeDot} />
                  <Text style={s.activeCardLabelText}>ACTIVE DELIVERY</Text>
                </View>
                <View style={s.activeCardActions}>
                  <TouchableOpacity
                    style={s.actionIconBtn}
                    onPress={() => router.push('/(tabs)/map')}
                    hitSlop={8}
                  >
                    <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionIconBtn}
                    onPress={() => Linking.openURL(`tel:${d.order.customerPhone}`).catch(() => {})}
                    hitSlop={8}
                  >
                    <Ionicons name="call-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={s.activeCustomer}>{d.order.customerName}</Text>
              <Text style={s.activeAddr} numberOfLines={2}>{d.order.customerAddress}</Text>
            </View>
          </View>

          {/* Workflow stepper */}
          <View style={s.stepperCard}>
            <WorkflowStepper status={d.status} />
          </View>

          {/* Primary action */}
          <View style={s.section}>
            <View style={s.actionCard}>
              <PrimaryActionArea
                delivery={d}
                onAction={handleAction}
                loading={actionMutation.isPending}
              />
            </View>
          </View>

          {/* Customer info */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>بيانات العميل</Text>
            <View style={s.infoCard}>
              {[
                { label: 'الاسم',   value: d.order.customerName },
                { label: 'الهاتف',  value: d.order.customerPhone },
                { label: 'العنوان', value: d.order.customerAddress },
                ...(d.order.note ? [{ label: 'ملاحظة', value: `طريقة الدفع: ${d.order.paymentMethod}` }] : []),
              ].map(({ label, value }, i) => (
                <View key={i} style={[s.infoRow, i > 0 && s.infoRowBorder]}>
                  <Text style={s.infoLabel}>{label}</Text>
                  <Text style={s.infoValue} numberOfLines={3}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Items */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>الأصناف</Text>
            <View style={s.infoCard}>
              {d.order.items.map((item, i) => (
                <View key={i} style={[s.itemRow, i > 0 && s.infoRowBorder]}>
                  <Text style={s.itemName} numberOfLines={2}>
                    {item.snapshot?.nameAr ?? item.snapshot?.name ?? item.productId}
                  </Text>
                  <Text style={s.itemPrice}>
                    {item.quantity} × {parseFloat(item.unitPrice).toFixed(2)} ج.م
                  </Text>
                </View>
              ))}
              <View style={[s.totalRowCard, s.infoRowBorder]}>
                <Text style={s.totalLabelCard}>الإجمالي</Text>
                <Text style={s.totalValueCard}>{parseFloat(d.order.total).toFixed(2)} ج.م</Text>
              </View>
            </View>
          </View>

          {/* Report problem link */}
          <TouchableOpacity style={s.reportBtn} onPress={() => showToast('Report submitted', 'info')}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={s.reportText}>الإبلاغ عن مشكلة</Text>
          </TouchableOpacity>

          <View style={{ height: spacing[12] }} />
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  headerOrderId: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.ink },
  headerStatus:  { fontSize: typography.sm, color: colors.inkMuted, marginTop: 2 },
  headerBadge: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingBottom: spacing[8] },
  section: { paddingHorizontal: spacing[4], marginTop: spacing[3] },
  sectionTitle: {
    fontSize: typography.sm, fontWeight: typography.bold, color: colors.ink,
    marginBottom: spacing[2], textAlign: 'right',
  },

  activeCard: {
    backgroundColor: colors.surface, borderRadius: radii['2xl'],
    padding: spacing[4], gap: spacing[2], ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeCardLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online },
  activeCardLabelText: { fontSize: 10, fontWeight: typography.bold, color: colors.inkFaint, letterSpacing: 0.8 },
  activeCardActions: { flexDirection: 'row', gap: spacing[2] },
  actionIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  activeCustomer: { fontSize: typography.md, fontWeight: typography.bold, color: colors.ink, textAlign: 'right' },
  activeAddr: { fontSize: typography.sm, color: colors.inkMuted, textAlign: 'right' },

  stepperCard: {
    backgroundColor: colors.surface, marginTop: spacing[3],
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft,
  },

  actionCard: {
    backgroundColor: colors.surface, borderRadius: radii['2xl'],
    overflow: 'hidden', ...shadows.sm,
  },

  infoCard: {
    backgroundColor: colors.surface, borderRadius: radii['2xl'],
    overflow: 'hidden', ...shadows.sm,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[4],
  },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  infoLabel: { fontSize: typography.sm, color: colors.inkMuted, fontWeight: typography.medium, flexShrink: 0 },
  infoValue: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.ink, flex: 1, textAlign: 'right' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3],
  },
  itemName: { flex: 1, fontSize: typography.sm, fontWeight: typography.semibold, color: colors.ink, textAlign: 'right' },
  itemPrice: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.bold },
  totalRowCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  totalLabelCard: { fontSize: typography.sm, color: colors.inkMuted, fontWeight: typography.medium },
  totalValueCard: { fontSize: typography.base, fontWeight: typography.extrabold, color: colors.primary },

  reportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], marginTop: spacing[4], paddingVertical: spacing[3],
  },
  reportText: { fontSize: typography.sm, color: colors.error, fontWeight: typography.medium },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[4] },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.well, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.ink },
  emptyDesc: { fontSize: typography.base, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.primary,
    marginTop: spacing[2],
  },
  emptyBtnText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.semibold },
});
