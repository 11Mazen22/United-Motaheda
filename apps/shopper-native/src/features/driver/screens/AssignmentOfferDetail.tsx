/**
 * AssignmentOfferDetail — accept or decline one offered delivery.
 * Decline requires a short reason (kept as free text, not a chip picker —
 * this is an internal staff-visible note, not a customer-facing form).
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText, Card, Input, useTheme } from "@pharmacy/ui-native";
import { Button, kit } from "@pharmacy/ui-native";
import { LinearGradient } from "expo-linear-gradient";
import { InfoRow } from "@/features/orders/components/OrderDetailHelpers";
import RouteSummary from "../components/RouteSummary";
import MetricCard from "@/components/MetricCard";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useDriverOffer, useDriverOrderDetail } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { DriverScreenHeader } from "../components/DriverScreenHeader";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function AssignmentOfferDetail(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const offerQuery = useDriverOffer(assignmentId, user?.id);
  const offer = offerQuery.data;
  const orderQuery = useDriverOrderDetail(offer?.orderId);
  const order = orderQuery.data;
  const mutations = useDriverMutations(user?.id);

  const s = useMemo(() => StyleSheet.create({
    content: { paddingBottom: 40 },
    centered: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
    card: {
      marginHorizontal: kit.inset.screen,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 16,
      padding: 16,
      ...theme.shadows[1],
    },
    detailCard: {
      marginHorizontal: kit.inset.screen,
      marginTop: 12,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 16,
      padding: 16,
      ...theme.shadows[1],
    },
    actions: {
      marginHorizontal: kit.inset.screen,
      marginTop: 20,
      gap: 12,
    },
    declineInput: {
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: 12,
      padding: 12,
      minHeight: 80,
      textAlignVertical: "top",
      fontSize: 14,
      color: theme.colors.text.primary,
      textAlign: TEXT_START,
    },
    declineCard: {
      marginHorizontal: kit.inset.screen,
      marginTop: 20,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 16,
      padding: 16,
      ...theme.shadows[1],
    },
    declineActions: {
      flexDirection: flexRow(IS_RTL),
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 14,
    },
    heroBanner: {
      marginHorizontal: kit.inset.screen,
      marginTop: 12,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 16,
      padding: 12,
      ...theme.shadows[1],
    },
    heroSubRow: { marginTop: 10, flexDirection: flexRow(IS_RTL), gap: 12 },
  }), [theme]);

  const handleAccept = async () => {
    if (!assignmentId) return;
    try {
      await mutations.accept.mutateAsync(assignmentId);
      showSuccessSheet(t("driver.acceptedTitle"), t("driver.acceptedBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const handleDecline = async () => {
    if (!assignmentId || !offer) return;
    try {
      await mutations.decline.mutateAsync({ assignmentId, orderId: offer.orderId, reason });
      showSuccessSheet(t("driver.declinedTitle"), t("driver.declinedBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
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
          <LinearGradient colors={[theme.colors.brand.primaryLight, theme.colors.canvas.background]} style={s.heroBanner}>
            <View style={{ flexDirection: flexRow(IS_RTL), alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>{t("driver.orderRef")} #{String(offer.orderId).slice(-8).toUpperCase()}</UIText>
                <UIText variant="card-title" style={{ marginTop: 6, textAlign: TEXT_START }}>{order?.address.name ?? "—"}</UIText>
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

          <View style={s.card}>
            <Card style={s.detailCard} elevation="sm">
              <RouteSummary driverCoords={undefined} destCoords={order && typeof order.customerLat === 'number' && typeof order.customerLng === 'number' ? { lat: order.customerLat, lng: order.customerLng } : undefined} />
            </Card>
          </View>

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
            <View style={s.declineCard}>
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
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
