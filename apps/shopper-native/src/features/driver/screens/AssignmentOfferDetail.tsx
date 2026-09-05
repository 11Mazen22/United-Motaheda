/**
 * AssignmentOfferDetail — accept or decline one offered delivery.
 * Decline requires a short reason (kept as free text, not a chip picker —
 * this is an internal staff-visible note, not a customer-facing form).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText, Card, Input, Badge, useTheme } from "@pharmacy/ui-native";
import { Button } from "@pharmacy/ui-native";
import { LinearGradient } from "expo-linear-gradient";
import { InfoRow } from "@/features/orders/components/OrderDetailHelpers";
import RouteSummary from "../components/RouteSummary";
import MetricCard from "@/components/MetricCard";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { findBranchById } from "@/features/delivery/branches/data";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useDriverOffer, useDriverOrderDetail, driverQueryKeys } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { getDriverActionErrorMessage } from "../lib/errorMessage";

const OFFER_URGENT_AFTER_MIN = 10;

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
}

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function AssignmentOfferDetail(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { pagePad } = useScreenLayout();
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const { language } = useAppLanguage();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [, forceTick] = useState(0);
  const queryClient = useQueryClient();
  const expiredRef = useRef(false);

  const offerQuery = useDriverOffer(assignmentId, user?.id);
  const offer = offerQuery.data;
  const orderQuery = useDriverOrderDetail(offer?.orderId);
  const order = orderQuery.data;
  const mutations = useDriverMutations(user?.id);

  // Keeps the "waiting Xm" indicator / real expiresAt countdown honest
  // without requiring any other part of the screen to re-render. This is
  // also the deep-link target of the auto-dispatch push notification
  // itself (auto_dispatch_tick sets it as the notification's action_url),
  // so a driver landing here from that notification is exactly who has a
  // real, ticking 25s deadline -- once it passes, invalidate once so the
  // screen picks up the server's own expired/reassigned state instead of
  // sitting on a stale "0s" badge until the driver backs out and back in.
  useEffect(() => {
    const id = setInterval(() => {
      forceTick((n) => n + 1);
      if (offer?.expiresAt && !expiredRef.current && Date.parse(offer.expiresAt) <= Date.now()) {
        expiredRef.current = true;
        void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offer(offer.id) });
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [offer?.expiresAt, offer?.id, queryClient]);

  const branch = order?.branchId ? findBranchById(order.branchId) : null;
  const branchName = branch ? (language === "ar" ? branch.nameAr : branch.nameEn) : null;
  const branchPhone = branch?.phones?.[0] ?? null;
  const waitedMin = offer ? minutesSince(offer.offeredAt) : 0;
  const hasDeadline = Boolean(offer?.expiresAt);
  const secondsLeft = offer?.expiresAt ? secondsUntil(offer.expiresAt) : null;
  const isUrgent = hasDeadline ? (secondsLeft ?? 0) <= 5 : waitedMin >= OFFER_URGENT_AFTER_MIN;

  const s = useMemo(() => StyleSheet.create({
    content: { paddingBottom: 40, gap: 12 },
    centered: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
    section: { marginHorizontal: pagePad },
    actions: { marginHorizontal: pagePad, marginTop: 8, gap: 12 },
    declineInput: { minHeight: 80, textAlignVertical: "top" },
    declineActions: { flexDirection: flexRow(IS_RTL), justifyContent: "flex-end", gap: 10, marginTop: 14 },
    heroSubRow: { marginTop: 10, flexDirection: flexRow(IS_RTL), gap: 12 },
  }), [theme, pagePad]);

  const handleAccept = async () => {
    if (!assignmentId) return;
    try {
      await mutations.accept.mutateAsync(assignmentId);
      showSuccessSheet(t("driver.acceptedTitle"), t("driver.acceptedBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    }
  };

  const handleDecline = async () => {
    if (!assignmentId || !offer) return;
    try {
      await mutations.decline.mutateAsync({ assignmentId, orderId: offer.orderId, reason });
      showSuccessSheet(t("driver.declinedTitle"), t("driver.declinedBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    }
  };

  const loading = offerQuery.isLoading || orderQuery.isLoading;
  const alreadyResolved = offer && offer.responseStatus !== "offered";

  return (
    <Screen edgeTop scroll background={theme.colors.canvas.background} contentStyle={s.content}>
      <DriverScreenHeader title={t("driver.newDeliveryOffer")} subtitle={t("driver.tapToRespond")} />

      {loading ? (
        <View style={s.centered}><UIText color="secondary">{t("common.loading")}</UIText></View>
      ) : !offer || alreadyResolved ? (
        <View style={s.centered}>
          <Ionicons name="information-circle-outline" size={36} color={theme.colors.text.muted} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("driver.offerNoLongerAvailable")}
          </UIText>
          <Button label={t("common.back")} onPress={() => router.replace("/(driver)" as never)} variant="secondary" style={{ marginTop: 16 }} />
        </View>
      ) : (
        <>
          <View style={s.section}>
            <LinearGradient colors={[theme.colors.brand.primaryLight, theme.colors.canvas.background]} style={{ borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: flexRow(IS_RTL), alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>{t("driver.orderRef")} #{String(offer.orderId).slice(-8).toUpperCase()}</UIText>
                  <UIText variant="card-title" style={{ marginTop: 6, textAlign: TEXT_START }}>{order?.address.name ?? "—"}</UIText>
                  <Badge
                    style={{ marginTop: 6, alignSelf: "flex-start" }}
                    variant={isUrgent ? "warning" : "neutral"}
                    label={
                      hasDeadline
                        ? (secondsLeft && secondsLeft > 0 ? t("driver.expiresInSeconds", { count: secondsLeft }) : t("driver.expiringNow"))
                        : (waitedMin < 1 ? t("driver.elapsedJustNow") : t("driver.elapsedMinutes", { count: waitedMin }))
                    }
                  />
                </View>
                <View style={{ width: 120, marginStart: 12 }}>
                  <MetricCard label={t("driver.estimatedEarnings")} value={order ? formatPrice(order.total) : "—"} />
                </View>
              </View>
              <View style={s.heroSubRow}>
                <InfoRow label={t("driver.items")} value={String(order?.items.length ?? 0)} />
                <InfoRow label={t("driver.phone")} value={order?.address.phone ?? "—"} />
              </View>
            </LinearGradient>
          </View>

          {(branchName || order?.zoneName) && (
            <View style={s.section}>
              <Card padding="md" elevation="sm">
                <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10 }}>
                  <Ionicons name="storefront-outline" size={16} color={theme.colors.status.info} />
                  <View style={{ flex: 1 }}>
                    {branchName ? <UIText variant="body-sm" style={{ textAlign: TEXT_START }}>{branchName}</UIText> : null}
                    {order?.zoneName ? <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>{order.zoneName}</UIText> : null}
                  </View>
                  {branchPhone ? (
                    <Button
                      icon="call-outline"
                      label={t("driver.callPharmacy")}
                      variant="ghost"
                      size="sm"
                      onPress={() => void Linking.openURL(`tel:${branchPhone}`)}
                    />
                  ) : null}
                </View>
              </Card>
            </View>
          )}

          <RouteSummary pagePad={pagePad} driverCoords={undefined} destCoords={order && typeof order.customerLat === 'number' && typeof order.customerLng === 'number' ? { lat: order.customerLat, lng: order.customerLng } : undefined} />

          {!declining ? (
            <View style={s.actions}>
              <Button
                label={t("driver.accept")}
                icon="checkmark-circle"
                onPress={() => void handleAccept()}
                loading={mutations.accept.isPending}
                full
                size="lg"
              />
              <Button
                label={t("driver.decline")}
                icon="close-circle"
                variant="danger"
                onPress={() => setDeclining(true)}
                disabled={mutations.accept.isPending}
                full
                size="lg"
              />
            </View>
          ) : (
            <View style={s.section}>
              <Card padding="lg" elevation="sm">
                <UIText variant="card-title" style={{ textAlign: TEXT_START }}>
                  {t("driver.declineReasonTitle")}
                </UIText>
                <UIText
                  variant="body-sm"
                  color="secondary"
                  style={{ textAlign: TEXT_START, marginTop: 4, marginBottom: 10 }}>
                  {t("driver.declineReasonBody")}
                </UIText>
                <Input
                  value={reason}
                  onChangeText={setReason}
                  placeholder={t("driver.declineReasonPlaceholder")}
                  clearButton
                  multiline
                  numberOfLines={3}
                  style={s.declineInput}
                />
                <View style={s.declineActions}>
                  <Button label={t("common.cancel")} variant="ghost" onPress={() => setDeclining(false)} />
                  <Button
                    label={t("driver.confirmDecline")}
                    variant="danger"
                    onPress={() => void handleDecline()}
                    loading={mutations.decline.isPending}
                  />
                </View>
              </Card>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
