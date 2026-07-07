/**
 * DeliveryExecutionScreen — the driver's working view of one assigned order:
 * confirm pickup, mark delivered, or report a problem. Reuses the customer
 * order-detail screen's shared helpers (DetailSection/InfoRow/ORDER_STATUS_META)
 * instead of re-building address/item layout from scratch.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText } from "@/shared/ui";
import { Button, kit } from "@/shared/kit";
import { Badge } from "@/components/ui/Badge";
import {
  DetailSection,
  InfoRow,
  HeaderBackButton,
  ORDER_STATUS_META,
} from "@/features/orders/components/OrderDetailHelpers";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useDriverOrderDetail, useMyAssignmentForOrder } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function DeliveryExecutionScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();

  const orderQuery = useDriverOrderDetail(orderId);
  const assignmentQuery = useMyAssignmentForOrder(orderId, user?.id);
  const mutations = useDriverMutations(user?.id);

  const order = orderQuery.data;
  const assignment = assignmentQuery.data;
  const statusMeta = order ? (ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.pending) : null;

  const handlePickup = async () => {
    if (!orderId || !assignment) return;
    try {
      await mutations.pickup.mutateAsync({ orderId, assignmentId: assignment.id });
      showSuccessSheet(t("driver.pickupConfirmedTitle"), t("driver.pickupConfirmedBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const handleDeliver = async () => {
    if (!orderId || !assignment) return;
    try {
      await mutations.deliver.mutateAsync({ orderId, assignmentId: assignment.id });
      showSuccessSheet(t("driver.deliveredTitle"), t("driver.deliveredBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const loading = orderQuery.isLoading || assignmentQuery.isLoading;
  const canConfirmPickup = order?.status === "ready" && assignment?.responseStatus === "accepted" && !assignment.pickedUpAt;
  const canMarkDelivered = order?.status === "picked_up";

  return (
    <Screen edgeTop scroll background={kit.color.canvas} contentStyle={s.content}>
      <View style={s.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <UIText variant="sheet-title" style={{ textAlign: TEXT_START, flex: 1 }}>
          #{(orderId ?? "").slice(-8).toUpperCase()}
        </UIText>
        {statusMeta && <Badge variant={statusMeta.variant} size="sm">{t(statusMeta.labelKey)}</Badge>}
      </View>

      {loading ? (
        <View style={s.centered}><UIText color="secondary">{t("common.loading")}</UIText></View>
      ) : !order ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={kit.color.inkFaint} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("driver.orderNotFound")}
          </UIText>
        </View>
      ) : (
        <>
          <DetailSection title={t("driver.customerSection")} icon="person-outline" delay={0}>
            <InfoRow label={t("driver.name")} value={order.address.name || "—"} />
            <InfoRow label={t("driver.phone")} value={order.address.phone || "—"} />
            <InfoRow
              label={t("driver.address")}
              value={order.address.formatted || [order.address.street, order.address.city].filter(Boolean).join(", ") || "—"}
            />
            {order.address.notes ? <InfoRow label={t("driver.notes")} value={order.address.notes} /> : null}
          </DetailSection>

          <DetailSection title={t("driver.itemsSection")} icon="cube-outline" delay={60}>
            {order.items.map((item) => (
              <InfoRow
                key={item.productId}
                label={`${item.name} × ${item.quantity}`}
                value={formatPrice(item.price * item.quantity)}
              />
            ))}
            <InfoRow label={t("driver.total")} value={formatPrice(order.total)} valueColor={kit.color.accentDeep} />
          </DetailSection>

          <View style={s.actions}>
            {canConfirmPickup && (
              <Button
                label={t("driver.confirmPickup")}
                icon="cube-outline"
                onPress={() => void handlePickup()}
                loading={mutations.pickup.isPending}
                full
                size="lg"
              />
            )}
            {canMarkDelivered && (
              <Button
                label={t("driver.markDelivered")}
                icon="checkmark-circle"
                onPress={() => void handleDeliver()}
                loading={mutations.deliver.isPending}
                full
                size="lg"
              />
            )}
            {!canConfirmPickup && !canMarkDelivered && (
              <View style={s.doneNotice}>
                <Ionicons name="checkmark-done-circle" size={18} color={kit.color.success} />
                <UIText variant="body-sm" color="success">{t("driver.noActionNeeded")}</UIText>
              </View>
            )}
            <Button
              label={t("driver.reportIssue")}
              icon="warning-outline"
              variant="ghost"
              onPress={() => router.push(`/(driver)/issue/${orderId}` as never)}
              full
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 40 },
  header: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 10,
    paddingHorizontal: kit.inset.screen,
    paddingTop: 12,
    paddingBottom: 8,
  },
  centered: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  actions: {
    marginHorizontal: kit.inset.screen,
    marginTop: 12,
    gap: 12,
  },
  doneNotice: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 8,
    backgroundColor: kit.color.successTint,
    borderRadius: kit.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
