import React, { useCallback, useMemo, useState } from "react";
import { 
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ActionSheetIOS, Platform, Alert
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Screen, Text as UIText, Input, Button, kit, useTheme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, valueTextAlign } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { supabase } from "@/lib/supabase";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { findBranchById } from "@/features/delivery/branches/data";
import { getPaymentMeta, getPaymentStatusDisplay } from "@/features/orders/components/OrderDetailHelpers";

import { usePharmacistOrder, useOrderDeliveryAssignment, useOrderTimeline, useActiveDeliveryIssue } from "../hooks/usePharmacistQueries";
import { usePharmacistMutations } from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import { OrderStatusChip } from "../components/OrderStatusChip";
import { PharmacistActionDock } from "../components/PharmacistActionDock";
import { getOrderAttentionReason } from "../domain/orderAttention";
import { getPharmacistActionTargets } from "../domain/orderActions";
import type { PharmacistTransitionTarget, OrderTimelineEvent, DeliveryAssignmentStatus, DeliveryIssueReasonCode } from "../api/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const VALID_TRANSITION_TARGETS = new Set<PharmacistTransitionTarget>([
  "verification", "payment_pending", "payment_approved", "preparing", "ready", "cancelled",
]);

function actionLabel(target: PharmacistTransitionTarget, t: (k: string) => string): string {
  switch (target) {
    case "verification":     return t("pharmacist.actionVerify");
    case "payment_pending":  return t("pharmacist.actionRequestPayment");
    case "payment_approved": return t("pharmacist.actionApprovePayment");
    case "preparing":        return t("pharmacist.actionStartPreparing");
    case "ready":            return t("pharmacist.actionMarkReady");
    case "cancelled":        return t("pharmacist.actionCancel");
    default:                 return target;
  }
}

