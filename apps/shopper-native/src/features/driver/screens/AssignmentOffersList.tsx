/**
 * AssignmentOffersList — all pending assignment offers awaiting this
 * driver's response. Usually just one, but staff can offer more than one
 * order at a time, so this list exists rather than assuming a single offer.
 *
 * Confirmed bug fixed here: the decline "confirmation" used to fire the
 * decline mutation immediately on the first tap, then render a
 * ConfirmationSheet that only appeared AFTER the request was already in
 * flight/done. Fixed to reveal a reason field first, only submit when the
 * driver explicitly confirms.
 *
 * Also fixed: this screen used to show literally nothing about the
 * delivery itself — no destination area, no branch, no real fee — just a
 * static "Estimated fee" label with no value next to it. listMyOpenAssignmentOffers
 * now joins through the order's own zone/branch/total (see api.ts's
 * AssignmentOffer type), so a driver can actually make an informed
 * accept/decline decision instead of guessing from an order id alone.
 */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Text as UIText, Card, Button, Input, Badge, SkeletonCard, EmptyState, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { findBranchById } from "@/features/delivery/branches/data";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { useDriverOffers, driverQueryKeys } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { DriverScreenHeader } from "../components/DriverScreenHeader";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const OFFER_URGENT_AFTER_MIN = 10;

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
}

