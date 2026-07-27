import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { colors, typography, spacing, radii, shadows } from '@/theme/tokens';
import { Button, Card, Badge, showToast } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useOrdersStore, DeliveryStatus, ActiveDelivery } from '@/stores/orders.store';
import { useLocationStore } from '@/stores/location.store';
import { haversineMeters } from '@/lib/gps/KalmanFilter';

// ─── Workflow stages config ───────────────────────────────────────────────────

const STAGES: { status: DeliveryStatus; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { status: 'ACCEPTED', label: 'Accepted', icon: 'checkmark-circle-outline' },
  { status: 'EN_ROUTE_TO_PICKUP', label: 'To Pharmacy', icon: 'navigate-outline' },
  { status: 'ARRIVED_AT_PHARMACY', label: 'At Pharmacy', icon: 'storefront-outline' },
  { status: 'PICKED_UP', label: 'Picked Up', icon: 'bag-check-outline' },
  { status: 'EN_ROUTE_TO_CUSTOMER', label: 'To Customer', icon: 'car-outline' },
  { status: 'ARRIVED_AT_CUSTOMER', label: 'At Customer', icon: 'home-outline' },
  { status: 'DELIVERED', label: 'Delivered', icon: 'trophy-outline' },
];

const STATUS_ORDER: DeliveryStatus[] = [
  'ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'ARRIVED_AT_PHARMACY',
  'PICKED_UP',
  'EN_ROUTE_TO_CUSTOMER',
  'ARRIVED_AT_CUSTOMER',
  'DELIVERED',
];

// ─── Stepper component ────────────────────────────────────────────────────────

