/**
 * OrderCardNew — one manifest row. Rebuilt to read its action state directly
 * off ManifestOrder's own assignment fields (assignmentId/pickedUpAt/
 * arrivedAtPharmacy/arrivedAtCustomer, joined server-side in
 * listMyManifest) instead of firing a second, per-row useMyAssignmentForOrder
 * query just to learn the same three timestamps — a confirmed N+1 pattern
 * from the driver-system audit. Also drops the phantom eta/pharmacyName/
 * itemCount props that didn't exist on the real ManifestOrder shape and
 * always rendered as "—" / a hardcoded "Pharmacy" literal in production.
 *
 * Quick actions (call/navigate) live directly on the card — a driver
 * scanning a busy manifest shouldn't have to open the full delivery screen
 * just to call the customer or start navigation for a stop further down
 * the list. The left accent bar's color communicates urgency (delivery
 * stage) at a glance across the whole list without reading any text.
 */
import React, { useMemo } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { useTranslation } from "react-i18next";
import { Text as UIText, Card, Button, Badge, IconButton, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useAuth } from "@/features/auth";
import type { ManifestOrder } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { TooFarFromDestinationError } from "../api";
import { getDeliveryStage, getStageAction, getStageStatusLabel, type DeliveryStage } from "../lib/deliveryStage";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

const IS_RTL = isRtl();

function stageAccentColor(stage: DeliveryStage, theme: NativeTheme): string {
  if (stage === "at_customer") return theme.colors.status.error;
  if (stage === "to_customer") return theme.colors.status.warning;
  if (stage === "at_pharmacy") return theme.colors.status.info;
  if (stage === "delivered") return theme.colors.status.success;
  return theme.colors.brand.primary;
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
}

export function OrderCardNew({ order, onPress }: { order: ManifestOrder; onPress: (event?: unknown) => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const mutations = useDriverMutations(user?.id);

  const stage = getDeliveryStage(order.status, order);
  const action = getStageAction(stage);
  const statusLabel = getStageStatusLabel(stage);
  const accentColor = stageAccentColor(stage, theme);
  const waitedMin = minutesSince(order.updatedAt);

  const handlePrimaryAction = async () => {
    try {
      if (action.kind === "arrive_pharmacy" || action.kind === "arrive_customer") {
        const permission = await ExpoLocation.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          showErrorSheet(t("driver.actionFailedTitle"), t("driver.locationPermissionRequired"));
          return;
        }
        const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const arrivalStage = action.kind === "arrive_pharmacy" ? "pharmacy" : "customer";
        await mutations.arrival.mutateAsync({ assignmentId: order.assignmentId, orderId: order.id, stage: arrivalStage, coords });
        showSuccessSheet(
          arrivalStage === "pharmacy" ? t("driver.arrivedAtPharmacyTitle") : t("driver.arrivedTitle"),
          arrivalStage === "pharmacy" ? t("driver.arrivedAtPharmacyBody") : t("driver.arrivedBody"),
        );
      } else if (action.kind === "confirm_pickup") {
        await mutations.pickup.mutateAsync({ orderId: order.id, assignmentId: order.assignmentId });
        showSuccessSheet(t("driver.pickedUpTitle"), t("driver.pickedUpBody"));
      } else if (action.kind === "complete") {
        await mutations.deliver.mutateAsync({ orderId: order.id, assignmentId: order.assignmentId });
        showSuccessSheet(t("driver.deliveredTitle"), t("driver.deliveredBody"));
      }
    } catch (e) {
      if (e instanceof TooFarFromDestinationError) {
        showErrorSheet(t("driver.tooFarTitle"), t("driver.tooFarBody"));
        return;
      }
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    }
  };

  const handleCall = () => {
    const phone = order.customerPhone?.replace(/\s/g, "");
    if (phone) void Linking.openURL(`tel:${phone}`);
  };

  const handleNavigate = () => {
    if (typeof order.lat === "number" && typeof order.lng === "number") {
      void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`);
    } else if (order.customerAddress) {
      void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.customerAddress)}&travelmode=driving`);
    }
  };

  const actionPending = mutations.arrival.isPending || mutations.pickup.isPending || mutations.deliver.isPending;
  const canNavigate = (typeof order.lat === "number" && typeof order.lng === "number") || Boolean(order.customerAddress);

  const oc = useMemo(() => StyleSheet.create({
    cardWrap: { marginHorizontal: kit.inset.screen, borderRadius: 16, overflow: "hidden", flexDirection: flexRow(IS_RTL) },
    accent: { width: 4 },
    card: { flex: 1, padding: 14, borderRadius: 0 },
    titleRow: { flexDirection: flexRow(IS_RTL), justifyContent: "space-between", alignItems: "center" },
    destRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, marginTop: 8 },
    destText: { flex: 1, textAlign: textAlignStart(IS_RTL) },
    metaRow: { flexDirection: flexRow(IS_RTL), gap: 10, marginTop: 8, alignItems: "center" },
    footerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8 },
    quickActions: { flexDirection: flexRow(IS_RTL), gap: 6 },
    stageDot: { width: 6, height: 6, borderRadius: 3 },
  }), [theme]);

  return (
    <View style={oc.cardWrap}>
      <View style={[oc.accent, { backgroundColor: accentColor }]} />
      <Card onPress={onPress} style={oc.card} elevation="sm">
        <View style={oc.titleRow}>
          <UIText variant="card-title">#{String(order.id).slice(-8).toUpperCase()}</UIText>
          <Badge variant="neutral" label={formatPrice(order.total ?? 0)} />
        </View>

        <View style={[oc.titleRow, { marginTop: 4 }]}>
          <View style={{ flexDirection: flexRow(IS_RTL), gap: 6, alignItems: "center" }}>
            <View style={[oc.stageDot, { backgroundColor: accentColor }]} />
            <UIText variant="caption" color="secondary">{t(statusLabel.key, statusLabel.fallback)}</UIText>
          </View>
          <UIText variant="caption" color="muted">
            {waitedMin < 1 ? t("driver.elapsedJustNow") : t("driver.elapsedMinutes", { count: waitedMin })}
          </UIText>
        </View>

        <View style={oc.destRow}>
          <Ionicons name="location-outline" size={14} color={theme.colors.text.muted} />
          <UIText variant="body-sm" color="secondary" numberOfLines={1} style={oc.destText}>
            {order.customerName ? `${order.customerName} · ${order.customerAddress || "—"}` : (order.customerAddress || "—")}
          </UIText>
        </View>

        <View style={oc.metaRow}>
          {order.zoneName ? (
            <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 4 }}>
              <Ionicons name="map-outline" size={12} color={theme.colors.text.muted} />
              <UIText variant="caption" color="secondary">{order.zoneName}</UIText>
            </View>
          ) : null}
          <UIText variant="caption" color="secondary">{order.paymentMethod ?? "—"}</UIText>
        </View>

        <View style={oc.footerRow}>
          <View style={oc.quickActions}>
            <IconButton icon="call-outline" size={36} onPress={handleCall} disabled={!order.customerPhone} accessibilityLabel={t("driver.phone")} />
            <IconButton icon="navigate-outline" size={36} onPress={handleNavigate} disabled={!canNavigate} accessibilityLabel={t("driver.navigate")} />
          </View>
          {action.kind !== "none" ? (
            <Button label={t(action.labelKey, action.fallback)} size="sm" onPress={() => void handlePrimaryAction()} loading={actionPending} />
          ) : (
            <Button label={t("common.view")} variant="ghost" size="sm" onPress={onPress} />
          )}
        </View>
      </Card>
    </View>
  );
}

export default OrderCardNew;