export function AssignmentOffersList(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { language } = useAppLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const offersQuery = useDriverOffers(user?.id);
  const offers = offersQuery.data ?? [];
  const mutations = useDriverMutations(user?.id);
  const [pendingAccept, setPendingAccept] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    listContent: { paddingHorizontal: kit.inset.screen, paddingBottom: 40 },
    card: { gap: 12 },
    urgentCard: { borderColor: theme.colors.status.warning, borderWidth: 1.5 },
    headerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
    offerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: `${theme.colors.status.warning}1A`, alignItems: "center", justifyContent: "center" },
    infoGrid: { gap: 8 },
    infoRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    infoLabel: { flex: 1 },
    actionsRow: { flexDirection: flexRow(IS_RTL), gap: 10 },
    actionBtn: { flex: 1 },
    quickBtn: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas.surfaceMuted },
    declineInput: { minHeight: 70, textAlignVertical: "top" },
    declineActions: { flexDirection: flexRow(IS_RTL), justifyContent: "flex-end", gap: 10 },
  }), [theme]);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: driverQueryKeys.offers(user.id) });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, user?.id]);

  const handleAccept = async (assignmentId: string) => {
    setPendingAccept(assignmentId);
    try {
      await mutations.accept.mutateAsync(assignmentId);
      showSuccessSheet(t("driver.acceptedTitle"), t("driver.acceptedBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    } finally {
      setPendingAccept(null);
    }
  };

  const startDecline = (assignmentId: string) => {
    setDecliningId(assignmentId);
    setReason("");
  };

  const confirmDecline = async (assignmentId: string, orderId: string) => {
    try {
      await mutations.decline.mutateAsync({ assignmentId, orderId, reason });
      showSuccessSheet(t("driver.declinedTitle"), t("driver.declinedBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    } finally {
      setDecliningId(null);
      setReason("");
    }
  };

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.offersTitle")} subtitle={t("driver.tapToRespond")} />

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        renderItem={({ item }) => {
          const isDeclining = decliningId === item.id;
          const waitedMin = minutesSince(item.offeredAt);
          const isUrgent = waitedMin >= OFFER_URGENT_AFTER_MIN;
          const branch = item.branchId ? findBranchById(item.branchId) : null;
          const branchName = branch ? (language === "ar" ? branch.nameAr : branch.nameEn) : null;
          const branchPhone = branch?.phones?.[0] ?? null;

          return (
            <Card style={[s.card, isUrgent && s.urgentCard]} padding="lg" elevation="sm">
              <View style={s.headerRow}>
                <View style={s.offerIcon}><Ionicons name="flash-outline" size={20} color={theme.colors.status.warning} /></View>
                <View style={{ flex: 1 }}>
                  <UIText variant="card-title" style={{ textAlign: TEXT_START }}>#{item.orderId?.slice(-8).toUpperCase()}</UIText>
                  <UIText variant="caption" color={isUrgent ? "warn" : "secondary"} style={{ textAlign: TEXT_START, marginTop: 2 }}>
                    {waitedMin < 1 ? t("driver.elapsedJustNow") : t("driver.elapsedMinutes", { count: waitedMin })}
                    {isUrgent ? ` · ${t("driver.offerExpiresWarning")}` : ""}
                  </UIText>
                </View>
                <Badge variant="primary" label={formatPrice(item.total)} />
              </View>

              <View style={s.infoGrid}>
                {branchName ? (
                  <View style={s.infoRow}>
                    <Ionicons name="storefront-outline" size={14} color={theme.colors.text.muted} />
                    <UIText variant="body-sm" color="secondary" style={s.infoLabel}>{branchName}</UIText>
                  </View>
                ) : null}
                {item.destinationArea ? (
                  <View style={s.infoRow}>
                    <Ionicons name="location-outline" size={14} color={theme.colors.text.muted} />
                    <UIText variant="body-sm" color="secondary" style={s.infoLabel}>{item.destinationArea}</UIText>
                  </View>
                ) : null}
                {item.zoneName ? (
                  <View style={s.infoRow}>
                    <Ionicons name="map-outline" size={14} color={theme.colors.text.muted} />
                    <UIText variant="body-sm" color="secondary" style={s.infoLabel}>{item.zoneName}</UIText>
                  </View>
                ) : null}
              </View>

              {!isDeclining ? (
                <View style={s.actionsRow}>
                  <Button style={s.actionBtn} label={t("driver.accept")} onPress={() => void handleAccept(item.id)} loading={pendingAccept === item.id} />
                  <Button style={s.actionBtn} label={t("driver.decline")} variant="outline" onPress={() => startDecline(item.id)} disabled={pendingAccept === item.id} />
                  {branchPhone ? (
                    <Pressable onPress={() => void Linking.openURL(`tel:${branchPhone}`)} style={s.quickBtn} accessibilityRole="button" accessibilityLabel={t("driver.callPharmacy")}>
                      <Ionicons name="call-outline" size={18} color={theme.colors.text.secondary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <UIText variant="label" style={{ textAlign: TEXT_START }}>{t("driver.declineReasonTitle")}</UIText>
                  <Input
                    value={reason}
                    onChangeText={setReason}
                    placeholder={t("driver.declineReasonPlaceholder")}
                    multiline
                    numberOfLines={3}
                    style={s.declineInput}
                  />
                  <View style={s.declineActions}>
                    <Button label={t("common.cancel")} variant="ghost" onPress={() => setDecliningId(null)} />
                    <Button
                      label={t("driver.confirmDecline")}
                      variant="danger"
                      onPress={() => void confirmDecline(item.id, item.orderId)}
                      loading={mutations.decline.isPending}
                    />
                  </View>
                </View>
              )}

              <Button label={t("common.view")} variant="ghost" size="sm" onPress={() => router.push(`/(driver)/offer/${item.id}` as never)} />
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={offersQuery.isLoading ? (
          <View>{[1, 2].map((i) => <SkeletonCard key={i} lines={4} style={{ marginBottom: 10 }} />)}</View>
        ) : offersQuery.isError ? (
          <EmptyState illustrationName="offline" title={t("errors.network")} subtitle={t("common.retryShort")} action={{ label: t("common.retry"), onPress: () => void onRefresh() }} />
        ) : (
          <EmptyState icon="checkmark-circle-outline" title={t("driver.noOffersTitle")} />
        )}
      />
    </Screen>
  );
}
