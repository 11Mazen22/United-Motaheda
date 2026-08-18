import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image as ExpoImage }   from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Ionicons }             from "@expo/vector-icons";
import { useTranslation }       from "react-i18next";

import { Screen, Text as UIText, kit, Button } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }            from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

import { usePharmacistOrder }    from "../hooks/usePharmacistQueries";
import { usePharmacistMutations} from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader} from "../components/PharmacistScreenHeader";
import { OrderStatusChip }       from "../components/OrderStatusChip";
import type { PharmacistOrder, PharmacistTransitionTarget } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function getPharmacistActions(
  status: PharmacistOrder["status"],
): PharmacistTransitionTarget[] {
  switch (status) {
    case "pending":          return ["verification", "cancelled"];
    case "confirmed":        return ["preparing", "cancelled"];
    case "verification":     return ["payment_pending", "payment_approved", "cancelled"];
    case "payment_pending":  return ["payment_approved", "cancelled"];
    case "payment_approved": return ["preparing", "cancelled"];
    case "preparing":        return ["ready", "cancelled"];
    default:                 return [];
  }
}

function actionLabel(target: PharmacistTransitionTarget, t: (k: string) => string): string {
  switch (target) {
    case "verification":    return t("pharmacist.actionVerify", "Verify");
    case "payment_pending": return t("pharmacist.actionRequestPayment", "Request Payment");
    case "payment_approved":return t("pharmacist.actionApprovePayment", "Approve Payment");
    case "preparing":       return t("pharmacist.actionStartPreparing", "Start Preparing");
    case "ready":           return t("pharmacist.actionMarkReady", "Mark Ready");
    case "cancelled":       return t("pharmacist.actionCancel", "Cancel");
    default:                return target;
  }
}

export function PharmacistOrderDetailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = usePharmacistOrder(id);
  const mutations  = usePharmacistMutations();

  const order   = orderQuery.data;
  const actions = useMemo(
    () => (order ? getPharmacistActions(order.status) : []),
    [order?.status],
  );

  const handleAdvance = useCallback(
    async (target: PharmacistTransitionTarget) => {
      if (!id) return;
      try {
        await mutations.advance.mutateAsync({ orderId: id, nextStatus: target });
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
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={`#${(id ?? "").slice(-8).toUpperCase()}`} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={kit.color.accent} />
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.orderNotFound")} />
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={kit.color.inkFaint} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("pharmacist.orderNotFound")}
          </UIText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader title={t("pharmacist.orderDetails", "Order Details")} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Top: Order number + timestamp + status */}
        <View style={s.topCard}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <View>
              <UIText variant="body">#{order.id.slice(-8).toUpperCase()}</UIText>
              <UIText variant="caption" color="secondary" style={{ marginTop: 4 }}>
                {new Date(order.createdAt || Date.now()).toLocaleString()}
              </UIText>
            </View>
            <OrderStatusChip status={order.status} size="md" />
          </View>
        </View>

        {/* Customer section */}
        <View style={s.section}>
          <UIText variant="eyebrow" color="secondary" style={{ marginBottom: 8, textAlign: TEXT_START }}>
            {t("pharmacist.sectionCustomer", "Customer")}
          </UIText>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <View>
              <UIText variant="body" weight="bold">{order.customerName}</UIText>
              <UIText variant="body-sm" color="secondary">{order.customerAddress}</UIText>
            </View>
            <Pressable onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} style={s.phoneBtn}>
              <Ionicons name="call" size={16} color={kit.color.accent} />
              <UIText variant="body-sm" style={{ color: kit.color.accent }}>{order.customerPhone}</UIText>
            </Pressable>
          </View>
        </View>

        {/* Items list */}
        <View style={s.section}>
          <UIText variant="eyebrow" color="secondary" style={{ marginBottom: 8, textAlign: TEXT_START }}>
            {t("pharmacist.sectionMedicines", "Items")}
          </UIText>
          <View style={s.table}>
            {order.items.map((item, index) => (
              <View key={item.productId} style={[s.tableRow, index === 0 && { borderTopWidth: 0 }]}>
                {item.imageUrl ? (
                  <ExpoImage source={{ uri: item.imageUrl }} style={s.itemImg} contentFit="contain" />
                ) : (
                  <View style={[s.itemImg, s.itemImgPlaceholder]}>
                    <Ionicons name="medkit" size={16} color={kit.color.inkFaint} />
                  </View>
                )}
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>
                    {item.name || item.code || item.productId}
                  </UIText>
                </View>
                <UIText variant="body-sm" style={{ width: 40, textAlign: "center" }}>{item.quantity}</UIText>
                <UIText variant="body-sm" weight="bold" style={{ width: 70, textAlign: "right" }}>
                  {formatPrice(item.lineTotal)}
                </UIText>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing summary */}
        <View style={s.summaryBox}>
          <View style={s.summaryRow}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.subtotal", "Subtotal")}</UIText>
            <UIText variant="body-sm">{formatPrice(order.subtotal)}</UIText>
          </View>
          {order.discountTotal > 0 && (
            <View style={s.summaryRow}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.discount", "Discount")}</UIText>
              <UIText variant="body-sm" color="danger">-{formatPrice(order.discountTotal)}</UIText>
            </View>
          )}
          <View style={s.summaryRow}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.shipping", "Delivery")}</UIText>
            <UIText variant="body-sm">{formatPrice(order.shippingFee)}</UIText>
          </View>
          <View style={[s.summaryRow, s.summaryTotal]}>
            <UIText variant="body" weight="bold">{t("pharmacist.total", "Total")}</UIText>
            <UIText variant="body" style={{ color: kit.color.accentDeep }}>{formatPrice(order.total)}</UIText>
          </View>
        </View>

      </ScrollView>

      {/* Action dock */}
      <View style={s.actionDock}>
        {actions.map((action) => (
          <Button
            key={action}
            label={actionLabel(action, t)}
            variant={action === "cancelled" ? "outline" : "primary"}
            full
            loading={mutations.advance.isPending}
            onPress={() => handleAdvance(action)}
            style={action === "cancelled" ? { borderColor: kit.color.danger } : undefined}
          />
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center", flex: 1 },
  scroll: { paddingBottom: 100 },
  topCard: {
    backgroundColor: kit.color.surface,
    padding: kit.inset.screen,
    borderBottomWidth: 1,
    borderBottomColor: kit.color.line,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
  },
  section: {
    padding: kit.inset.screen,
    backgroundColor: kit.color.surface,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: kit.color.line,
  },
  phoneBtn: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: kit.color.accentTint,
    borderRadius: kit.radius.pill,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  itemImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: kit.color.canvas,
  },
  itemImgPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBox: {
    margin: kit.inset.screen,
    padding: kit.inset.card,
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.md,
    borderWidth: 1,
    borderColor: kit.color.line,
  },
  summaryRow: {
    flexDirection: flexRow(IS_RTL),
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: kit.color.line,
    marginTop: 8,
    paddingTop: 12,
  },
  actionDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: kit.color.surface,
    padding: kit.inset.screen,
    borderTopWidth: 1,
    borderTopColor: kit.color.line,
    flexDirection: "column",
    gap: 8,
  },
});
