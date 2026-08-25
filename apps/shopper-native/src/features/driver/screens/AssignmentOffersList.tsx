import { defaultTheme as theme } from "@pharmacy/ui-native";
/**
 * AssignmentOffersList — all pending assignment offers awaiting this
 * driver's response. Usually just one, but staff can offer more than one
 * order at a time, so this list exists rather than assuming a single offer.
 */
import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText, Card, EmptyState } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useDriverOffers } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import ConfirmationSheet from "@/components/ConfirmationSheet";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function AssignmentOffersList(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const offersQuery = useDriverOffers(user?.id);
  const offers = offersQuery.data ?? [];
  const mutations = useDriverMutations(user?.id);
  const [pendingAccept, setPendingAccept] = React.useState<string | null>(null);
  const [pendingDecline, setPendingDecline] = React.useState<string | null>(null);

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

  const handleDecline = async (assignmentId: string, orderId: string) => {
    setPendingDecline(assignmentId);
    try {
      await mutations.decline.mutateAsync({ assignmentId, orderId, reason: "Declined from list" });
      showSuccessSheet(t("driver.declinedTitle"), t("driver.declinedBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : String(e));
    } finally {
      setPendingDecline(null);
    }
  };

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.offersTitle")} subtitle={t("driver.tapToRespond")} />

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item }) => (
          <Card style={s.card} elevation="sm">
            <View style={s.offerLeft}>
              <View style={s.offerIcon}><Ionicons name="flash-outline" size={20} color={theme.colors.status.warning} /></View>
            </View>

            <View style={s.offerBody}>
              <View style={s.cardTitleRow}>
                <UIText variant="card-title" style={{ textAlign: TEXT_START }}>#{item.orderId?.slice(-8).toUpperCase()}</UIText>
                <View style={s.newPill}><Ionicons name="time-outline" size={12} color={theme.colors.status.warning} /></View>
              </View>

              <UIText variant="body-sm" color="secondary" style={{ marginTop: 6, textAlign: TEXT_START }}>
                {t("driver.offerSubtitle", "New delivery offer — tap to view details or respond quickly")}
              </UIText>

              <View style={s.metaRow}>
                <View style={s.metaItem}><Ionicons name="pricetag-outline" size={14} color={theme.colors.text.muted} /><UIText variant="caption" color="secondary">{t("driver.estimatedFee")}</UIText></View>
                <View style={s.metaItem}><Ionicons name="time-outline" size={14} color={theme.colors.text.muted} /><UIText variant="caption" color="secondary">{t("driver.quickResponseHint")}</UIText></View>
              </View>
            </View>

            <View style={s.offerActionsCol}>
              <Pressable onPress={() => void handleAccept(item.id)} style={[s.acceptBtn, pendingAccept === item.id && s.btnBusy]} disabled={Boolean(pendingAccept === item.id)}>
                <UIText color="#fff">{pendingAccept === item.id ? t("common.accepting") : t("driver.accept")}</UIText>
              </Pressable>
              <Pressable onPress={() => void handleDecline(item.id, item.orderId)} style={[s.declineBtn, pendingDecline === item.id && s.btnBusy]} disabled={Boolean(pendingDecline === item.id)}>
                <UIText color="danger">{pendingDecline === item.id ? t("common.declining") : t("driver.decline")}</UIText>
              </Pressable>
              <Pressable onPress={() => router.push(`/(driver)/offer/${item.id}` as never)} style={s.viewBtn}>
                <UIText variant="caption">{t("common.view")}</UIText>
              </Pressable>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={offersQuery.isLoading ? (
          <View style={s.emptyState}><ActivityIndicator color={theme.colors.brand.primary} /></View>
        ) : offersQuery.isError ? (
          <EmptyState icon="cloud-offline-outline" title={t("errors.network")} subtitle={t("common.retryShort")} />
        ) : (
          <EmptyState icon="checkmark-circle-outline" title={t("driver.noOffersTitle")} />
        )}
      />

      {/* Decline confirmation sheet rendered inline for accessibility */}
      {pendingDecline ? (
        <ConfirmationSheet
          title={t("driver.confirmDeclineTitle")}
          body={t("driver.confirmDeclineBody")}
          confirmLabel={t("driver.decline")}
          cancelLabel={t("common.cancel")}
          onConfirm={() => {
            // find the offer to decline and call original handler
            const offer = offers.find((o) => o.id === pendingDecline);
            if (offer) void handleDecline(offer.id, offer.orderId);
          }}
          onCancel={() => setPendingDecline(null)}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  listContent: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom: 40,
  },
  card: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.canvas.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${theme.colors.status.warning}1A`,
    ...theme.shadows[1],
  },
  offerActions: { flexDirection: flexRow(IS_RTL), alignItems: 'center', gap: 8 },
  acceptBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.colors.brand.primaryLight },
  declineBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.colors.canvas.surface },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: 'transparent' },
  offerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: `${theme.colors.status.warning}1A`, alignItems: "center", justifyContent: "center" },
  cardTitleRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 8 },
  newPill: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.colors.status.warning}1A` },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  retryBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999, backgroundColor: theme.colors.brand.primaryLight },
  offerLeft: { width: 58, alignItems: 'center', justifyContent: 'center' },
  offerBody: { flex: 1 },
  metaRow: { flexDirection: flexRow(IS_RTL), gap: 10, marginTop: 8, alignItems: 'center' },
  metaItem: { flexDirection: flexRow(IS_RTL), gap: 6, alignItems: 'center' },
  offerActionsCol: { flexDirection: 'column', gap: 8, marginStart: 8, alignItems: 'flex-end' },
  btnBusy: { opacity: 0.7 },
});
