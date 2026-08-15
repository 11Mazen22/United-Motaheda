import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, Card, Button } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useAuth } from "@/features/auth";
import { useMyAssignmentForOrder } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useTranslation } from "react-i18next";

const IS_RTL = isRtl();

export function OrderCardNew({ order, onPress }: any) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const assignmentQuery = useMyAssignmentForOrder(order.id, user?.id);
  const assignment = assignmentQuery.data;
  const mutations = useDriverMutations(user?.id);

  const eta = useMemo(() => order.eta ?? order.estimatedTime ?? "—", [order]);
  const pickup = order.pharmacyName ?? order.pickupName ?? order.storeName ?? "Pharmacy";
  const destination = order.customerName ? `${order.customerName} · ${order.customerAddress ?? "—"}` : (order.customerAddress ?? "—");
  const itemCount = order.items ? order.items.length : order.itemCount ?? undefined;

  const handlePickup = async () => {
    if (!assignment) return;
    try {
      await mutations.pickup.mutateAsync({ orderId: order.id, assignmentId: assignment.id });
      showSuccessSheet(t("driver.pickedUpTitle"), t("driver.pickedUpBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    }
  };

  const handleArrivedCustomer = async () => {
    if (!assignment) return;
    try {
      await mutations.arrival.mutateAsync({ assignmentId: assignment.id, orderId: order.id, stage: "customer" });
      showSuccessSheet(t("driver.arrivedTitle"), t("driver.arrivedBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    }
  };

  const handleComplete = async () => {
    if (!assignment) return;
    try {
      await mutations.deliver.mutateAsync({ orderId: order.id, assignmentId: assignment.id });
      showSuccessSheet(t("driver.deliveredTitle"), t("driver.deliveredBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    }
  };

  const primaryAction = (() => {
    // If not yet picked up
    if (!assignment) return { label: t("driver.view"), action: onPress, loading: assignmentQuery.isLoading };
    if (!assignment.pickedUpAt) return { label: t("driver.confirmPickup"), action: handlePickup, loading: mutations.pickup.isPending };
    if (!assignment.arrivedAtCustomer) return { label: t("driver.arrivedCustomer"), action: handleArrivedCustomer, loading: mutations.arrival.isPending };
    return { label: t("driver.completeDelivery"), action: handleComplete, loading: mutations.deliver.isPending };
  })();

  return (
    <Card onPress={onPress} style={oc.card} elevation="sm">
      <View style={[oc.row, { flexDirection: flexRow(IS_RTL) }]}> 
        <View style={oc.leftIcon}><Ionicons name="car-outline" size={20} color={kit.color.accentDeep} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={oc.titleRow}>
            <UIText variant="card-title">#{String(order.id).slice(-8).toUpperCase()}</UIText>
            <View style={oc.chipsRow}>
              <View style={oc.chip}><Ionicons name="time-outline" size={12} color={kit.color.inkFaint} /><UIText variant="caption" color="muted">{eta}</UIText></View>
              <View style={[oc.chip, { backgroundColor: kit.color.surface }]}><Ionicons name="pricetag-outline" size={12} color={kit.color.inkFaint} /><UIText variant="caption" color="muted">{formatPrice(order.total ?? 0)}</UIText></View>
            </View>
          </View>

          <View style={[oc.routeRow, { flexDirection: flexRow(IS_RTL) }]}> 
            <View style={oc.routePill}>
              <Ionicons name="location-outline" size={12} color={kit.color.inkFaint} />
              <UIText variant="caption" color="secondary" numberOfLines={1} style={oc.routeLabel}>{pickup}</UIText>
            </View>
            <View style={oc.routeArrow}><Ionicons name={flexRow(IS_RTL) === "row" ? "chevron-forward" : "chevron-back"} size={14} color={kit.color.inkFaint} /></View>
            <View style={oc.routePill}>
              <Ionicons name="person-outline" size={12} color={kit.color.inkFaint} />
              <UIText variant="caption" color="secondary" numberOfLines={1} style={oc.routeLabel}>{destination}</UIText>
            </View>
          </View>

          <View style={oc.metaRow}>
            {typeof itemCount !== 'undefined' && <UIText variant="caption" color="secondary">{itemCount} items</UIText>}
            <UIText variant="caption" color="secondary">{order.paymentMethod ? order.paymentMethod : "—"}</UIText>
          </View>
        </View>

        <View style={oc.actionsCol}>
          <Button label={primaryAction.label} onPress={primaryAction.action} loading={primaryAction.loading} />
          <Button label={t("common.view")} variant="ghost" onPress={onPress} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Card>
  );
}

const oc = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, marginHorizontal: kit.inset.screen },
  row: { alignItems: 'center', gap: 12 },
  leftIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: kit.color.surface, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: kit.radius.pill, backgroundColor: kit.color.well },
  routeRow: { alignItems: 'center', gap: 8, marginTop: 10 },
  routePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: kit.color.well, borderRadius: kit.radius.xl },
  routeLabel: { flex: 1, textAlign: 'left' },
  routeArrow: { width: 20, alignItems: 'center' },
  metaRow: { flexDirection: 'row', gap: 10, paddingTop: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionsCol: { marginLeft: 12, justifyContent: 'center', gap: 8, minWidth: 100 },
});

export default OrderCardNew;
