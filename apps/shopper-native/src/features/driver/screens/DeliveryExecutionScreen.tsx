/**
 * DeliveryExecutionScreen — the driver's working view of one assigned order.
 * Rebuilt around a single principle: at any moment there is exactly one
 * correct next action, derived from features/driver/lib/deliveryStage.ts
 * (the same state-machine helper OrderCardNew uses), and that action is the
 * one dominant, unmissable control on screen — not one of several
 * conditionally-rendered buttons stacked together.
 *
 * Sectioned per the reconstruction's "Order Details" structure: a status
 * banner + the one next action, a stage tracker, Pickup (pharmacy) and
 * Destination (customer) location cards (DeliveryLocationCard — shared with
 * nothing else showing a wall of empty fields), Order contents, and a real
 * Timeline built from the assignment's own milestone timestamps (no
 * invented data).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Text as UIText, useTheme, Badge, Card } from "@pharmacy/ui-native";
import { Button, kit } from "@pharmacy/ui-native";
import {
  DetailSection,
  InfoRow,
  ORDER_STATUS_META,
} from "@/features/orders/components/OrderDetailHelpers";
import { useAuth } from "@/features/auth";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useDriverOrderDetail, useMyAssignmentForOrder, driverQueryKeys } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { pushDriverLocation, TooFarFromDestinationError } from "../api";
import { findBranchById } from "@/features/delivery/branches/data";
import { useDriverLivePosition } from "../hooks/useDriverLivePosition";
import { getDeliveryStage, getStageAction, getStageStatusLabel } from "../lib/deliveryStage";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import ActionDock from "../components/ActionDock";
import ProgressTracker from "../components/ProgressTracker";
import RouteSummary from "../components/RouteSummary";
import DeliveryLocationCard from "../components/DeliveryLocationCard";
import HoldToConfirmButton from "../components/HoldToConfirmButton";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function badgeVariant(v: "success" | "warning" | "brand" | "error" | "neutral"): "success" | "warning" | "primary" | "error" | "neutral" {
  return v === "brand" ? "primary" : v;
}

export function DeliveryExecutionScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { language } = useAppLanguage();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();

  const orderQuery = useDriverOrderDetail(orderId);
  const assignmentQuery = useMyAssignmentForOrder(orderId, user?.id);
  const mutations = useDriverMutations(user?.id);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    content: { paddingBottom: 140, gap: 14 },
    centered: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24, gap: 10 },
    section: { marginHorizontal: kit.inset.screen },
    heroBanner: {
      marginHorizontal: kit.inset.screen,
      flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
      padding: 16, borderRadius: 18,
      backgroundColor: theme.colors.brand.primaryLight,
      borderWidth: 1, borderColor: theme.colors.brand.primary,
    },
    heroIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas.surface },
    doneBanner: {
      marginHorizontal: kit.inset.screen,
      flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
      padding: 16, borderRadius: 18,
      backgroundColor: `${theme.colors.status.success}12`,
      borderWidth: 1, borderColor: `${theme.colors.status.success}40`,
    },
    metricsRow: { flexDirection: flexRow(IS_RTL), gap: 10 },
    metricChip: { flex: 1, flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, padding: 10, borderRadius: 12, backgroundColor: theme.colors.canvas.surfaceMuted },
    timelineRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10, paddingVertical: 6 },
    timelineDot: { width: 10, height: 10, borderRadius: 5 },
    dockActions: { gap: 10 },
    codBanner: {
      flexDirection: flexRow(IS_RTL), alignItems: "flex-start", gap: 10,
      padding: 14, borderRadius: 14,
      backgroundColor: `${theme.colors.status.warning}12`,
      borderWidth: 1, borderColor: `${theme.colors.status.warning}40`,
    },
  }), [theme]);

  const order = orderQuery.data;
  const assignment = assignmentQuery.data;
  const statusMeta = order ? (ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.pending) : null;
  const stage = order ? getDeliveryStage(order.status, assignment) : "unknown";
  const stageAction = getStageAction(stage);
  const stageLabel = getStageStatusLabel(stage);
  const [locationSyncState, setLocationSyncState] = React.useState<"idle" | "syncing" | "ready" | "denied" | "error">("idle");
  const isCod = order?.paymentMethod === "cod";

  const onRefresh = useCallback(async () => {
    if (!orderId) return;
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(orderId) }),
        queryClient.invalidateQueries({ queryKey: driverQueryKeys.assignmentForOrder(orderId) }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [orderId, queryClient]);

  const handleArrivalOrPickup = async () => {
    if (!orderId || !assignment) return;
    try {
      if (stageAction.kind === "arrive_pharmacy" || stageAction.kind === "arrive_customer") {
        const permission = await ExpoLocation.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          showErrorSheet(t("driver.actionFailedTitle"), t("driver.locationPermissionRequired"));
          return;
        }
        const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const arrivalStage = stageAction.kind === "arrive_pharmacy" ? "pharmacy" : "customer";
        await mutations.arrival.mutateAsync({ orderId, assignmentId: assignment.id, stage: arrivalStage, coords });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccessSheet(
          arrivalStage === "pharmacy" ? t("driver.arrivedAtPharmacyTitle") : t("driver.arrivedAtCustomerTitle"),
          arrivalStage === "pharmacy" ? t("driver.arrivedAtPharmacyBody") : t("driver.arrivedAtCustomerBody"),
        );
      } else if (stageAction.kind === "confirm_pickup") {
        await mutations.pickup.mutateAsync({ orderId, assignmentId: assignment.id });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccessSheet(t("driver.pickupConfirmedTitle"), t("driver.pickupConfirmedBody"));
      }
    } catch (e) {
      if (e instanceof TooFarFromDestinationError) {
        showErrorSheet(t("driver.tooFarTitle"), t("driver.tooFarBody"));
        return;
      }
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const handleCompleteDelivery = async () => {
    if (!orderId || !assignment) return;
    try {
      await mutations.deliver.mutateAsync({ orderId, assignmentId: assignment.id });
      showSuccessSheet(t("driver.deliveredTitle"), t("driver.deliveredBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const actionPending = mutations.arrival.isPending || mutations.pickup.isPending || mutations.deliver.isPending;
  const loading = orderQuery.isLoading || assignmentQuery.isLoading;

  const destinationCoords = useMemo(() => {
    if (
      typeof order?.customerLat === "number" && Number.isFinite(order.customerLat)
      && typeof order?.customerLng === "number" && Number.isFinite(order.customerLng)
    ) {
      return { lat: order.customerLat, lng: order.customerLng };
    }
    return null;
  }, [order?.customerLat, order?.customerLng]);

  const branch = order?.branchId ? findBranchById(order.branchId) : null;
  const branchName = branch ? (language === "ar" ? branch.nameAr : branch.nameEn) : null;
  const branchAddress = branch ? (language === "ar" ? branch.addressAr : branch.addressEn) : null;
  const branchCoords = branch ? { lat: branch.lat, lng: branch.lng } : null;
  const branchPhone = branch?.phones?.[0] ?? null;
  const activeDestCoords = stage === "to_pharmacy" || stage === "at_pharmacy" ? branchCoords : destinationCoords;

  const shouldBroadcastLocation =
    Boolean(user?.id) && Boolean(orderId) && Boolean(assignment?.id) && order?.status === "out_for_delivery";

  // Single shared GPS subscription (useDriverLivePosition) now backs both
  // this screen's live distance/ETA readout below AND the periodic server
  // push — previously each ran its own independent watcher/one-shot
  // permission+GPS request, a duplicated-subscription pattern flagged in
  // the driver-system audit. The push interval reads the latest smoothed
  // fix via fixRef rather than requesting a fresh position every 20s.
  const { fix: liveFix, permissionDenied, fixRef } = useDriverLivePosition(shouldBroadcastLocation);

  useEffect(() => {
    if (permissionDenied) setLocationSyncState("denied");
  }, [permissionDenied]);

  const pushLatestFixRef = useRef<() => Promise<void>>(async () => undefined);
  pushLatestFixRef.current = async () => {
    if (!shouldBroadcastLocation || !user?.id || !orderId) return;
    const fix = fixRef.current;
    if (!fix) return;
    try {
      setLocationSyncState((current) => (current === "ready" ? current : "syncing"));
      await pushDriverLocation({
        driver_id: user.id,
        order_id: orderId,
        lat: fix.lat,
        lng: fix.lng,
        accuracy_meters: fix.accuracy,
        heading: fix.heading,
        speed_kmh: fix.speedKmh,
        captured_at: fix.capturedAt,
      });
      setLocationSyncState("ready");
    } catch {
      setLocationSyncState("error");
    }
  };

  // Pushes once, the moment the FIRST GPS fix actually arrives, rather than
  // waiting out the full 20s cadence below (which would otherwise leave a
  // multi-second gap with nothing pushed right after this screen opens).
  // Deliberately not re-run on every liveFix update — watchPositionAsync
  // can fire every few seconds while driving, and re-pushing on each one
  // would defeat the whole point of throttling writes to a 20s cadence.
  const firstFixPushedRef = useRef(false);
  useEffect(() => {
    if (liveFix && !firstFixPushedRef.current) {
      firstFixPushedRef.current = true;
      void pushLatestFixRef.current();
    }
  }, [liveFix]);

  useEffect(() => {
    if (!shouldBroadcastLocation) return;
    const intervalId = setInterval(() => void pushLatestFixRef.current(), 20_000);
    return () => clearInterval(intervalId);
  }, [shouldBroadcastLocation]);

  const timelineSteps = useMemo(() => {
    if (!assignment) return [];
    return [
      { key: "offered", labelKey: "driver.timelineOffered", at: assignment.offeredAt },
      { key: "accepted", labelKey: "driver.timelineAccepted", at: assignment.respondedAt },
      { key: "arrivedPharmacy", labelKey: "driver.timelineArrivedPharmacy", at: assignment.arrivedAtPharmacy },
      { key: "pickedUp", labelKey: "driver.timelinePickedUp", at: assignment.pickedUpAt },
      { key: "arrivedCustomer", labelKey: "driver.timelineArrivedCustomer", at: assignment.arrivedAtCustomer },
      { key: "delivered", labelKey: "driver.timelineDelivered", at: assignment.deliveredAt },
    ];
  }, [assignment]);

  return (
    <Screen
      edgeTop scroll background={theme.colors.canvas.background} contentStyle={s.content}
      scrollProps={{ refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} /> }}
    >
      <DriverScreenHeader
        title={`#${(orderId ?? "").slice(-8).toUpperCase()}`}
        subtitle={statusMeta ? t(statusMeta.labelKey) : undefined}
        trailing={statusMeta ? <Badge variant={badgeVariant(statusMeta.variant)} label={t(statusMeta.labelKey)} /> : undefined}
      />

      {loading ? (
        <View style={s.centered}><UIText color="secondary">{t("common.loading")}</UIText></View>
      ) : !order ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={theme.colors.text.muted} />
          <UIText variant="card-title" style={{ textAlign: "center" }}>{t("driver.orderNotFound")}</UIText>
        </View>
      ) : (
        <>
          {stage === "delivered" ? (
            <View style={s.doneBanner}>
              <View style={s.heroIcon}><Ionicons name="checkmark-done-circle" size={24} color={theme.colors.status.success} /></View>
              <View style={{ flex: 1 }}>
                <UIText variant="card-title" style={{ textAlign: TEXT_START }}>{t("driver.deliveredTitle")}</UIText>
                <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>{t("driver.deliveredBody")}</UIText>
              </View>
            </View>
          ) : (
            <View style={s.heroBanner}>
              <View style={s.heroIcon}><Ionicons name={stageAction.icon} size={22} color={theme.colors.brand.primary} /></View>
              <View style={{ flex: 1 }}>
                <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>{t(stageLabel.key, stageLabel.fallback)}</UIText>
                <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 2 }}>{t(stageAction.labelKey, stageAction.fallback)}</UIText>
              </View>
            </View>
          )}

          <ProgressTracker
            steps={[
              { id: "pharmacy", label: t("driver.stageAtPharmacy", "At pharmacy"), done: ["at_pharmacy", "to_customer", "at_customer", "delivered"].includes(stage) },
              { id: "pickedUp", label: t("driver.statusPickedUp"), done: ["to_customer", "at_customer", "delivered"].includes(stage) },
              { id: "customer", label: t("driver.stageAtCustomer", "At customer"), done: ["at_customer", "delivered"].includes(stage) },
              { id: "delivered", label: t("driver.deliveredTitle"), done: stage === "delivered" },
            ]}
          />

          {isCod && stage !== "delivered" && (
            <View style={s.section}>
              <View style={s.codBanner}>
                <Ionicons name="cash-outline" size={18} color={theme.colors.status.warning} />
                <View style={{ flex: 1 }}>
                  <UIText variant="label" style={{ textAlign: TEXT_START, color: theme.colors.status.warning }}>{t("driver.codReminderTitle")}</UIText>
                  <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>
                    {t("driver.codReminderBody", { amount: formatPrice(order.total) })}
                  </UIText>
                </View>
              </View>
            </View>
          )}

          <View style={s.section}>
            <DeliveryLocationCard
              kind="pharmacy"
              title={t("driver.pickupSection", "Pickup")}
              name={branchName}
              formattedAddress={branchAddress}
              zoneName={null}
              phone={branchPhone}
              coords={branchCoords}
            />
          </View>

          <View style={s.section}>
            <DeliveryLocationCard
              kind="customer"
              title={t("driver.destinationSection", "Destination")}
              name={order.address.name}
              formattedAddress={order.address.formatted || [order.address.street, order.address.city].filter(Boolean).join(", ")}
              building={order.address.building}
              floor={order.address.floor}
              apartment={order.address.apartment}
              landmark={order.address.landmark}
              instructions={order.address.notes}
              zoneName={order.zoneName}
              phone={order.address.phone}
              coords={destinationCoords}
            />
          </View>

          {activeDestCoords && stage !== "delivered" && stage !== "unknown" && (
            <RouteSummary
              driverCoords={liveFix ? { lat: liveFix.lat, lng: liveFix.lng } : undefined}
              destCoords={activeDestCoords}
            />
          )}

          <View style={s.section}>
            <Card padding="md">
              <View style={s.metricsRow}>
                <View style={s.metricChip}>
                  <Ionicons name={locationSyncState === "ready" ? "radio-outline" : locationSyncState === "error" ? "alert-circle-outline" : "navigate-outline"} size={14} color={locationSyncState === "ready" ? theme.colors.status.success : theme.colors.brand.primary} />
                  <UIText variant="caption" color="secondary" style={{ flex: 1 }}>
                    {locationSyncState === "ready" ? t("driver.liveLocationReady") : locationSyncState === "denied" ? t("driver.liveLocationDenied") : locationSyncState === "error" ? t("driver.liveLocationError") : shouldBroadcastLocation ? t("driver.liveLocationSyncing") : t("driver.liveLocationInactive", "Location updates start once you're out for delivery.")}
                  </UIText>
                </View>
              </View>
            </Card>
          </View>

          <DetailSection title={t("driver.itemsSection")} icon="cube-outline" delay={60}>
            {order.items.map((item) => (
              <InfoRow key={item.productId} label={`${item.name} × ${item.quantity}`} value={formatPrice(item.price * item.quantity)} />
            ))}
            <InfoRow label={t("driver.total")} value={formatPrice(order.total)} valueColor={theme.colors.brand.primary} />
          </DetailSection>

          {timelineSteps.length > 0 && (
            <DetailSection title={t("driver.timelineSection", "Timeline")} icon="time-outline" delay={80}>
              {timelineSteps.map((step) => (
                <View key={step.key} style={s.timelineRow}>
                  <View style={[s.timelineDot, { backgroundColor: step.at ? theme.colors.status.success : theme.colors.border.default }]} />
                  <UIText variant="body-sm" color={step.at ? "primary" : "muted"} style={{ flex: 1, textAlign: TEXT_START }}>
                    {t(step.labelKey)}
                  </UIText>
                  {step.at ? <UIText variant="caption" color="secondary">{new Date(step.at).toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" })}</UIText> : null}
                </View>
              ))}
            </DetailSection>
          )}

          <ActionDock>
            <View style={s.dockActions}>
              {stage === "at_customer" ? (
                <HoldToConfirmButton
                  label={t(stageAction.labelKey, stageAction.fallback)}
                  hint={t("driver.holdToConfirm")}
                  icon={stageAction.icon}
                  onConfirm={() => void handleCompleteDelivery()}
                  loading={mutations.deliver.isPending}
                />
              ) : stage !== "delivered" && stage !== "unknown" ? (
                <Button
                  label={t(stageAction.labelKey, stageAction.fallback)}
                  icon={stageAction.icon}
                  onPress={() => void handleArrivalOrPickup()}
                  loading={actionPending}
                  full
                  size="lg"
                />
              ) : null}
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
