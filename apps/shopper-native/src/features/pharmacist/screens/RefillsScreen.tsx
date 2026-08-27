/**
 * RefillsScreen — the refill_requests workflow. Server infrastructure for
 * this (reviewed_by/reviewed_at/admin_notes/rejection_reason columns, staff
 * RLS) existed with zero pharmacist-facing UI ever built against it. Kept as
 * one screen with inline expand-to-review rather than a separate detail
 * route — a refill needs less inspection surface than a full order or a
 * prescription image, so a second navigation hop would be pure friction.
 */
import React, { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Screen, Text as UIText, Chip, Input, Button, EmptyState, ErrorState, SkeletonCard, useTheme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { usePharmacistRefills } from "../hooks/usePharmacistQueries";
import { usePharmacistMutations } from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import type { PharmacistRefillRequest, RefillRequestStatus } from "../api/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const FILTERS: { key: RefillRequestStatus | "all"; labelKey: string }[] = [
  { key: "all",        labelKey: "pharmacist.filterAll" },
  { key: "pending",    labelKey: "pharmacist.refillStatusPending" },
  { key: "preparing",  labelKey: "pharmacist.refillStatusPreparing" },
  { key: "ready",      labelKey: "pharmacist.refillStatusReady" },
  { key: "on_the_way", labelKey: "pharmacist.refillStatusOnTheWay" },
  { key: "delivered",  labelKey: "pharmacist.refillStatusDelivered" },
  { key: "cancelled",  labelKey: "pharmacist.refillStatusCancelled" },
];

function statusColor(status: RefillRequestStatus, theme: ReturnType<typeof useTheme>["theme"]): string {
  switch (status) {
    case "pending":    return theme.colors.status.warning;
    case "cancelled":  return theme.colors.status.error;
    case "delivered":  return theme.colors.status.success;
    default:           return theme.colors.brand.primary;
  }
}

const ADVANCE_TARGET: Partial<Record<RefillRequestStatus, RefillRequestStatus>> = {
  preparing:  "ready",
  ready:      "on_the_way",
  on_the_way: "delivered",
};