function WorkflowStepper({ currentStatus }: { currentStatus: DeliveryStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={wf.scrollContent}
    >
      {STAGES.map((stage, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <React.Fragment key={stage.status}>
            <View style={wf.step}>
              <View
                style={[
                  wf.stepDot,
                  isDone && wf.stepDotDone,
                  isActive && wf.stepDotActive,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Ionicons
                    name={stage.icon}
                    size={14}
                    color={isActive ? colors.white : colors.inkFaint}
                  />
                )}
              </View>
              <Text
                style={[wf.stepLabel, isActive && wf.stepLabelActive, isDone && wf.stepLabelDone]}
              >
                {stage.label}
              </Text>
            </View>
            {i < STAGES.length - 1 && (
              <View style={[wf.connector, isDone && wf.connectorDone]} />
            )}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}

const wf = StyleSheet.create({
  scrollContent: { alignItems: 'flex-start', paddingHorizontal: spacing[5], paddingVertical: spacing[3], gap: 0 },
  step: { alignItems: 'center', width: 64, gap: 4 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.well,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepLabel: { fontSize: 10, color: colors.inkFaint, textAlign: 'center' },
  stepLabelActive: { color: colors.primary, fontWeight: typography.bold },
  stepLabelDone: { color: colors.success },
  connector: { width: 20, height: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 },
  connectorDone: { backgroundColor: colors.success },
});

// ─── Action button for each state ─────────────────────────────────────────────

function ActionCard({
  delivery,
  onAction,
  loading,
}: {
  delivery: ActiveDelivery;
  onAction: (action: string, extra?: any) => void;
  loading: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const location = useLocationStore();
  const router = useRouter();

  const pickProofPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri);
      setShowProofModal(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri);
      setShowProofModal(false);
    }
  };

  const { status } = delivery;

  if (status === 'ACCEPTED') {
    return (
      <Card style={ac.card} elevation="md">
        <Text style={ac.title}>Order Accepted</Text>
        <Text style={ac.desc}>Navigate to the pharmacy to pick up the order.</Text>
        <Button
          title="Start Navigation to Pharmacy"
          onPress={() => {
            onAction('en-route-pickup');
            router.push('/(tabs)/map');
          }}
          loading={loading}
          fullWidth
          leftIcon={<Ionicons name="navigate-outline" size={18} color={colors.white} />}
        />
      </Card>
    );
  }

  if (status === 'EN_ROUTE_TO_PICKUP') {
    return (
      <Card style={ac.card} elevation="md">
        <Text style={ac.title}>Heading to Pharmacy</Text>
        <Text style={ac.desc}>
          Tap when you have arrived at {delivery.pharmacyName}.
        </Text>
        <Button
          title="I've Arrived at Pharmacy"
          onPress={() => {
            if (!location.latitude || !location.longitude) {
              showToast('Waiting for GPS location…', 'warning');
              return;
            }
            onAction('arrived-pharmacy', {
              currentLat: location.latitude,
              currentLng: location.longitude,
            });
          }}
          loading={loading}
          fullWidth
          leftIcon={<Ionicons name="storefront-outline" size={18} color={colors.white} />}
        />
      </Card>
    );
  }

  if (status === 'ARRIVED_AT_PHARMACY') {
    return (
      <Card style={ac.card} elevation="md">
        <Text style={ac.title}>At Pharmacy</Text>
        <Text style={ac.desc}>Collect the order and confirm pickup.</Text>
        <TextInput
          style={ac.notesInput}
          placeholder="Pickup notes (optional)"
          placeholderTextColor={colors.inkFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />
        <Button
          title="Confirm Order Picked Up"
          onPress={() => onAction('picked-up', { notes })}
          loading={loading}
          fullWidth
          leftIcon={<Ionicons name="bag-check-outline" size={18} color={colors.white} />}
        />
      </Card>
    );
  }

  if (status === 'PICKED_UP') {
    return (
      <Card style={ac.card} elevation="md">
        <Text style={ac.title}>Order Picked Up!</Text>
        <Text style={ac.desc}>Navigate to the customer's address.</Text>
        <Button
          title="Navigate to Customer"
          onPress={() => {
            onAction('en-route-customer');
            router.push('/(tabs)/map');
          }}
          loading={loading}
          fullWidth
          leftIcon={<Ionicons name="car-outline" size={18} color={colors.white} />}
        />
      </Card>
    );
  }

  if (status === 'EN_ROUTE_TO_CUSTOMER') {
    return (
      <Card style={ac.card} elevation="md">
        <Text style={ac.title}>Heading to Customer</Text>
        <Text style={ac.desc}>Tap when you arrive at {delivery.order.customerAddress}.</Text>
        <Button
          title="I've Arrived at Customer"
          onPress={() => {
            if (!location.latitude || !location.longitude) {
              showToast('Waiting for GPS location…', 'warning');
              return;
            }
            onAction('arrived-customer', {
              currentLat: location.latitude,
              currentLng: location.longitude,
            });
          }}
          loading={loading}
          fullWidth
          leftIcon={<Ionicons name="home-outline" size={18} color={colors.white} />}
        />
      </Card>
    );
  }

  if (status === 'ARRIVED_AT_CUSTOMER') {
    return (
      <Card style={ac.card} elevation="md">
        <Text style={ac.title}>At Customer Location</Text>
        <Text style={ac.desc}>Complete the delivery with proof of delivery.</Text>

        {/* Proof photo */}
        <TouchableOpacity
          style={[ac.proofBox, proofUri && ac.proofBoxFilled]}
          onPress={() => setShowProofModal(true)}
          activeOpacity={0.7}
        >
          {proofUri ? (
            <Image source={{ uri: proofUri }} style={ac.proofImg} />
          ) : (
            <View style={ac.proofPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={colors.primary} />
              <Text style={ac.proofPlaceholderText}>Take Proof Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={ac.notesInput}
          placeholder="Delivery notes (optional)"
          placeholderTextColor={colors.inkFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />

        <Button
          title="Complete Delivery"
          onPress={() => {
            if (!proofUri) {
              showToast('Please take a proof of delivery photo', 'warning');
              return;
            }
            onAction('complete', { proofUri, notes });
          }}
          loading={loading}
          fullWidth
          leftIcon={<Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />}
        />

        {/* Photo picker modal */}
        <Modal visible={showProofModal} transparent animationType="slide">
          <View style={ac.modalOverlay}>
            <View style={ac.modalSheet}>
              <Text style={ac.modalTitle}>Add Proof of Delivery</Text>
              <TouchableOpacity style={ac.modalOption} onPress={pickProofPhoto}>
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
                <Text style={ac.modalOptionText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ac.modalOption} onPress={pickFromGallery}>
                <Ionicons name="images-outline" size={22} color={colors.primary} />
                <Text style={ac.modalOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ac.modalOption, { borderTopWidth: 1, borderTopColor: colors.borderSoft }]}
                onPress={() => setShowProofModal(false)}
              >
                <Text style={[ac.modalOptionText, { color: colors.error }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Card>
    );
  }

  return null;
}

const ac = StyleSheet.create({
  card: { padding: spacing[5], gap: spacing[4] },
  title: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.ink },
  desc: { fontSize: typography.sm, color: colors.inkMuted, lineHeight: 20 },
  notesInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing[3],
    fontSize: typography.sm,
    color: colors.ink,
    textAlignVertical: 'top',
    minHeight: 64,
  },
  proofBox: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    height: 160,
    overflow: 'hidden',
  },
  proofBoxFilled: { borderStyle: 'solid', borderColor: colors.success },
  proofImg: { width: '100%', height: '100%' },
  proofPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  proofPlaceholderText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.medium },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[1],
  },
  modalTitle: { fontSize: typography.md, fontWeight: typography.bold, color: colors.ink, marginBottom: spacing[3] },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  modalOptionText: { fontSize: typography.base, color: colors.ink },
});

// ─── Completion animation ─────────────────────────────────────────────────────

function CompletionScreen({ earnings, onDone }: { earnings: string; onDone: () => void }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 400 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={cs.container}>
      <Animated.View style={[cs.card, animStyle]}>
        <View style={cs.iconCircle}>
          <Ionicons name="trophy" size={56} color={colors.accent} />
        </View>
        <Text style={cs.title}>Delivery Complete!</Text>
        <Text style={cs.desc}>Excellent work. You've earned:</Text>
        <Text style={cs.earnings}>{parseFloat(earnings).toFixed(2)} EGP</Text>
        <Button title="Back to Orders" onPress={onDone} fullWidth size="lg" style={cs.btn} />
      </Animated.View>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, padding: spacing[5] },
  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing[8], alignItems: 'center', gap: spacing[4], width: '100%', ...shadows.xl },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FEF9C3', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography['2xl'], fontWeight: typography.extrabold, color: colors.ink },
  desc: { fontSize: typography.base, color: colors.inkMuted },
  earnings: { fontSize: typography['3xl'], fontWeight: typography.black, color: colors.primary },
  btn: { marginTop: spacing[4] },
});

// ─── Main delivery screen ─────────────────────────────────────────────────────

export default function DeliveryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const setActiveDelivery = useOrdersStore((s) => s.setActiveDelivery);
  const updateActiveDeliveryStatus = useOrdersStore((s) => s.updateActiveDeliveryStatus);

  const [completedEarnings, setCompletedEarnings] = useState<string | null>(null);

  // Poll active delivery
  const { data: deliveryData } = useQuery({
    queryKey: ['delivery', 'active'],
    queryFn: driverApi.getActiveDelivery,
    refetchInterval: 10_000,
  });

  // Sync active delivery to store
  useEffect(() => {
    if (deliveryData !== undefined) {
      setActiveDelivery((deliveryData as any).activeDelivery ?? null);
    }
  }, [deliveryData]);

  const actionMutation = useMutation({
    mutationFn: async ({ action, extra }: { action: string; extra?: any }) => {
      if (!activeDelivery) throw new Error('No active delivery');
      const orderId = activeDelivery.order.id;

      switch (action) {
        case 'en-route-pickup':
          return driverApi.enRouteToPickup(orderId);
        case 'arrived-pharmacy':
          return driverApi.arrivedPharmacy(orderId, extra.currentLat, extra.currentLng);
        case 'picked-up':
          return driverApi.pickedUp(orderId, extra?.notes);
        case 'en-route-customer':
          return driverApi.enRouteToCustomer(orderId);
        case 'arrived-customer':
          return driverApi.arrivedCustomer(orderId, extra.currentLat, extra.currentLng);
        case 'complete': {
          // Upload proof photo first
          let proofPhotoUrl: string | undefined;
          if (extra.proofUri) {
            const uploadRes = await driverApi.uploadDocument('vehicle', extra.proofUri);
            proofPhotoUrl = uploadRes.fileUrl;
          }
          return driverApi.completeDelivery(orderId, {
            proofPhotoUrl,
            deliveryNotes: extra.notes,
          });
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (data: any, variables) => {
      if (variables.action === 'complete') {
        setActiveDelivery(null);
        setCompletedEarnings(data.earnings ?? '0');
        queryClient.invalidateQueries({ queryKey: ['driver', 'statistics'] });
        queryClient.invalidateQueries({ queryKey: ['delivery', 'history'] });
      } else {
        updateActiveDeliveryStatus(data.status);
        queryClient.invalidateQueries({ queryKey: ['delivery', 'active'] });
        showToast(data.message ?? 'Status updated', 'success');
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Action failed. Please try again.';
      showToast(message, 'error');
    },
  });

  const handleAction = useCallback(
    (action: string, extra?: any) => {
      actionMutation.mutate({ action, extra });
    },
    [actionMutation],
  );

  // Completion screen
  if (completedEarnings !== null) {
    return (
      <CompletionScreen
        earnings={completedEarnings}
        onDone={() => {
          setCompletedEarnings(null);
          router.replace('/(tabs)');
        }}
      />
    );
  }

  // No active delivery
  if (!activeDelivery) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color={colors.border} />
          <Text style={s.emptyTitle}>No Active Delivery</Text>
          <Text style={s.emptyDesc}>
            Accept an order from the Orders tab to start a delivery.
          </Text>
          <Button
            title="View Available Orders"
            variant="outline"
            onPress={() => router.push('/(tabs)')}
            style={{ marginTop: spacing[4] }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Active Delivery</Text>
          <Text style={s.headerEarnings}>
            ~{parseFloat(activeDelivery.estimatedEarnings).toFixed(0)} EGP
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* Workflow stepper */}
          <WorkflowStepper currentStatus={activeDelivery.status} />

          {/* Action card */}
          <View style={s.section}>
            <ActionCard
              delivery={activeDelivery}
              onAction={handleAction}
              loading={actionMutation.isPending}
            />
          </View>

          {/* Order details */}
          <View style={s.section}>
            <Card style={s.detailCard} elevation="sm">
              <Text style={s.sectionTitle}>Order Details</Text>

              {/* Customer info */}
              <View style={s.detailRow}>
                <View style={s.detailIcon}>
                  <Ionicons name="person-outline" size={18} color={colors.primary} />
                </View>
                <View style={s.detailText}>
                  <Text style={s.detailLabel}>Customer</Text>
                  <Text style={s.detailValue}>{activeDelivery.order.customerName}</Text>
                </View>
                <TouchableOpacity
                  style={s.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${activeDelivery.order.customerPhone}`).catch(() =>
                      showToast('Cannot open phone dialer', 'error'),
                    )
                  }
                >
                  <Ionicons name="call-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Address */}
              <View style={s.detailRow}>
                <View style={s.detailIcon}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                </View>
                <View style={s.detailText}>
                  <Text style={s.detailLabel}>Deliver to</Text>
                  <Text style={s.detailValue}>{activeDelivery.order.customerAddress}</Text>
                </View>
              </View>

              {/* Payment */}
              <View style={s.detailRow}>
                <View style={s.detailIcon}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                </View>
                <View style={s.detailText}>
                  <Text style={s.detailLabel}>Payment</Text>
                  <Text style={s.detailValue}>
                    {activeDelivery.order.paymentMethod === 'cash' ? '💵 Cash on Delivery' : '💳 Card Payment'}
                  </Text>
                </View>
                <Text style={s.totalAmount}>
                  {parseFloat(activeDelivery.order.total).toFixed(2)} EGP
                </Text>
              </View>

              {/* Note */}
              {activeDelivery.order.note && (
                <View style={s.noteBox}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.info} />
                  <Text style={s.noteText}>{activeDelivery.order.note}</Text>
                </View>
              )}

              {/* Items summary */}
              <View style={s.itemsRow}>
                <Ionicons name="bag-outline" size={14} color={colors.inkMuted} />
                <Text style={s.itemsText}>
                  {activeDelivery.order.itemCount} item{activeDelivery.order.itemCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </Card>
          </View>

          {/* Pharmacy info */}
          <View style={s.section}>
            <Card style={s.detailCard} elevation="sm">
              <Text style={s.sectionTitle}>Pickup Location</Text>
              <View style={s.detailRow}>
                <View style={s.detailIcon}>
                  <Ionicons name="medical-outline" size={18} color={colors.info} />
                </View>
                <View style={s.detailText}>
                  <Text style={s.detailValue}>{activeDelivery.pharmacyName}</Text>
                  <Text style={s.detailLabel}>{activeDelivery.pharmacyAddress}</Text>
                </View>
              </View>
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headerTitle: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.ink },
  headerEarnings: { fontSize: typography.lg, fontWeight: typography.extrabold, color: colors.primary },

  scroll: { paddingBottom: spacing[12] },
  section: { paddingHorizontal: spacing[4], marginTop: spacing[3] },

  detailCard: { padding: spacing[4], gap: spacing[3] },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.ink,
    marginBottom: spacing[2],
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: { flex: 1 },
  detailLabel: { fontSize: typography.xs, color: colors.inkMuted },
  detailValue: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.ink, marginTop: 1 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalAmount: { fontSize: typography.base, fontWeight: typography.bold, color: colors.ink },
  noteBox: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: '#EFF6FF',
    padding: spacing[3],
    borderRadius: radii.md,
  },
  noteText: { flex: 1, fontSize: typography.xs, color: colors.info },
  itemsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  itemsText: { fontSize: typography.xs, color: colors.inkMuted },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
  emptyTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.ink },
  emptyDesc: { fontSize: typography.base, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
});
