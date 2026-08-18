/**
 * DeliveryExecutionScreen — the driver's working view of one assigned order:
 * confirm pickup, mark delivered, or report a problem. Reuses the customer
 * order-detail screen's shared helpers (DetailSection/InfoRow/ORDER_STATUS_META)
 * instead of re-building address/item layout from scratch.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { Button, kit } from "@pharmacy/ui-native";
import MetricCard from "@/components/MetricCard";
import { theme } from "@pharmacy/design-tokens";
import { Badge } from "@/components/ui/Badge";
import {
  DetailSection,
  InfoRow,
  ORDER_STATUS_META,
} from "@/features/orders/components/OrderDetailHelpers";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useDriverOrderDetail, useMyAssignmentForOrder } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { pushDriverLocation } from "../api";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import ActionDock from "../components/ActionDock";
import ProgressTracker from "../components/ProgressTracker";
import RouteSummary from "../components/RouteSummary";

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
  const [locationSyncState, setLocationSyncState] = useState<"idle" | "syncing" | "ready" | "denied" | "error">("idle");

  const handlePickup = async () => {
    if (!orderId || !assignment) return;
    try {
      await mutations.pickup.mutateAsync({ orderId, assignmentId: assignment.id });
      showSuccessSheet(t("driver.pickupConfirmedTitle"), t("driver.pickupConfirmedBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const handleArrival = async (stage: "pharmacy" | "customer") => {
    if (!orderId || !assignment) return;
    try {
      await mutations.arrival.mutateAsync({ orderId, assignmentId: assignment.id, stage });
      showSuccessSheet(
        stage === "pharmacy" ? t("driver.arrivedAtPharmacyTitle", "Arrived at pharmacy") : t("driver.arrivedAtCustomerTitle", "Arrived at customer"),
        stage === "pharmacy" ? t("driver.arrivedAtPharmacyBody", "You can now confirm pickup.") : t("driver.arrivedAtCustomerBody", "You can now complete delivery."),
      );
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
  const canArrivePharmacy = order?.status === "ready" && assignment?.responseStatus === "accepted" && !assignment.arrivedAtPharmacy;
  const canConfirmPickup = order?.status === "ready" && assignment?.responseStatus === "accepted" && Boolean(assignment.arrivedAtPharmacy) && !assignment.pickedUpAt;
  const canArriveCustomer = order?.status === "out_for_delivery" && Boolean(assignment?.pickedUpAt) && !assignment?.arrivedAtCustomer;
  const canMarkDelivered = order?.status === "out_for_delivery" && Boolean(assignment?.arrivedAtCustomer);
  const address = order?.address.formatted || [order?.address.street, order?.address.city].filter(Boolean).join(", ");
  const destinationCoords = useMemo(() => {
    if (
      typeof order?.customerLat === "number"
      && Number.isFinite(order.customerLat)
      && typeof order?.customerLng === "number"
      && Number.isFinite(order.customerLng)
    ) {
      return { lat: order.customerLat, lng: order.customerLng };
    }
    return null;
  }, [order?.customerLat, order?.customerLng]);
  const shouldBroadcastLocation =
    Boolean(user?.id)
    && Boolean(orderId)
    && Boolean(assignment?.id)
    && order?.status === "out_for_delivery";

  useEffect(() => {
    if (!shouldBroadcastLocation || !user?.id || !orderId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const syncCurrentLocation = async () => {
      try {
        setLocationSyncState((current) => (current === "ready" ? current : "syncing"));
        const permission = await ExpoLocation.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (!cancelled) setLocationSyncState("denied");
          return;
        }

        const position = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });

        await pushDriverLocation({
          driver_id: user.id,
          order_id: orderId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_meters: position.coords.accuracy ?? undefined,
          heading: typeof position.coords.heading === "number" ? position.coords.heading : undefined,
          speed_kmh:
            typeof position.coords.speed === "number"
              ? Math.max(position.coords.speed, 0) * 3.6
              : undefined,
          captured_at: new Date(position.timestamp).toISOString(),
        });

        if (!cancelled) setLocationSyncState("ready");
      } catch {
        if (!cancelled) setLocationSyncState("error");
      }
    };

    syncCurrentLocation();
    intervalId = setInterval(syncCurrentLocation, 20_000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [orderId, shouldBroadcastLocation, user?.id]);

  const openNavigation = () => {
    if (destinationCoords) {
      void Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=driving`,
      );
      return;
    }

    if (!address) return;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`);
  };

  const callCustomer = () => {
    const phone = order?.address.phone?.replace(/\s/g, "");
    if (phone) void Linking.openURL(`tel:${phone}`);
  };

  return (
    <Screen edgeTop scroll background={kit.color.canvas} contentStyle={s.content}>
      <DriverScreenHeader
        title={`#${(orderId ?? "").slice(-8).toUpperCase()}`}
        subtitle={statusMeta ? t(statusMeta.labelKey) : undefined}
        trailing={statusMeta ? <Badge variant={statusMeta.variant} size="sm">{t(statusMeta.labelKey)}</Badge> : undefined}
      />

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
          {/* Compact KPI row for quick glance */}
          <View style={s.metricsRow}>
            <MetricCard label={t("driver.estimatedEarnings")} value={formatPrice(order?.total ?? 0)} compact />
            <MetricCard label={t("driver.itemsCount") as string} value={String(order?.items.length ?? 0)} compact />
          </View>
          <View style={s.commandCard}>
            <View style={{ flex: 1 }}>
              <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>ACTIVE DELIVERY</UIText>
              <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 4 }}>{order.address.name || "—"}</UIText>
              <UIText variant="body-sm" color="secondary" numberOfLines={2} style={{ textAlign: TEXT_START, marginTop: 2 }}>{address || "—"}</UIText>
              {destinationCoords ? (
                <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginTop: 6 }}>
                  {destinationCoords.lat.toFixed(5)}, {destinationCoords.lng.toFixed(5)}
                </UIText>
              ) : null}
            </View>
            <View style={s.quickActions}>
              <Pressable onPress={callCustomer} disabled={!order.address.phone} style={[s.quickAction, !order.address.phone && s.quickActionDisabled]} accessibilityRole="button" accessibilityLabel={t("driver.phone")}>
                <Ionicons name="call-outline" size={19} color={kit.color.accentDeep} />
              </Pressable>
              <Pressable onPress={openNavigation} disabled={!address} style={[s.quickAction, !address && s.quickActionDisabled]} accessibilityRole="button" accessibilityLabel={t("driver.address")}>
                <Ionicons name="navigate-outline" size={19} color={kit.color.accentDeep} />
              </Pressable>
            </View>
          </View>

          <View style={s.liveStatusCard}>
            <Ionicons
              name={
                locationSyncState === "ready"
                  ? "radio-outline"
                  : locationSyncState === "denied"
                    ? "location-outline"
                    : locationSyncState === "error"
                      ? "alert-circle-outline"
                      : "navigate-outline"
              }
              size={16}
              color={
                locationSyncState === "ready"
                  ? kit.color.success
                  : locationSyncState === "error"
                    ? kit.color.warn
                    : kit.color.accentDeep
              }
            />
            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
              {locationSyncState === "ready"
                ? t("driver.liveLocationReady", "Live driver location is updating for tracking.")
                : locationSyncState === "denied"
                  ? t("driver.liveLocationDenied", "Location access is required for accurate tracking.")
                  : locationSyncState === "error"
                    ? t("driver.liveLocationError", "Live location update failed. We will retry automatically.")
                    : t("driver.liveLocationSyncing", "Preparing navigation and live location updates.")}
            </UIText>
          </View>

          <RouteSummary
            driverCoords={undefined}
            destCoords={destinationCoords ?? undefined}
          />

          <ProgressTracker
            steps={[
              { id: "accepted", label: t("driver.statusPreparing"), done: true },
              { id: "picked", label: t("driver.statusPickedUp"), done: order.status === "out_for_delivery" || order.status === "delivered" },
              { id: "delivered", label: t("driver.deliveredTitle"), done: order.status === "delivered" },
            ]}
          />

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

          {/* Actions are now docked for reachability */}
          <ActionDock>
            <View style={s.actions}>
              {canArrivePharmacy && (
                <Button
                  label={t("driver.arrivedAtPharmacy", "Arrived at pharmacy")}
                  icon="location"
                  onPress={() => void handleArrival("pharmacy")}
                  loading={mutations.arrival.isPending}
                  full
                  size="lg"
                />
              )}
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
              {canArriveCustomer && (
                <Button
                  label={t("driver.arrivedAtCustomer", "Arrived at customer")}
                  icon="location"
                  onPress={() => void handleArrival("customer")}
                  loading={mutations.arrival.isPending}
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
            </View>
            <View style={{ marginTop: 8 }}>
              <Button
                label={t("driver.reportIssue")}
                icon="warning-outline"
                variant="ghost"
                onPress={() => router.push(`/(driver)/issue/${orderId}` as never)}
                full
              />
            </View>
          </ActionDock>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 40 },
  centered: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  actions: {
    marginHorizontal: kit.inset.screen,
    marginTop: 12,
    gap: 12,
  },
  commandCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14,
    marginHorizontal: kit.inset.screen, marginTop: 8, marginBottom: 16,
    padding: 16, borderRadius: kit.radius.xl, backgroundColor: kit.color.surface,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.card,
  },
  liveStatusCard: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 8,
    marginHorizontal: kit.inset.screen,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: kit.radius.lg,
    backgroundColor: kit.color.accentTint,
    borderWidth: 1,
    borderColor: kit.color.line,
  },
  quickActions: { flexDirection: flexRow(IS_RTL), gap: 8 },
  quickAction: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint },
  quickActionDisabled: { opacity: 0.4 },
  timeline: { flexDirection: flexRow(IS_RTL), marginHorizontal: kit.inset.screen, marginBottom: 18 },
  timelineStep: { flex: 1, alignItems: "center", position: "relative" },
  timelineDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: kit.color.line, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineDotDone: { borderColor: kit.color.accent, backgroundColor: kit.color.accent },
  timelineLine: { position: "absolute", height: 2, backgroundColor: kit.color.line, top: 10, start: "50%", end: "-50%" },
  timelineLineDone: { backgroundColor: kit.color.accent },
  timelineText: { marginTop: 6, fontSize: 10, fontFamily: theme.fonts.semibold, color: kit.color.inkFaint, textAlign: "center" },
  timelineTextDone: { color: kit.color.accentDeep },
  doneNotice: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 8,
    backgroundColor: kit.color.successTint,
    borderRadius: kit.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  metricsRow: { flexDirection: flexRow(IS_RTL), gap: 8, paddingHorizontal: kit.inset.screen, marginTop: 8 },
});
