/**
 * Delivery Screen — active delivery workflow (2026 premium rebuild).
 * Arabic UI, Cairo fonts, teal brand, premium cards.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, typography, spacing, radii, shadows } from '@pharmacy/ui-native/courier-tokens';
import { Button, showToast } from '@pharmacy/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import {
  useOrdersStore,
  type DeliveryStatus,
  type ActiveDelivery,
} from '@/stores/orders.store';
import { useLocationStore } from '@/stores/location.store';

// ─── Workflow config ──────────────────────────────────────────────────────────

const STATUS_ORDER: DeliveryStatus[] = [
  'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PHARMACY',
  'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'ARRIVED_AT_CUSTOMER', 'DELIVERED',
];

const STAGE_LABELS: Record<string, string> = {
  ACCEPTED:             'قبول',
  EN_ROUTE_TO_PICKUP:   'للصيدلية',
  ARRIVED_AT_PHARMACY:  'عند الصيدلية',
  PICKED_UP:            'استلام',
  EN_ROUTE_TO_CUSTOMER: 'للعميل',
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
      horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={wf.container}
    >
      {STATUS_ORDER.map((s, i) => {
        const done = i < idx, active = i === idx;
        return (
          <React.Fragment key={s}>
            <View style={wf.step}>
              <View style={[wf.dot, done && wf.dotDone, active && wf.dotActive]}>
                {done
                  ? <Ionicons name="checkmark" size={13} color="#fff" />
                  : <Ionicons name={STAGE_ICONS[s]} size={13}
                      color={active ? '#fff' : colors.inkFaint} />
                }
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
  container:   { alignItems: 'flex-start', paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  step:        { alignItems: 'center', width: 62, gap: 5 },
  dot:         { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.well, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  dotDone:     { backgroundColor: colors.success,  borderColor: colors.success },
  label:       { fontFamily: typography.regular, fontSize: 10, color: colors.inkFaint, textAlign: 'center', lineHeight: 14 },
  labelActive: { fontFamily: typography.bold, color: colors.primary },
  labelDone:   { color: colors.success },
  line:        { width: 18, height: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  lineDone:    { backgroundColor: colors.success },
});

// ─── Action area per status ───────────────────────────────────────────────────

function PrimaryActionArea({
  delivery, onAction, loading,
}: { delivery: ActiveDelivery; onAction: (a: string, e?: any) => void; loading: boolean }) {
  const [notes, setNotes] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const loc = useLocationStore();

  const hasGps = () => {
    if (!loc.latitude || !loc.longitude) { showToast('في انتظار GPS…', 'warning'); return false; }
    return true;
  };
  const pickPhoto   = async () => { const r = await ImagePicker.launchCameraAsync({ quality: 0.8 }); if (!r.canceled) { setProofUri(r.assets[0].uri); setShowModal(false); } };
  const pickGallery = async () => { const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images }); if (!r.canceled) { setProofUri(r.assets[0].uri); setShowModal(false); } };

  const { status: st } = delivery;

  const CFG: Record<string, { title: string; desc: string; btn: string; icon: React.ComponentProps<typeof Ionicons>['name']; act: () => void }> = {
    ACCEPTED:             { title: 'تم قبول الطلب',      desc: `توجّه إلى ${delivery.pharmacyName}`,      btn: 'ابدأ التوجه للصيدلية',  icon: 'navigate-outline',    act: () => onAction('en-route-pickup') },
    EN_ROUTE_TO_PICKUP:   { title: 'في طريقك للصيدلية',   desc: `اضغط عند وصولك إلى ${delivery.pharmacyName}`, btn: 'وصلت للصيدلية', icon: 'storefront-outline',  act: () => hasGps() && onAction('arrived-pharmacy', { currentLat: loc.latitude, currentLng: loc.longitude }) },
    ARRIVED_AT_PHARMACY:  { title: 'عند الصيدلية',        desc: 'استلم الطلب ثم اضغط للتأكيد.',           btn: 'تأكيد استلام الطلب',    icon: 'bag-check-outline',   act: () => onAction('picked-up', { notes }) },
    PICKED_UP:            { title: 'تم استلام الطلب!',    desc: 'توجه الآن إلى عنوان العميل.',             btn: 'ابدأ التوجه للعميل',    icon: 'car-outline',         act: () => onAction('en-route-customer') },
    EN_ROUTE_TO_CUSTOMER: { title: 'في طريقك للعميل',     desc: `اضغط عند وصولك إلى ${delivery.order.customerAddress}`, btn: 'وصلت للعميل', icon: 'home-outline',        act: () => hasGps() && onAction('arrived-customer', { currentLat: loc.latitude, currentLng: loc.longitude }) },
  };

  if (st === 'ARRIVED_AT_CUSTOMER') {
    return (
      <View style={ac.card}>
        <Text style={ac.title}>إتمام التوصيل</Text>
        <Text style={ac.desc}>التقط صورة إثبات التسليم ثم اضغط للإتمام.</Text>
        <TouchableOpacity style={[ac.proof, proofUri && ac.proofFilled]} onPress={() => setShowModal(true)} activeOpacity={0.75}>
          {proofUri
            ? <Image source={{ uri: proofUri }} style={ac.proofImg} />
            : <View style={ac.proofPh}><Ionicons name="camera-outline" size={28} color={colors.primary} /><Text style={ac.proofTip}>اضغط لالتقاط صورة</Text></View>}
        </TouchableOpacity>
        <TextInput style={ac.notes} placeholder="ملاحظات التوصيل" placeholderTextColor={colors.inkFaint} value={notes} onChangeText={setNotes} multiline numberOfLines={2} textAlign="right" />
        <Button title="تأكيد التوصيل ✓" onPress={() => { if (!proofUri) { showToast('يرجى التقاط صورة إثبات', 'warning'); return; } onAction('complete', { proofUri, notes }); }} loading={loading} fullWidth />
        <Modal visible={showModal} transparent animationType="slide">
          <View style={ac.overlay}><View style={ac.sheet}>
            <Text style={ac.sheetTitle}>إضافة إثبات التسليم</Text>
            <TouchableOpacity style={ac.opt} onPress={pickPhoto}><Ionicons name="camera-outline" size={20} color={colors.primary}/><Text style={ac.optText}>التقاط صورة</Text></TouchableOpacity>
            <TouchableOpacity style={ac.opt} onPress={pickGallery}><Ionicons name="images-outline" size={20} color={colors.primary}/><Text style={ac.optText}>من المعرض</Text></TouchableOpacity>
            <TouchableOpacity style={[ac.opt,{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.borderSoft}]} onPress={() => setShowModal(false)}><Text style={[ac.optText,{color:colors.error}]}>إلغاء</Text></TouchableOpacity>
          </View></View>
        </Modal>
      </View>
    );
  }

  const c = CFG[st];
  if (!c) return null;
  return (
    <View style={ac.card}>
      <Text style={ac.title}>{c.title}</Text>
      <Text style={ac.desc}>{c.desc}</Text>
      {st === 'ARRIVED_AT_PHARMACY' && (
        <TextInput style={ac.notes} placeholder="ملاحظات الاستلام" placeholderTextColor={colors.inkFaint} value={notes} onChangeText={setNotes} multiline numberOfLines={2} textAlign="right" />
      )}
      <Button title={c.btn} onPress={c.act} loading={loading} fullWidth leftIcon={<Ionicons name={c.icon} size={18} color="#fff" />} />
    </View>
  );
}

const ac = StyleSheet.create({
  card:       { padding: spacing[5], gap: spacing[4] },
  title:      { fontFamily: typography.bold, fontSize: typography.md, color: colors.ink, textAlign: 'right' },
  desc:       { fontFamily: typography.regular, fontSize: typography.sm, color: colors.inkMuted, lineHeight: 20, textAlign: 'right' },
  notes:      { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.lg, padding: spacing[3], fontFamily: typography.regular, fontSize: typography.sm, color: colors.ink, textAlignVertical: 'top', minHeight: 64 },
  proof:      { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radii.xl, height: 140, overflow: 'hidden' },
  proofFilled:{ borderStyle: 'solid', borderColor: colors.success },
  proofImg:   { width: '100%', height: '100%' },
  proofPh:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  proofTip:   { fontFamily: typography.medium, fontSize: typography.sm, color: colors.primary },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: colors.surface, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], padding: spacing[5], paddingBottom: spacing[10], gap: spacing[1] },
  sheetTitle: { fontFamily: typography.bold, fontSize: typography.md, color: colors.ink, marginBottom: spacing[3], textAlign: 'right' },
  opt:        { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
  optText:    { fontFamily: typography.regular, fontSize: typography.base, color: colors.ink },
});

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ earnings, onDone }: { earnings: string; onDone: () => void }) {
  const scale = useSharedValue(0), opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 400 });
  }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <View style={cs.bg}>
      <Animated.View style={[cs.card, anim]}>
        <View style={cs.trophy}><Ionicons name="trophy" size={52} color={colors.accent} /></View>
        <Text style={cs.title}>تم التوصيل بنجاح!</Text>
        <Text style={cs.sub}>عمل رائع، لقد حصلت على:</Text>
        <Text style={cs.earnings}>{parseFloat(earnings).toFixed(2)} ج.م</Text>
        <Button title="العودة للطلبات" onPress={onDone} fullWidth size="lg" />
      </Animated.View>
    </View>
  );
}
const cs = StyleSheet.create({
  bg:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, padding: spacing[5] },
  card:     { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing[8], alignItems: 'center', gap: spacing[4], width: '100%', ...shadows.xl },
  trophy:   { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FEF9C3', alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: typography.black, fontSize: typography['2xl'], color: colors.ink },
  sub:      { fontFamily: typography.regular, fontSize: typography.base, color: colors.inkMuted },
  earnings: { fontFamily: typography.black, fontSize: typography['3xl'], color: colors.primary },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DeliveryScreen() {
  const router = useRouter(), qc = useQueryClient();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const setActive      = useOrdersStore((s) => s.setActiveDelivery);
  const updateStatus   = useOrdersStore((s) => s.updateActiveDeliveryStatus);
  const [completedEarnings, setCompletedEarnings] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['delivery', 'active'], queryFn: driverApi.getActiveDelivery, refetchInterval: 10_000 });
  useEffect(() => { if (data !== undefined) setActive((data as any).activeDelivery ?? null); }, [data]);

  const actionMutation = useMutation({
    mutationFn: async ({ action, extra }: { action: string; extra?: any }) => {
      if (!activeDelivery) throw new Error('No active delivery');
      const oid = activeDelivery.order.id;
      switch (action) {
        case 'en-route-pickup':   return driverApi.enRouteToPickup(oid);
        case 'arrived-pharmacy':  return driverApi.arrivedPharmacy(oid, extra.currentLat, extra.currentLng);
        case 'picked-up':         return driverApi.pickedUp(oid, extra?.notes);
        case 'en-route-customer': return driverApi.enRouteToCustomer(oid);
        case 'arrived-customer':  return driverApi.arrivedCustomer(oid, extra.currentLat, extra.currentLng);
        case 'complete': {
          let proofUrl: string | undefined;
          if (extra?.proofUri) { const r = await driverApi.uploadDocument('vehicle', extra.proofUri); proofUrl = r.fileUrl; }
          return driverApi.completeDelivery(oid, { proofPhotoUrl: proofUrl, deliveryNotes: extra?.notes });
        }
        default: throw new Error(`Unknown: ${action}`);
      }
    },
    onSuccess: (res: any, { action }) => {
      if (action === 'complete') { setActive(null); setCompletedEarnings(res.earnings ?? '0'); qc.invalidateQueries({ queryKey: ['driver', 'statistics'] }); }
      else { updateStatus(res.status); qc.invalidateQueries({ queryKey: ['delivery', 'active'] }); showToast(res.message ?? 'تم تحديث الحالة', 'success'); }
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'حدث خطأ', 'error'),
  });

  const handleAction = useCallback((action: string, extra?: any) => actionMutation.mutate({ action, extra }), [actionMutation]);

  if (completedEarnings !== null) {
    return <CompletionScreen earnings={completedEarnings} onDone={() => { setCompletedEarnings(null); router.replace('/(tabs)'); }} />;
  }

  if (!activeDelivery) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}><Ionicons name="cube-outline" size={44} color={colors.inkFaint} /></View>
          <Text style={s.emptyTitle}>لا توجد توصيلة نشطة</Text>
          <Text style={s.emptyDesc}>اقبل طلبًا من تبويب الطلبات لبدء التوصيل.</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={s.emptyBtnText}>عرض الطلبات المتاحة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const d = activeDelivery;

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.orderId}>#{d.order.id.slice(-8).toUpperCase()}</Text>
            <Text style={s.orderStatus}>{STAGE_LABELS[d.status] ?? d.status}</Text>
          </View>
          <View style={[s.headerBadge, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.section}>
            <View style={s.activeCard}>
              <View style={s.activeHeader}>
                <View style={s.activeLabel}><View style={s.activeDot} /><Text style={s.activeLabelText}>ACTIVE DELIVERY</Text></View>
                <View style={s.activeActions}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/(tabs)/map')} hitSlop={8}>
                    <Ionicons name="navigate-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(`tel:${d.order.customerPhone}`).catch(() => {})} hitSlop={8}>
                    <Ionicons name="call-outline" size={17} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={s.customerName}>{d.order.customerName}</Text>
              <Text style={s.customerAddr} numberOfLines={2}>{d.order.customerAddress}</Text>
            </View>
          </View>

          <View style={s.stepperCard}><WorkflowStepper status={d.status} /></View>

          <View style={s.section}>
            <View style={s.actionCard}><PrimaryActionArea delivery={d} onAction={handleAction} loading={actionMutation.isPending} /></View>
          </View>

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

          <View style={s.section}>
            <Text style={s.sectionTitle}>الأصناف</Text>
            <View style={s.infoCard}>
              {d.order.items.map((item, i) => (
                <View key={i} style={[s.itemRow, i > 0 && s.infoRowBorder]}>
                  <Text style={s.itemName} numberOfLines={2}>{item.snapshot?.nameAr ?? item.snapshot?.name ?? item.productId}</Text>
                  <Text style={s.itemPrice}>{item.quantity} × {parseFloat(item.unitPrice).toFixed(2)} ج.م</Text>
                </View>
              ))}
              <View style={[s.totalRow, s.infoRowBorder]}>
                <Text style={s.totalLabel}>الإجمالي</Text>
                <Text style={s.totalValue}>{parseFloat(d.order.total).toFixed(2)} ج.م</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.reportBtn} onPress={() => showToast('تم إرسال البلاغ', 'info')}>
            <Ionicons name="warning-outline" size={15} color={colors.error} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[4], backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  orderId: { fontFamily: typography.black, fontSize: typography.lg, color: colors.ink },
  orderStatus: { fontFamily: typography.regular, fontSize: typography.sm, color: colors.inkMuted, marginTop: 2 },
  headerBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing[8] },
  section: { paddingHorizontal: spacing[4], marginTop: spacing[3] },
  sectionTitle: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.ink, marginBottom: spacing[2], textAlign: 'right' },
  activeCard: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing[4], gap: spacing[2], ...shadows.sm, borderWidth: 1, borderColor: colors.borderSoft },
  activeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online },
  activeLabelText: { fontFamily: typography.bold, fontSize: 10, color: colors.inkFaint, letterSpacing: 0.8 },
  activeActions: { flexDirection: 'row', gap: spacing[2] },
  actionBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontFamily: typography.bold, fontSize: typography.md, color: colors.ink, textAlign: 'right' },
  customerAddr: { fontFamily: typography.regular, fontSize: typography.sm, color: colors.inkMuted, textAlign: 'right' },
  stepperCard: { backgroundColor: colors.surface, marginTop: spacing[3], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft },
  actionCard: { backgroundColor: colors.surface, borderRadius: radii['2xl'], overflow: 'hidden', ...shadows.sm },
  infoCard: { backgroundColor: colors.surface, borderRadius: radii['2xl'], overflow: 'hidden', ...shadows.sm, borderWidth: 1, borderColor: colors.borderSoft },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[4] },
  infoRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  infoLabel: { fontFamily: typography.medium, fontSize: typography.sm, color: colors.inkMuted, flexShrink: 0 },
  infoValue: { fontFamily: typography.semibold, fontSize: typography.sm, color: colors.ink, flex: 1, textAlign: 'right' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  itemName: { flex: 1, fontFamily: typography.semibold, fontSize: typography.sm, color: colors.ink, textAlign: 'right' },
  itemPrice: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.primary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  totalLabel: { fontFamily: typography.medium, fontSize: typography.sm, color: colors.inkMuted },
  totalValue: { fontFamily: typography.black, fontSize: typography.base, color: colors.primary },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginTop: spacing[4], paddingVertical: spacing[3] },
  reportText: { fontFamily: typography.medium, fontSize: typography.sm, color: colors.error },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[4] },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.well, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: typography.black, fontSize: typography.xl, color: colors.ink },
  emptyDesc: { fontFamily: typography.regular, fontSize: typography.base, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.primary, marginTop: spacing[2] },
  emptyBtnText: { fontFamily: typography.semibold, fontSize: typography.sm, color: colors.primary },
});