function SectionCard({ title, icon, children, theme }: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={[s.section, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
      <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name={icon} size={14} color={theme.colors.text.muted} />
        <UIText variant="eyebrow" color="secondary">{title}</UIText>
      </View>
      {children}
    </View>
  );
}

const TIMELINE_META: Record<OrderTimelineEvent["eventType"], { icon: React.ComponentProps<typeof Ionicons>["name"]; labelKey: string }> = {
  order_created:          { icon: "receipt-outline",         labelKey: "pharmacist.timelineOrderCreated" },
  assignment_offered:     { icon: "paper-plane-outline",      labelKey: "pharmacist.timelineAssignmentOffered" },
  assignment_declined:    { icon: "close-circle-outline",     labelKey: "pharmacist.timelineAssignmentDeclined" },
  assignment_accepted:    { icon: "checkmark-circle-outline", labelKey: "pharmacist.timelineAssignmentAccepted" },
  picked_up:              { icon: "bicycle-outline",          labelKey: "pharmacist.timelinePickedUp" },
  delivered:              { icon: "checkmark-done-outline",   labelKey: "pharmacist.timelineDelivered" },
  assignment_superseded:  { icon: "swap-horizontal-outline",  labelKey: "pharmacist.timelineAssignmentSuperseded" },
  issue_reported:         { icon: "warning-outline",          labelKey: "pharmacist.timelineIssueReported" },
  issue_resolved:         { icon: "shield-checkmark-outline", labelKey: "pharmacist.timelineIssueResolved" },
  note_added:             { icon: "chatbox-ellipses-outline", labelKey: "pharmacist.timelineNoteAdded" },
};

const ASSIGNMENT_STATUS_LABEL: Record<DeliveryAssignmentStatus, string> = {
  offered:   "pharmacist.driverOffered",
  accepted:  "pharmacist.driverAccepted",
  declined:  "pharmacist.driverDeclined",
  completed: "pharmacist.driverCompleted",
};

const ISSUE_REASON_LABEL: Record<DeliveryIssueReasonCode, string> = {
  customer_unreachable: "pharmacist.issueCustomerUnreachable",
  wrong_address:        "pharmacist.issueWrongAddress",
  customer_refused:     "pharmacist.issueCustomerRefused",
  item_damaged:         "pharmacist.issueItemDamaged",
  item_missing:         "pharmacist.issueItemMissing",
  access_issue:         "pharmacist.issueAccessIssue",
  vehicle_breakdown:    "pharmacist.issueVehicleBreakdown",
  other:                "pharmacist.issueOther",
};

/** Driver-reported delivery problem — a real, backend-verified blocker,
 * distinct from (and stackable with) a prescription attention reason. Tap
 * to expand and resolve inline, same interaction pattern as RefillsScreen's
 * cards. */
function IssueBanner({ orderId, issue, theme }: {
  orderId: string;
  issue: { id: string; reasonCode: DeliveryIssueReasonCode; note: string | null };
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const { t } = useTranslation();
  const mutations = usePharmacistMutations();
  const [expanded, setExpanded] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [touched, setTouched] = useState(false);

  const handleResolve = async () => {
    if (resolutionNote.trim().length === 0) { setTouched(true); return; }
    try {
      await mutations.resolveIssue.mutateAsync({ issueId: issue.id, orderId, resolutionNote: resolutionNote.trim() });
      showSuccessSheet(t("pharmacist.issueResolvedTitle", "Issue resolved"), t("pharmacist.issueResolvedBody", "The delivery issue has been marked resolved."));
      setExpanded(false);
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={[s.attentionBanner, { flexDirection: flexRow(IS_RTL), alignItems: "flex-start", backgroundColor: `${theme.colors.status.error}14`, borderColor: theme.colors.status.error }]}
        accessibilityRole="button"
      >
        <Ionicons name="alert-circle" size={18} color={theme.colors.status.error} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <UIText variant="body-sm" weight="bold" style={{ textAlign: TEXT_START, color: theme.colors.status.error }}>
            {t(ISSUE_REASON_LABEL[issue.reasonCode])}
          </UIText>
          {issue.note ? (
            <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>{issue.note}</UIText>
          ) : null}

          {expanded && (
            <View style={{ marginTop: 10, gap: 8 }}>
              <Input
                value={resolutionNote}
                onChangeText={(v) => { setResolutionNote(v); if (touched) setTouched(false); }}
                placeholder={t("pharmacist.resolutionNotePlaceholder", "How was this resolved?")}
                multiline
              />
              {touched && resolutionNote.trim().length === 0 ? (
                <UIText variant="caption" color="danger">{t("pharmacist.resolutionNoteRequired", "A resolution note is required.")}</UIText>
              ) : null}
              <Button
                label={t("pharmacist.actionResolveIssue")}
                onPress={handleResolve}
                loading={mutations.resolveIssue.isPending}
                variant="danger"
                full
              />
            </View>
          )}
        </View>
        <Ionicons name={expanded ? "chevron-up" : (IS_RTL ? "chevron-back" : "chevron-forward")} size={16} color={theme.colors.text.muted} />
      </Pressable>
    </Animated.View>
  );
}

export function PharmacistOrderDetailScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "ar" ? "ar-EG" : "en-US";
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const [actionsState, setActionsState] = useState<any>(null);
  React.useEffect(() => {
    if (id) {
      supabase.rpc("get_order_actions", { p_order_id: id }).then(({ data }) => setActionsState(data as any));
    }
  }, [id]);
  const router = useRouter();
  const { pagePad, isTablet } = useScreenLayout();

  const orderQuery = usePharmacistOrder(id);
  const mutations = usePharmacistMutations();

  const order = orderQuery.data;
  const attentionReason = order ? getOrderAttentionReason(order) : null;
  const showDriverSection = Boolean(order && ["ready", "driver_assigned", "driver_accepted", "out_for_delivery", "delivered"].includes(order.status));
  const assignmentQuery = useOrderDeliveryAssignment(id, showDriverSection);
  const timelineQuery = useOrderTimeline(id);
  const issueQuery = useActiveDeliveryIssue(id);

  const [noteDraft, setNoteDraft] = useState("");
  const handleAddNote = useCallback(async () => {
    if (!id || noteDraft.trim().length === 0) return;
    try {
      await mutations.addNote.mutateAsync({ orderId: id, body: noteDraft.trim() });
      setNoteDraft("");
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  }, [id, noteDraft, mutations.addNote, t]);

  const actions = useMemo(
    () => (order ? getPharmacistActionTargets(order.status) : []),
    [order],
  );

  const handleAdvance = useCallback(
    async (target: string) => {
      if (!id || !VALID_TRANSITION_TARGETS.has(target as PharmacistTransitionTarget)) return;
      const nextStatus = target as PharmacistTransitionTarget;
      if (nextStatus === "cancelled") {
        if (Platform.OS === 'ios') {
          const options = ["PRODUCT_UNAVAILABLE","STOCK_MISMATCH","PRESCRIPTION_REJECTED","PRESCRIPTION_UNCLEAR","PHARMACY_CANNOT_FULFILL","PHARMACY_CLOSED","OTHER"].concat(['Cancel']);
          ActionSheetIOS.showActionSheetWithOptions({
            options,
            cancelButtonIndex: options.length - 1,
            title: 'Select Cancellation Reason'
          }, async (btnIdx: number) => {
             if (btnIdx !== options.length - 1) {
                const reason = options[btnIdx];
                try {
                  await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason } as any);
                  showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                } catch(e: any) { Alert.alert('Error', e.message); }
             }
          });
        } else {
            // Android Alert
            const rList = actionsState?.cancel?.reasons || [];
            Alert.alert(
                'Cancel Order',
                'Select a cancellation reason:',
                [
                    { text: 'Cancel', style: 'cancel' },
                    ...rList.slice(0, 2).map((r: string) => ({
                        text: r,
                        onPress: async () => {
                            try {
                                await mutations.advance.mutateAsync({ orderId: id, nextStatus, reason: r } as any);
                                showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
                            } catch(e: any) { Alert.alert('Error', e.message); }
                        }
                    }))
                ]
            );
        }
        return;
      }
      try {
        await mutations.advance.mutateAsync({ orderId: id, nextStatus });
        if (target === "cancelled") {
          showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
        } else {
          showSuccessSheet(t("pharmacist.advancedTitle"), t("pharmacist.advancedBody"));
        }
      } catch (e) {
        showErrorSheet(
          t("pharmacist.actionFailedTitle"),
          e instanceof Error ? e.message : t("pharmacist.actionFailedBody"),
        );
      }
    },
    [id, mutations.advance, t],
  );

  if (orderQuery.isLoading) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={`#${(id ?? "").slice(-8).toUpperCase()}`} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.brand.primary} />
        </View>
      </Screen>
    );
  }

  if (orderQuery.isError) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={t("pharmacist.orderDetails")} />
        <View style={s.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.text.muted} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("errors.generic", "Something went wrong")}
          </UIText>
          <Pressable
            onPress={() => void orderQuery.refetch()}
            style={[s.pillBtn, { marginTop: 16, backgroundColor: theme.colors.brand.primaryLight }]}
          >
            <Ionicons name="refresh" size={16} color={theme.colors.brand.primary} />
            <UIText variant="body-sm" style={{ color: theme.colors.brand.primary }}>
              {t("pharmacist.retry", "Try Again")}
            </UIText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={t("pharmacist.orderNotFound")} />
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.text.muted} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("pharmacist.orderNotFound")}
          </UIText>
        </View>
      </Screen>
    );
  }

  const isUrgent = (order.ageMs ?? 0) > 30 * 60_000;
  const branchName = order.branchId ? (findBranchById(order.branchId)?.nameAr ?? order.branchId) : null;

  // getPharmacistActionTargets already lists the sensible default transition
  // first for every status, and PharmacistActionDock already treats index 0
  // as the visually primary button (outline for the rest, ghost for cancel)
  // — so the array's existing order is already "most relevant action first."
  const dockActions = actions.map((action) => ({
    key: action,
    label: actionLabel(action, t),
    variant: action === "cancelled" ? "ghost" as const : undefined,
  }));

  const assignment = assignmentQuery.data;
  const timeline = timelineQuery.data ?? [];

  return (
    <Screen edgeTop background={theme.colors.canvas.background} edgeBottom>
      <PharmacistScreenHeader title={t("pharmacist.orderDetails")} />

      <ScrollView
        contentContainerStyle={[s.scroll, isTablet && { maxWidth: 720, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: identity + status */}
        <View style={[s.topCard, { paddingHorizontal: pagePad, backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <View>
              <View style={[s.row, { gap: 6 }]}>
                <UIText variant="body" weight="bold">#{order.id.slice(-8).toUpperCase()}</UIText>
                {isUrgent && <Ionicons name="warning" size={13} color={theme.colors.status.warning} />}
              </View>
              <UIText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                {new Date(order.createdAt || Date.now()).toLocaleString(dateLocale)}
                {branchName ? `  ·  ${branchName}` : ""}
              </UIText>
            </View>
            <OrderStatusChip status={order.status} size="md" />
          </View>
        </View>

        {/* Attention banner — the problem, before ordinary information */}
        {attentionReason && (
          <Animated.View entering={FadeIn.duration(220)}>
            <Pressable
              onPress={() => {
                const rxId = order.linkedPrescriptions.find((p) =>
                  attentionReason === "prescription_rejected" ? p.reviewStatus === "rejected" : p.reviewStatus === "pending_review",
                )?.id;
                if (rxId) router.push(`/(pharmacist)/prescription/${rxId}`);
              }}
              style={[
                s.attentionBanner,
                { flexDirection: flexRow(IS_RTL) },
                {
                  backgroundColor: attentionReason === "prescription_rejected" ? `${theme.colors.status.error}14` : `${theme.colors.status.warning}14`,
                  borderColor: attentionReason === "prescription_rejected" ? theme.colors.status.error : theme.colors.status.warning,
                },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name={attentionReason === "prescription_rejected" ? "close-circle" : "alert-circle"}
                size={18}
                color={attentionReason === "prescription_rejected" ? theme.colors.status.error : theme.colors.status.warning}
              />
              <UIText
                variant="body-sm"
                weight="bold"
                numberOfLines={2}
                style={{ flex: 1, minWidth: 0, textAlign: TEXT_START, color: attentionReason === "prescription_rejected" ? theme.colors.status.error : theme.colors.status.warning }}
              >
                {t(attentionReason === "prescription_rejected" ? "pharmacist.attentionPrescriptionRejected" : "pharmacist.attentionPrescriptionPending")}
              </UIText>
              <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={16} color={theme.colors.text.muted} />
            </Pressable>
          </Animated.View>
        )}

        {/* Delivery issue banner — a real driver-reported blocker, independent
            of and stackable with a prescription attention reason. */}
        {issueQuery.data && (
          <IssueBanner orderId={order.id} issue={issueQuery.data} theme={theme} />
        )}

        {/* Customer — identity + contact only. Name sits in its own flexed,
            truncating column so a long customer name can never push the
            call pill off-screen or overlap it (previously an unconstrained
            row with no flex/minWidth on the name text). */}
        <SectionCard title={t("pharmacist.sectionCustomer")} icon="person-outline" theme={theme}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1, minWidth: 0, marginEnd: 8 }}>
              <UIText variant="body" weight="bold" numberOfLines={1}>{order.customerName}</UIText>
            </View>
            <Pressable onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} style={[s.pillBtn, { backgroundColor: theme.colors.brand.primaryLight, flexShrink: 0 }]}>
              <Ionicons name="call" size={16} color={theme.colors.brand.primary} />
              <UIText variant="body-sm" style={{ color: theme.colors.brand.primary }}>{order.customerPhone}</UIText>
            </Pressable>
          </View>
        </SectionCard>

        {/* Products */}
        <SectionCard title={t("pharmacist.sectionMedicines")} icon="medkit-outline" theme={theme}>
          <View style={s.table}>
            {order.items.map((item, index) => (
              <View key={item.productId} style={[s.tableRow, index === 0 && { borderTopWidth: 0 }, { borderTopColor: theme.colors.border.default }]}>
                {item.imageUrl ? (
                  <ExpoImage source={{ uri: item.imageUrl }} style={s.itemImg} contentFit="contain" />
                ) : (
                  <View style={[s.itemImg, s.itemImgPlaceholder, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                    <Ionicons name="medkit" size={16} color={theme.colors.text.muted} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>
                  <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>
                    {item.name || item.code || item.productId}
                  </UIText>
                </View>
                <UIText variant="body-sm" style={{ width: 40, textAlign: "center" }}>{item.quantity}</UIText>
                <UIText variant="body-sm" weight="bold" style={{ width: 70, textAlign: valueTextAlign }}>
                  {formatPrice(item.lineTotal)}
                </UIText>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Prescription — first-class, not an afterthought */}
        {order.linkedPrescriptions.length > 0 && (
          <SectionCard title={t("pharmacist.sectionPrescription", "Prescription")} icon="document-text-outline" theme={theme}>
            {order.linkedPrescriptions.map((rx) => {
              const color = rx.reviewStatus === "approved" ? theme.colors.status.success
                : rx.reviewStatus === "rejected" ? theme.colors.status.error
                : theme.colors.status.warning;
              return (
                <Pressable
                  key={rx.id}
                  onPress={() => router.push(`/(pharmacist)/prescription/${rx.id}`)}
                  style={[s.row, { justifyContent: "space-between", paddingVertical: 6 }]}
                >
                  <View style={[s.row, { gap: 6 }]}>
                    <View style={[s.dot, { backgroundColor: color }]} />
                    <UIText variant="body-sm">
                      {t(rx.reviewStatus === "approved" ? "pharmacist.rxApproved" : rx.reviewStatus === "rejected" ? "pharmacist.rxRejected" : "pharmacist.rxPending")}
                    </UIText>
                  </View>
                  <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={16} color={theme.colors.text.muted} />
                </Pressable>
              );
            })}
          </SectionCard>
        )}

        {/* Delivery */}
        {(order.zoneName || branchName || order.note || order.landmark || order.building) && (
          <SectionCard title={t("pharmacist.sectionDelivery", "Delivery")} icon="location-outline" theme={theme}>
            <UIText variant="body-sm" style={{ textAlign: TEXT_START }}>{order.customerAddress}</UIText>
            {(order.building || order.floor || order.apartment) ? (
              <UIText variant="body-sm" color="secondary" style={{ marginTop: 4, textAlign: TEXT_START }}>
                {[
                  order.building ? `${t("pharmacist.building", "Building")} ${order.building}` : null,
                  order.floor ? `${t("pharmacist.floor", "Floor")} ${order.floor}` : null,
                  order.apartment ? `${t("pharmacist.apartment", "Apt")} ${order.apartment}` : null,
                ].filter(Boolean).join(" · ")}
              </UIText>
            ) : null}
            {order.landmark ? (
              <View style={[s.row, { marginTop: 6, gap: 6 }]}>
                <Ionicons name="flag-outline" size={14} color={theme.colors.text.muted} />
                <UIText variant="body-sm" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>{order.landmark}</UIText>
              </View>
            ) : null}
            {branchName ? (
              <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
                <UIText variant="body-sm" color="secondary">{t("pharmacist.branch", "Branch")}</UIText>
                <UIText variant="body-sm" weight="bold">{branchName}</UIText>
              </View>
            ) : null}
            {order.zoneName ? (
              <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
                <UIText variant="body-sm" color="secondary">{t("pharmacist.zone", "Zone")}</UIText>
                <UIText variant="body-sm">{order.zoneName}</UIText>
              </View>
            ) : null}
            {order.note ? (
              <View style={{ marginTop: 8 }}>
                <UIText variant="body-sm" color="secondary">{t("pharmacist.deliveryNotes", "Delivery notes")}</UIText>
                <UIText variant="body-sm" style={{ marginTop: 2, textAlign: TEXT_START }}>{order.note}</UIText>
              </View>
            ) : null}
          </SectionCard>
        )}

        {/* Payment */}
        <SectionCard title={t("pharmacist.sectionPayment")} icon="card-outline" theme={theme}>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.paymentMethod")}</UIText>
            <UIText variant="body-sm" weight="bold">
              {order.paymentMethod ? t(getPaymentMeta(order.paymentMethod, theme).labelKey) : "—"}
            </UIText>
          </View>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.paymentStatus")}</UIText>
            <UIText variant="body-sm" weight="bold" style={{ color: getPaymentStatusDisplay(order.paymentStatus, theme).color }}>
              {t(getPaymentStatusDisplay(order.paymentStatus, theme).labelKey)}
            </UIText>
          </View>
          {order.transferNumber ? (
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.transferNumber")}</UIText>
              <UIText variant="body-sm" weight="bold">{order.transferNumber}</UIText>
            </View>
          ) : null}
          {order.paymentProofUrl ? (
            <Pressable
              onPress={() => Linking.openURL(order.paymentProofUrl as string)}
              style={{ marginTop: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t("pharmacist.viewProof")}
            >
              <ExpoImage
                source={{ uri: order.paymentProofUrl }}
                style={[s.proofImage, { backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}
                contentFit="cover"
              />
              <View style={[s.row, { marginTop: 6, gap: 4 }]}>
                <Ionicons name="expand-outline" size={13} color={theme.colors.brand.primary} />
                <UIText variant="caption" style={{ color: theme.colors.brand.primary }}>{t("pharmacist.viewProof")}</UIText>
              </View>
            </Pressable>
          ) : null}

          <View style={[s.divider, { backgroundColor: theme.colors.border.default }]} />
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.subtotal")}</UIText>
            <UIText variant="body-sm">{formatPrice(order.subtotal)}</UIText>
          </View>
          {order.discountTotal > 0 && (
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.discount")}</UIText>
              <UIText variant="body-sm" color="danger">-{formatPrice(order.discountTotal)}</UIText>
            </View>
          )}
          <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.shipping")}</UIText>
            <UIText variant="body-sm">{formatPrice(order.shippingFee)}</UIText>
          </View>
          <View style={[s.row, { justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border.default }]}>
            <UIText variant="body" weight="bold">{t("pharmacist.total")}</UIText>
            <UIText variant="body" weight="bold" style={{ color: theme.colors.brand.primary }}>{formatPrice(order.total)}</UIText>
          </View>
        </SectionCard>

        {/* Driver — only relevant once the order has actually reached dispatch */}
        {showDriverSection && assignment && (
          <SectionCard title={t("pharmacist.sectionDriver", "Driver")} icon="car-outline" theme={theme}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.driverStatus", "Status")}</UIText>
              <UIText variant="body-sm" weight="bold">{t(ASSIGNMENT_STATUS_LABEL[assignment.responseStatus])}</UIText>
            </View>
            {assignment.pickedUpAt ? (
              <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
                <UIText variant="body-sm" color="secondary">{t("pharmacist.driverPickedUpAt", "Picked up")}</UIText>
                <UIText variant="body-sm">{new Date(assignment.pickedUpAt).toLocaleTimeString()}</UIText>
              </View>
            ) : null}
            {assignment.deliveredAt ? (
              <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
                <UIText variant="body-sm" color="secondary">{t("pharmacist.driverDeliveredAt", "Delivered")}</UIText>
                <UIText variant="body-sm">{new Date(assignment.deliveredAt).toLocaleTimeString()}</UIText>
              </View>
            ) : null}
          </SectionCard>
        )}

        {/* Timeline + staff notes — order_notes already had staff RLS with no
            way to actually write one; this is the first UI that does. */}
        <SectionCard title={t("pharmacist.sectionTimeline", "Timeline")} icon="time-outline" theme={theme}>
          {timeline.map((ev, i) => {
            const meta = TIMELINE_META[ev.eventType];
            return (
              <Animated.View key={`${ev.eventType}-${ev.eventAt}-${i}`} entering={FadeInDown.delay(i * 30).duration(200)} style={[s.row, { alignItems: "flex-start", marginTop: i === 0 ? 0 : 10, gap: 10 }]}>
                <View style={[s.timelineDot, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                  <Ionicons name={meta?.icon ?? "ellipse-outline"} size={13} color={theme.colors.text.secondary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <UIText variant="body-sm" style={{ textAlign: TEXT_START }}>{t(meta?.labelKey ?? ev.eventType, ev.eventType)}</UIText>
                  {ev.eventType === "note_added" && typeof ev.detail.body === "string" ? (
                    <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>{ev.detail.body}</UIText>
                  ) : null}
                  <UIText variant="caption" color="muted">{new Date(ev.eventAt).toLocaleString(dateLocale)}</UIText>
                </View>
              </Animated.View>
            );
          })}

          <View style={[s.noteComposer, { borderTopColor: theme.colors.border.default, marginTop: timeline.length > 0 ? 14 : 0, paddingTop: timeline.length > 0 ? 14 : 0 }]}>
            <Input
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder={t("pharmacist.addNotePlaceholder", "Add an internal note…")}
              multiline
            />
            <Button
              label={t("pharmacist.addNote", "Add Note")}
              onPress={handleAddNote}
              loading={mutations.addNote.isPending}
              variant="outline"
              disabled={noteDraft.trim().length === 0}
              style={{ marginTop: 8 }}
            />
          </View>
        </SectionCard>
      </ScrollView>

      {/* Action dock — safe-area aware, primary action first */}
      <PharmacistActionDock
        actions={dockActions}
        loading={mutations.advance.isPending}
        onAction={handleAdvance}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center", flex: 1 },
  scroll: { paddingBottom: 100 },
  topCard: {
    padding: kit.inset.screen,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
  },
  section: {
    padding: kit.inset.screen,
    marginTop: 10,
    marginHorizontal: kit.inset.screen,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeader: {
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  attentionBanner: {
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginHorizontal: kit.inset.screen,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillBtn: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  noteComposer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  table: {
    gap: 0,
  },
  tableRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  itemImgPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  proofImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