function RefillCard({ refill }: { refill: PharmacistRefillRequest }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const mutations = usePharmacistMutations();
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);

  const color = statusColor(refill.status, theme);
  const busy = mutations.reviewRefill.isPending || mutations.advanceRefill.isPending;
  const nextStatus = ADVANCE_TARGET[refill.status];

  const handleApprove = async () => {
    try {
      await mutations.reviewRefill.mutateAsync({ id: refill.id, decision: "approved" });
      showSuccessSheet(t("pharmacist.refillApprovedTitle", "Refill approved"), t("pharmacist.refillApprovedBody", "Moved to preparation."));
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  const handleReject = async () => {
    if (reason.trim().length === 0) { setReasonTouched(true); return; }
    try {
      await mutations.reviewRefill.mutateAsync({ id: refill.id, decision: "rejected", rejectionReason: reason.trim() });
      showSuccessSheet(t("pharmacist.refillRejectedTitle", "Refill rejected"), t("pharmacist.refillRejectedBody", "The customer has been notified."));
      setShowReject(false);
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  const handleAdvance = async () => {
    if (!nextStatus) return;
    try {
      await mutations.advanceRefill.mutateAsync({ id: refill.id, nextStatus });
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, borderStartColor: color, borderStartWidth: 4 }]}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <UIText variant="body" weight="bold" numberOfLines={1}>{refill.medicineName}</UIText>
          <UIText variant="body-sm" color="secondary" numberOfLines={1}>{refill.customerName}</UIText>
        </View>
        <View style={[s.statusPill, { backgroundColor: `${color}17` }]}>
          <UIText variant="caption" weight="bold" style={{ color }}>
            {t(FILTERS.find((f) => f.key === refill.status)?.labelKey ?? refill.status)}
          </UIText>
        </View>
      </View>

      <View style={[s.row, { marginTop: 6, gap: 6 }]}>
        <UIText variant="caption" color="muted">{new Date(refill.placedAt).toLocaleDateString()}</UIText>
        <View style={[s.dot, { backgroundColor: theme.colors.text.muted }]} />
        <UIText variant="caption" color="muted">{formatPrice(refill.total)}</UIText>
      </View>

      {expanded && (
        <View style={[s.expandArea, { borderTopColor: theme.colors.border.default }]}>
          {refill.customerPhone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${refill.customerPhone}`)} style={[s.row, { gap: 6, marginBottom: 8 }]}>
              <Ionicons name="call-outline" size={14} color={theme.colors.brand.primary} />
              <UIText variant="body-sm" style={{ color: theme.colors.brand.primary }}>{refill.customerPhone}</UIText>
            </Pressable>
          ) : null}
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.refillDelivery", "Delivery")}</UIText>
            <UIText variant="body-sm">{refill.delivery}</UIText>
          </View>
          {refill.copay > 0 && (
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.refillCopay", "Copay")}</UIText>
              <UIText variant="body-sm">{formatPrice(refill.copay)}</UIText>
            </View>
          )}
          {refill.trackingNumber ? (
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.transferNumber")}</UIText>
              <UIText variant="body-sm">{refill.trackingNumber}</UIText>
            </View>
          ) : null}
          {refill.rejectionReason ? (
            <UIText variant="body-sm" color="danger" style={{ marginTop: 8, textAlign: TEXT_START }}>
              {refill.rejectionReason}
            </UIText>
          ) : null}

          {refill.status === "pending" && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {!showReject ? (
                <View style={[s.row, { gap: 8 }]}>
                  <Button label={t("pharmacist.actionApproveRx", "Approve")} onPress={handleApprove} loading={busy} style={{ flex: 1 }} />
                  <Button label={t("pharmacist.actionRejectRx", "Reject")} variant="outline" onPress={() => setShowReject(true)} style={{ flex: 1 }} />
                </View>
              ) : (
                <>
                  <Input
                    value={reason}
                    onChangeText={(v) => { setReason(v); if (reasonTouched) setReasonTouched(false); }}
                    placeholder={t("pharmacist.rejectionReasonPlaceholder", "Reason for rejection")}
                    multiline
                  />
                  {reasonTouched && reason.trim().length === 0 ? (
                    <UIText variant="caption" color="danger">{t("pharmacist.rejectionReasonRequired", "A rejection reason is required.")}</UIText>
                  ) : null}
                  <View style={[s.row, { gap: 8 }]}>
                    <Button label={t("pharmacist.confirmReject", "Confirm Reject")} variant="danger" onPress={handleReject} loading={busy} style={{ flex: 1 }} />
                    <Button label={t("common.cancel", "Cancel")} variant="ghost" onPress={() => setShowReject(false)} style={{ flex: 1 }} />
                  </View>
                </>
              )}
            </View>
          )}

          {nextStatus && (
            <Button
              label={t(`pharmacist.refillAdvanceTo${nextStatus === "ready" ? "Ready" : nextStatus === "on_the_way" ? "OnTheWay" : "Delivered"}`)}
              onPress={handleAdvance}
              loading={busy}
              full
              style={{ marginTop: 12 }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

export function RefillsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<RefillRequestStatus | "all">("pending");
  const refillsQ = usePharmacistRefills(filter);

  const items = refillsQ.data ?? [];

  const onRefresh = useCallback(async () => { await refillsQ.refetch(); }, [refillsQ]);

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <PharmacistScreenHeader title={t("pharmacist.refillsTitle", "Refills")} />

      <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL) }]}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={t(f.labelKey)} selected={filter === f.key} selectable onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {refillsQ.isLoading ? (
        <View style={s.listContent}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : refillsQ.isError ? (
        <ErrorState message={t("common.error")} retry={() => void refillsQ.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refillsQ.isFetching} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          renderItem={({ item }) => <RefillCard refill={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="repeat-outline"
              title={t("pharmacist.emptyRefillsTitle", "No refill requests")}
              subtitle={t("pharmacist.emptyRefillsSubtitle", "Refill requests will appear here as customers place them.")}
            />
          }
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: "wrap" },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  row: { flexDirection: flexRow(IS_RTL), alignItems: "center" },
  card: { borderRadius: 14, padding: 14, borderWidth: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  expandArea: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
